from __future__ import annotations

import json
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Any


REPO_ROOT = Path(__file__).resolve().parents[2]

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


def load_itl_to_lad() -> dict[str, Any]:
    path = REPO_ROOT / "public" / "processed" / "itl_to_lad.json"
    if not path.exists():
        return {"ITL1": {}, "ITL2": {}, "ITL3": {}}
    return json.loads(path.read_text())


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

# ITL1 in itl_to_lad.json is TL* group codes
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


def metric_classes() -> list[dict[str, Any]]:
    # v1: minimal catalogue. Expand here without changing the schema contract.
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


def region_hierarchy() -> dict[str, str]:
    """
    Returns mapping: child_region_code -> parent_region_code (ITL1) for LAD/ITL2/ITL3.
    Uses itl_to_lad.json to infer ITL1 parents by membership.
    """
    m = {}
    mapping = load_itl_to_lad()
    itl1 = mapping.get("ITL1", {})
    # invert LAD -> ITL1(TL*) then to UK*
    for tl_code, lads in itl1.items():
        parent = TL_TO_UK.get(tl_code)
        if not parent:
            continue
        for lad in lads:
            m[lad] = parent
    # ITL2/ITL3 parents: inferred by their LAD membership mode (simplified: first parent)
    for level in ("ITL2", "ITL3"):
        for itl_code, lads in mapping.get(level, {}).items():
            for lad in lads:
                if lad in m:
                    m[itl_code] = m[lad]
                    break
    return m


