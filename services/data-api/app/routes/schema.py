from __future__ import annotations

import json
from pathlib import Path
from datetime import datetime, timezone
from fastapi import APIRouter

from app.catalogue import DEFAULT_LIFECYCLE, E_CODE_TO_UK, TL_TO_UK, region_hierarchy, metric_classes
from app.models import SchemaResponse

router = APIRouter()

REPO_ROOT = Path(__file__).resolve().parents[3]


def _load_region_index() -> dict:
    """
    Public schema must not depend on auth or Supabase availability.
    We build an approximate region catalogue from the repo's processed index.
    """
    path = REPO_ROOT / "public" / "processed" / "region-index.json"
    if not path.exists():
        return {}
    return json.loads(path.read_text())


def _to_public_region_code(code: str) -> str:
    # DB ITL1: E120* etc -> UI ITL1: UK*
    if code in E_CODE_TO_UK:
        return E_CODE_TO_UK[code]
    # itl_to_lad ITL1: TL* -> UI ITL1: UK*
    if code in TL_TO_UK:
        return TL_TO_UK[code]
    return code


@router.get("/schema", response_model=SchemaResponse)
def get_schema() -> SchemaResponse:
    now = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    parent_map = region_hierarchy()

    # Public, auth-free schema:
    # - Metrics: from our catalogue stub
    # - Regions: from processed region index + inferred ITL1 parent map
    region_index = _load_region_index()
    regions_out: list[dict] = []
    for code, meta in region_index.items():
        out_code = _to_public_region_code(code)
        level = meta.get("level")
        parent = None
        if isinstance(out_code, str) and out_code.startswith("UK") and len(out_code) == 3:
            parent = "UK"
        else:
            parent = parent_map.get(code) or parent_map.get(out_code)
        regions_out.append(
            {
                "region_code": out_code,
                "region_name": meta.get("name") or code,
                "level": level,
                "geo_schema": "UK_ITL_2025",
                "parent_region_code": parent,
                "valid_from": "2025-01-01",
                "valid_to": None,
            }
        )

    return SchemaResponse(
        version="v1",
        generated_at=now,
        vintage=DEFAULT_LIFECYCLE.vintage,
        source=DEFAULT_LIFECYCLE.source,
        status=DEFAULT_LIFECYCLE.status,  # type: ignore[arg-type]
        metrics=sorted(metric_classes(), key=lambda m: m["metric_id"])[:5000],
        regions=sorted(regions_out, key=lambda r: r["region_code"])[:20000],
        scenarios=["baseline", "upside", "downside"],
        measures=["value", "ci_lower", "ci_upper", "growth_yoy"],
        breakdowns=[],
        time_coverage={"min_year": 2010, "max_year": 2050},
        compatibility={
            "rules": [
                {
                    "id": "unit_type_compat",
                    "description": "Metrics in the same query should have compatible unit+type classes.",
                }
            ]
        },
    )


