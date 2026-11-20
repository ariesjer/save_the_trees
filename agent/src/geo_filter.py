"""Geographic filter for Kiryat HaYovel, Jerusalem."""

import json
import re
from pathlib import Path
from typing import Any

from .models import GeoMatchResult, GeoStatus

_PREFIX_PATTERN = re.compile(r"\b(?:רחוב|רח['׳]?|שדרות|שד['׳]?|דרך|סמטת)\s+")
_PUNCT_PATTERN = re.compile(r"[\"״'׳,.\-–—/\\()]+")
_SPACE_PATTERN = re.compile(r"\s+")


def normalize_hebrew_text(text: str) -> str:
    """Normalize Hebrew street/location text for resilient matching."""
    if not text:
        return ""
    cleaned = _PUNCT_PATTERN.sub(" ", text.strip())
    cleaned = _PREFIX_PATTERN.sub(" ", cleaned)
    cleaned = _SPACE_PATTERN.sub(" ", cleaned).strip()
    return cleaned


def load_geo_config(config_path: str | Path) -> dict[str, Any]:
    with Path(config_path).open("r", encoding="utf-8") as fh:
        return json.load(fh)


def _contains_term(haystack: str, term: str) -> bool:
    norm_term = normalize_hebrew_text(term)
    if not norm_term:
        return False
    pattern = rf"(?:^|\s){re.escape(norm_term)}(?:\s|\d|$)"
    return bool(re.search(pattern, haystack))


def match_kiryat_hayovel(
    address: str,
    block: str = "",
    notes: str = "",
    config: dict[str, Any] | None = None,
) -> GeoMatchResult:
    """Determine whether a permit belongs to Kiryat HaYovel."""
    if config is None:
        default_path = Path(__file__).resolve().parent.parent / "config" / "kiryat_hayovel.json"
        config = load_geo_config(default_path)

    norm_address = normalize_hebrew_text(address)
    norm_notes = normalize_hebrew_text(notes)
    combined = f"{norm_address} {norm_notes}".strip()
    norm_block = str(block).strip()

    # 1. Explicit neighborhood keyword or landmark
    for kw in config.get("neighborhood_keywords", []):
        if _contains_term(combined, kw):
            return GeoMatchResult(GeoStatus.MATCH, f"התאמת מילת מפתח שכונתית: {kw}")

    # 2. Land block match
    if norm_block and norm_block in set(map(str, config.get("blocks", []))):
        return GeoMatchResult(GeoStatus.MATCH, f"התאמת גוש מקרקעין: {norm_block}")

    # 3. Known Kiryat HaYovel street match
    for street in config.get("streets", []):
        if _contains_term(norm_address, street):
            return GeoMatchResult(GeoStatus.MATCH, f"התאמת רחוב בשכונה: {street}")

    # 4. Borderline / cross-neighborhood street match
    for street in config.get("borderline_streets", []):
        if _contains_term(norm_address, street):
            return GeoMatchResult(
                GeoStatus.BORDERLINE,
                f"רחוב גבולי הדורש אימות מיקום: {street}",
            )

    return GeoMatchResult(GeoStatus.NO_MATCH, "לא נמצאה התאמה לקריית היובל")
