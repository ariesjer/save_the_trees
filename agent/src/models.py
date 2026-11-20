"""Core data models for the tree permit monitoring pipeline."""

from dataclasses import dataclass, field
from enum import Enum
from typing import Literal


class GeoStatus(str, Enum):
    MATCH = "MATCH"
    BORDERLINE = "BORDERLINE"
    NO_MATCH = "NO_MATCH"


class UrgencyLevel(str, Enum):
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"


@dataclass(frozen=True)
class TreeItem:
    species: str
    count: int = 1
    action: Literal["כריתה", "העתקה"] = "כריתה"


@dataclass
class PermitRecord:
    license_number: str
    site_address: str = ""
    site_block: str = ""
    site_parcel: str = ""
    trees: list[TreeItem] = field(default_factory=list)
    reasons: list[str] = field(default_factory=list)
    publish_date: str = ""        # ISO YYYY-MM-DD when available
    appeal_deadline: str = ""     # ISO YYYY-MM-DD when available
    source_id: str = ""
    source_url: str = ""
    notes: str = ""


@dataclass(frozen=True)
class GeoMatchResult:
    status: GeoStatus
    reason: str
