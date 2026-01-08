from __future__ import annotations

from datetime import datetime, timezone
from fastapi import APIRouter

from app.catalogue import DEFAULT_LIFECYCLE, ITL1_REGIONS, metric_classes
from app.models import SchemaResponse

router = APIRouter()


@router.get("/schema", response_model=SchemaResponse)
def get_schema() -> SchemaResponse:
    """
    Public schema endpoint - returns available metrics, regions, and query options.
    
    v1: Uses hardcoded ITL1 region catalogue (stable UK geography).
    The observations endpoint supports ITL2/ITL3/LAD dynamically via Supabase queries.
    """
    # Build region catalogue from hardcoded ITL1 regions
    regions_out = [
        {
            "region_code": r["region_code"],
            "region_name": r["region_name"],
            "level": r["level"],
            "geo_schema": "UK_ITL_2025",
            "parent_region_code": "UK" if r["level"] == "ITL1" else None,
            "valid_from": "2025-01-01",
            "valid_to": None,
        }
        for r in ITL1_REGIONS
    ]

    return SchemaResponse(
        version="v1",
        vintage=DEFAULT_LIFECYCLE.vintage,
        source=DEFAULT_LIFECYCLE.source,
        status=DEFAULT_LIFECYCLE.status,  # type: ignore[arg-type]
        metrics=sorted(metric_classes(), key=lambda m: m["metric_id"]),
        regions=sorted(regions_out, key=lambda r: r["region_code"]),
        scenarios=["baseline", "upside", "downside"],
        measures=["value", "ci_lower", "ci_upper", "growth_yoy"],
        breakdowns=[],
        time_coverage={"min_year": 1991, "max_year": 2050},
        compatibility={
            "rules": [
                {
                    "id": "unit_type_compat",
                    "description": "Metrics in the same query should have compatible unit+type classes.",
                }
            ]
        },
    )
