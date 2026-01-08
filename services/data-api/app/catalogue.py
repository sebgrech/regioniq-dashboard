from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Any


# ⚠️ FORECAST_VINTAGE is release-controlled: only update via env var on weekly publish
# Format: "2026-W03" (ISO week). Do NOT compute from dates or use quarter-based defaults.
FORECAST_VINTAGE = os.environ.get("FORECAST_VINTAGE", "unreleased")


@dataclass(frozen=True)
class Lifecycle:
    vintage: str
    source: str
    status: str  # final|provisional|experimental


DEFAULT_LIFECYCLE = Lifecycle(
    vintage=FORECAST_VINTAGE,
    source="RegionIQ Forecast Engine v1",
    status="provisional",
)


# Region code mappings (E-codes used in database -> UK codes for API)
E_CODE_TO_UK = {
    "E12000001": "UKC",
    "E12000002": "UKD",
    "E12000003": "UKE",
    "E12000004": "UKF",
    "E12000005": "UKG",
    "E12000006": "UKH",
    "E12000007": "UKI",
    "E12000008": "UKJ",
    "E12000009": "UKK",
    "S92000003": "UKM",
    "W92000004": "UKL",
    "N92000002": "UKN",
}

UK_TO_E_CODE = {v: k for (k, v) in E_CODE_TO_UK.items()}

# TL codes (alternative ITL1 format) -> UK codes
TL_TO_UK = {
    "TLC": "UKC",
    "TLD": "UKD",
    "TLE": "UKE",
    "TLF": "UKF",
    "TLG": "UKG",
    "TLH": "UKH",
    "TLI": "UKI",
    "TLJ": "UKJ",
    "TLK": "UKK",
    "TLL": "UKL",
    "TLM": "UKM",
    "TLN": "UKN",
}
UK_TO_TL = {v: k for (k, v) in TL_TO_UK.items()}


# ITL1 region catalogue (hardcoded - stable geography)
ITL1_REGIONS = [
    {"region_code": "UK", "region_name": "United Kingdom", "level": "UK"},
    {"region_code": "UKC", "region_name": "North East", "level": "ITL1"},
    {"region_code": "UKD", "region_name": "North West", "level": "ITL1"},
    {"region_code": "UKE", "region_name": "Yorkshire and The Humber", "level": "ITL1"},
    {"region_code": "UKF", "region_name": "East Midlands", "level": "ITL1"},
    {"region_code": "UKG", "region_name": "West Midlands", "level": "ITL1"},
    {"region_code": "UKH", "region_name": "East of England", "level": "ITL1"},
    {"region_code": "UKI", "region_name": "London", "level": "ITL1"},
    {"region_code": "UKJ", "region_name": "South East", "level": "ITL1"},
    {"region_code": "UKK", "region_name": "South West", "level": "ITL1"},
    {"region_code": "UKL", "region_name": "Wales", "level": "ITL1"},
    {"region_code": "UKM", "region_name": "Scotland", "level": "ITL1"},
    {"region_code": "UKN", "region_name": "Northern Ireland", "level": "ITL1"},
]


def metric_classes() -> list[dict[str, Any]]:
    """
    Metric catalogue for the schema endpoint.
    v1: minimal catalogue. Expand here without changing the schema contract.
    """
    return [
        {
            "metric_id": "population_total",
            "name": "Total Population",
            "unit": "people",
            "type": "level",
            "scale": "count",
            "deflator": None,
        },
        {
            "metric_id": "nominal_gva_mn_gbp",
            "name": "Gross Value Added",
            "unit": "£m",
            "type": "level",
            "scale": "nominal",
            "deflator": None,
        },
        {
            "metric_id": "gdhi_per_head_gbp",
            "name": "Disposable Income (per head)",
            "unit": "£",
            "type": "level",
            "scale": "nominal",
            "deflator": None,
        },
        {
            "metric_id": "emp_total_jobs",
            "name": "Total Employment",
            "unit": "jobs",
            "type": "level",
            "scale": "count",
            "deflator": None,
        },
        # Future: add sector/age breakdown dims without changing endpoint shape.
    ]
