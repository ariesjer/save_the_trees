"""Rule-based & extensible permit analyzer (urgency and review points)."""

from datetime import date
from typing import Any

from .models import PermitRecord, UrgencyLevel


def days_remaining(appeal_deadline: str, today: date | None = None) -> int | None:
    """Return days left until appeal_deadline (ISO YYYY-MM-DD), or None if unknown."""
    if not appeal_deadline:
        return None
    try:
        deadline = date.fromisoformat(appeal_deadline.strip())
    except ValueError:
        return None
    ref = today or date.today()
    return (deadline - ref).days


def evaluate_urgency(
    record: PermitRecord,
    geo_config: dict[str, Any],
    today: date | None = None,
) -> tuple[UrgencyLevel, list[str]]:
    """Compute urgency level and concrete review points for an appeal."""
    total_felling = sum(t.count for t in record.trees if t.action == "כריתה")
    high_value = [k.lower() for k in geo_config.get("high_value_species", [])]
    has_valuable_species = any(
        any(hv in t.species.lower() for hv in high_value)
        for t in record.trees
        if t.action == "כריתה"
    )
    remaining = days_remaining(record.appeal_deadline, today=today)

    notes: list[str] = []
    if remaining is not None and remaining <= 5:
        notes.append(f"חלון ההשגה קצר מאוד (נותרו {max(remaining, 0)} ימים).")
    if total_felling >= 5:
        notes.append(f"כריתה נרחבת של {total_felling} עצים — יש לבדוק חלופות תכנון והעתקה.")
    if has_valuable_species:
        notes.append("מעורבים מיני עצים ערכיים/בוגרים — מומלץ להצליב מול סקר העצים המצורף.")
    if not notes:
        notes.append("מומלץ לבדוק התאמה בין מספר העצים המבוקש לתכנית הפיתוח המאושרת.")

    if (remaining is not None and remaining <= 5) or total_felling >= 5 or has_valuable_species:
        return UrgencyLevel.HIGH, notes
    if (remaining is not None and remaining <= 10) or 2 <= total_felling <= 4:
        return UrgencyLevel.MEDIUM, notes
    return UrgencyLevel.LOW, notes
