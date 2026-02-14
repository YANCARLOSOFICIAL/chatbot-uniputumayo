from pydantic import BaseModel
from typing import Generic, TypeVar

T = TypeVar("T")


class PaginatedResponse(BaseModel, Generic[T]):
    items: list[T]
    total: int
    page: int
    per_page: int


class HealthServiceStatus(BaseModel):
    status: str
    latency_ms: float | None = None


class HealthResponse(BaseModel):
    status: str
    services: dict[str, HealthServiceStatus]
    timestamp: str
