from __future__ import annotations

from typing import Any, Literal, Optional
from pydantic import BaseModel, Field


# ----------------------------
# Error semantics (domain)
# ----------------------------

class ErrorPayload(BaseModel):
    code: str
    message: str
    details: dict[str, Any] = Field(default_factory=dict)


class ErrorResponse(BaseModel):
    error: ErrorPayload


# ----------------------------
# PxWeb-like query grammar
# ----------------------------

FilterType = Literal["item", "all", "range"]


class SelectionItem(BaseModel):
    filter: Literal["item"]
    values: list[str]


class SelectionAll(BaseModel):
    filter: Literal["all"]


class SelectionRange(BaseModel):
    filter: Literal["range"]
    from_: str = Field(alias="from")
    to: str


Selection = SelectionItem | SelectionAll | SelectionRange


DimCode = Literal[
    "metric",
    "region",
    "geo_schema",
    "level",
    "time_period",
    "scenario",
    "measure",
    "data_type",
    "breakdown_type",
    "breakdown_value",
]


class QueryDim(BaseModel):
    code: DimCode
    selection: Selection


class QueryRequest(BaseModel):
    query: list[QueryDim]
    response: dict[str, Any] = Field(default_factory=lambda: {"format": "records"})
    limit: int = 50_000
    cursor: Optional[int] = None


class ObservationRecord(BaseModel):
    metric_id: str
    region_code: str
    geo_schema: str
    level: str
    time_period: int
    scenario: str
    measure: str
    value: Optional[float] = None
    unit: Optional[str] = None
    data_type: Optional[str] = None
    data_quality: Optional[str] = None
    confidence_lower: Optional[float] = None
    confidence_upper: Optional[float] = None
    breakdown_type: Optional[str] = None
    breakdown_value: Optional[str] = None


class ResponseMeta(BaseModel):
    vintage: str
    generated_at: str
    source: str
    status: Literal["final", "provisional", "experimental"]
    estimated_records: int
    returned_records: int
    truncated: bool
    warnings: list[str] = Field(default_factory=list)
    citation: str
    url: str
    accessed_at: str
    next_cursor: Optional[int] = None


class QueryResponse(BaseModel):
    meta: ResponseMeta
    data: list[ObservationRecord]


class SchemaResponse(BaseModel):
    version: str
    generated_at: str
    vintage: str
    source: str
    status: Literal["final", "provisional", "experimental"]
    metrics: list[dict[str, Any]]
    regions: list[dict[str, Any]]
    scenarios: list[str]
    measures: list[str]
    breakdowns: list[dict[str, Any]]
    time_coverage: dict[str, Any]
    compatibility: dict[str, Any]


