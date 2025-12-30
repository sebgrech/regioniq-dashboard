from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request

from app.auth import get_current_user
from app.catalogue import DEFAULT_LIFECYCLE, E_CODE_TO_UK, UK_TO_E_CODE
from app.models import (
    ErrorResponse,
    ObservationRecord,
    QueryRequest,
    QueryResponse,
    ResponseMeta,
)
from app.supabase_rest import get_supabase_rest

router = APIRouter()


def _now_z() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def _domain_error(status: int, code: str, message: str, details: dict[str, Any] | None = None):
    raise HTTPException(
        status_code=status,
        detail=ErrorResponse(error={"code": code, "message": message, "details": details or {}}).model_dump(),
    )


def _extract_values(req: QueryRequest, code: str) -> list[str] | None:
    for d in req.query:
        if d.code != code:
            continue
        sel = d.selection
        if getattr(sel, "filter", None) == "item":
            return list(sel.values)
        if getattr(sel, "filter", None) == "all":
            return None
        if getattr(sel, "filter", None) == "range":
            return [sel.from_, sel.to]
    return []


def _estimate_cost(req: QueryRequest) -> int:
    metrics = _extract_values(req, "metric")
    regions = _extract_values(req, "region")
    years = _extract_values(req, "time_period")
    scenarios = _extract_values(req, "scenario")
    measures = _extract_values(req, "measure")

    metric_count = 1 if metrics is None else max(1, len(metrics))
    region_count = 1 if regions is None else max(1, len(regions))
    scenario_count = 1 if scenarios is None else max(1, len(scenarios))
    measure_count = 1 if measures is None else max(1, len(measures))

    year_count = 1
    if years is None:
        year_count = 200
    elif len(years) == 2 and years[0].isdigit() and years[1].isdigit():
        a = int(years[0])
        b = int(years[1])
        year_count = max(1, abs(b - a) + 1)
    else:
        year_count = max(1, len(years))

    # treat unbounded dims as very large
    if metrics is None:
        metric_count = 5000
    if regions is None:
        region_count = 50000
    if scenarios is None:
        scenario_count = 1
    if measures is None:
        measure_count = 1
    if years is None:
        year_count = 200

    return max(1, metric_count * region_count * year_count * scenario_count * measure_count)


def _compat_warnings(metric_ids: list[str]) -> list[str]:
    # v1: best-effort warnings. Real compatibility rules come from the schema catalogue.
    if len(metric_ids) <= 1:
        return []
    return []


def _choose_measure_for_scenario(scenario: str, explicit_measure: str | None) -> str:
    if explicit_measure in ("value", "ci_lower", "ci_upper"):
        return explicit_measure
    if scenario == "upside":
        return "ci_upper"
    if scenario == "downside":
        return "ci_lower"
    return "value"


def _pick_value(row: dict[str, Any], measure: str) -> float | None:
    if row.get("data_type") == "historical":
        return row.get("value")
    v = row.get(measure)
    if v is None:
        return row.get("value")
    return v


@router.post("/observations/query", response_model=QueryResponse, responses={400: {"model": ErrorResponse}, 401: {"model": ErrorResponse}})
def observations_query(req: QueryRequest, request: Request, user=Depends(get_current_user)) -> QueryResponse:
    # v1 guardrails: hard cost limit
    estimated = _estimate_cost(req)
    max_cost = 250_000
    if estimated > max_cost:
        _domain_error(
            400,
            "QUERY_TOO_LARGE",
            "Query exceeds maximum estimated record limit.",
            {"estimated_records": estimated, "max_records": max_cost},
        )

    metric_ids = _extract_values(req, "metric")
    region_codes = _extract_values(req, "region")
    year_sel = _extract_values(req, "time_period")
    scenario_sel = _extract_values(req, "scenario") or ["baseline"]
    measure_sel = _extract_values(req, "measure")
    explicit_measure = measure_sel[0] if (measure_sel and len(measure_sel) > 0) else None
    data_type_sel = _extract_values(req, "data_type")

    if metric_ids is None or region_codes is None:
        _domain_error(
            400,
            "UNBOUNDED_QUERY",
            "metric=all and region=all are not allowed in v1; provide explicit metric and region selections.",
            {"hint": "Use schema to enumerate values, then query a subset."},
        )

    # Year range
    year_from = 1991
    year_to = 2050
    if year_sel and len(year_sel) == 2 and year_sel[0].isdigit() and year_sel[1].isdigit():
        year_from = int(year_sel[0])
        year_to = int(year_sel[1])

    warnings = _compat_warnings(metric_ids)

    try:
        supa = get_supabase_rest()
    except Exception as e:
        _domain_error(
            500,
            "DATA_API_MISCONFIGURED",
            "Data API is not configured to reach the underlying data store.",
            {"reason": str(e)},
        )
    token = user["token"]
    tables = {
        "ITL1": "itl1_latest_all",
        "ITL2": "itl2_latest_all",
        "ITL3": "itl3_latest_all",
        "LAD": "lad_latest_all",
    }

    def to_db_code(code: str) -> str:
        # Accept UI ITL1 codes (UK*) by translating to DB ITL1 codes (E120*/S920*/W920*/N920*).
        if code.startswith("UK") and len(code) == 3 and code in UK_TO_E_CODE:
            return UK_TO_E_CODE[code]
        return code

    def infer_level(db_code: str) -> str:
        if db_code.startswith(("E120", "S920", "W920", "N920")):
            return "ITL1"
        if db_code.startswith("TL"):
            return "ITL2" if len(db_code) == 4 else "ITL3"
        return "LAD"

    # Group region codes by level/table
    by_level: dict[str, list[str]] = {"ITL1": [], "ITL2": [], "ITL3": [], "LAD": []}
    for rc in region_codes:
        db = to_db_code(rc)
        lvl = infer_level(db)
        by_level[lvl].append(db)

    records: list[ObservationRecord] = []
    MAX_RETURN = min(250_000, max(1, req.limit))

    select_cols = (
        "region_code,region_name,region_level,metric_id,period,value,ci_lower,ci_upper,"
        "unit,freq,data_type,data_quality,vintage,forecast_run_date,forecast_version,is_calculated"
    )

    for lvl, codes in by_level.items():
        if not codes:
            continue
        table = tables[lvl]

        # Chunk regions to keep URL manageable
        region_chunks = [codes[i : i + 100] for i in range(0, len(codes), 100)]
        metric_chunks = [metric_ids[i : i + 50] for i in range(0, len(metric_ids), 50)]

        for rchunk in region_chunks:
            r_in = ",".join(rchunk)
            for mchunk in metric_chunks:
                m_in = ",".join(mchunk)
                offset = req.cursor or 0
                while True:
                    params: list[tuple[str, str]] = [
                        ("select", select_cols),
                        ("region_code", f"in.({r_in})"),
                        ("metric_id", f"in.({m_in})"),
                        ("period", f"gte.{year_from}"),
                        ("period", f"lte.{year_to}"),
                        ("order", "metric_id.asc,region_code.asc,period.asc"),
                        ("offset", str(offset)),
                        ("limit", str(min(10_000, MAX_RETURN - len(records)))),
                    ]
                    if data_type_sel and len(data_type_sel) > 0:
                        params.append(("data_type", f"in.({','.join(data_type_sel)})"))

                    try:
                        rows = supa.get(table, token, params=params)
                    except Exception as e:
                        _domain_error(
                            500,
                            "DATA_UNAVAILABLE",
                            "Failed to query underlying data store.",
                            {"table": table, "reason": str(e)},
                        )
                    if not rows:
                        break

                    for row in rows:
                        for scenario in scenario_sel:
                            measure = _choose_measure_for_scenario(scenario, explicit_measure)
                            records.append(
                                ObservationRecord(
                                    metric_id=row.get("metric_id"),
                                    region_code=E_CODE_TO_UK.get(row.get("region_code"), row.get("region_code")),
                                    geo_schema="UK_ITL_2025",
                                    level=lvl,
                                    time_period=row.get("period"),
                                    scenario=scenario,
                                    measure=measure,
                                    value=_pick_value(row, measure),
                                    unit=row.get("unit"),
                                    data_type=row.get("data_type"),
                                    data_quality=row.get("data_quality"),
                                    confidence_lower=row.get("ci_lower"),
                                    confidence_upper=row.get("ci_upper"),
                                )
                            )
                            if len(records) >= MAX_RETURN:
                                break
                        if len(records) >= MAX_RETURN:
                            break
                    if len(records) >= MAX_RETURN:
                        break

                    offset += len(rows)
                    if len(rows) < 10_000:
                        break
                if len(records) >= MAX_RETURN:
                    break
            if len(records) >= MAX_RETURN:
                break

    accessed_at = _now_z()
    url = str(request.url)
    citation = f"RegionIQ Data API ({DEFAULT_LIFECYCLE.vintage}). Accessed {accessed_at}. Source: {DEFAULT_LIFECYCLE.source}."

    meta = ResponseMeta(
        vintage=DEFAULT_LIFECYCLE.vintage,
        source=DEFAULT_LIFECYCLE.source,
        status=DEFAULT_LIFECYCLE.status,  # type: ignore[arg-type]
        estimated_records=estimated,
        returned_records=len(records),
        truncated=len(records) >= MAX_RETURN,
        warnings=warnings,
        citation=citation,
        url=url,
        accessed_at=accessed_at,
        next_cursor=(req.cursor or 0) + len(records) if len(records) >= MAX_RETURN else None,
    )
    # Minimal v1 usage logging (foundation for pricing/roadmap)
    print(
        f"user_id={user.get('user_id')} endpoint=/api/v1/observations/query "
        f"estimated_records={estimated} returned_records={len(records)} truncated={meta.truncated}"
    )
    return QueryResponse(meta=meta, data=records)


