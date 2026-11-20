"""Alert formatting, Telegram delivery, and tree-appeal-app URL builder."""

import json
import os
from dataclasses import asdict
from urllib.parse import urlencode

import httpx

from .analyzer import days_remaining
from .models import GeoMatchResult, GeoStatus, PermitRecord, UrgencyLevel

_URGENCY_BADGE = {
    UrgencyLevel.HIGH: "🔴 דחוף מאוד",
    UrgencyLevel.MEDIUM: "🟠 בינוני",
    UrgencyLevel.LOW: "🟡 רגיל",
}


def build_appeal_url(record: PermitRecord, base_url: str) -> str:
    """Build a pre-filled URL for the tree-appeal-app frontend."""
    params: dict[str, str] = {"licenseNumber": record.license_number}
    if record.site_address:
        params["siteAddress"] = record.site_address
    if record.site_block:
        params["siteBlock"] = record.site_block
    if record.site_parcel:
        params["siteParcel"] = record.site_parcel
    if record.trees:
        params["trees"] = json.dumps([asdict(t) for t in record.trees], ensure_ascii=False)
    if record.reasons:
        params["reasons"] = json.dumps(record.reasons, ensure_ascii=False)

    separator = "&" if "?" in base_url else "?"
    return f"{base_url}{separator}{urlencode(params)}"


def format_alert_message(
    record: PermitRecord,
    geo_result: GeoMatchResult,
    urgency: UrgencyLevel,
    review_points: list[str],
    appeal_url: str,
) -> str:
    """Format a structured Hebrew alert message following AGENT_INSTRUCTIONS.md."""
    badge = _URGENCY_BADGE[urgency]
    borderline_tag = " [גבולי — דורש אימות מיקום]" if geo_result.status == GeoStatus.BORDERLINE else ""

    trees_lines = [
        f"  • {t.species or 'לא צוין מין'}: {t.count} ({t.action})"
        for t in record.trees
    ] or ["  • לא צוין במקור"]
    total_trees = sum(t.count for t in record.trees)

    remaining = days_remaining(record.appeal_deadline)
    deadline_str = record.appeal_deadline or "לא צוין במקור"
    if remaining is not None:
        deadline_str = f"{deadline_str} (נותרו {max(remaining, 0)} ימים)"

    lines = [
        f"[{badge}] רישיון כריתה/העתקה בקריית היובל — מס' {record.license_number}{borderline_tag}",
        f"מיקום: {record.site_address or 'לא צוין במקור'} | גוש: {record.site_block or 'לא צוין'} | חלקה: {record.site_parcel or 'לא צוין'}",
        f"פירוט עצים (סה\"כ {total_trees}):",
        *trees_lines,
        f"עילה מוצהרת: {', '.join(record.reasons) if record.reasons else 'לא צוין במקור'}",
        f"פרסום: {record.publish_date or 'לא צוין במקור'} | מועד אחרון להשגה: {deadline_str}",
        "נקודות לבדיקה בהשגה:",
        *[f"  - {pt}" for pt in review_points],
        f"מקור: {record.source_url or 'לא צוין'}",
        f"להגשת השגה מהירה (טופס ממולא מראש): {appeal_url}",
    ]
    return "\n".join(lines)


def send_alert(message: str) -> None:
    """Send alert via Telegram if configured, otherwise print to stdout."""
    token = os.getenv("TELEGRAM_BOT_TOKEN", "").strip()
    chat_id = os.getenv("TELEGRAM_CHAT_ID", "").strip()
    if not token or not chat_id:
        print(message)
        print("-" * 60)
        return

    url = f"https://api.telegram.org/bot{token}/sendMessage"
    resp = httpx.post(
        url,
        json={"chat_id": chat_id, "text": message, "disable_web_page_preview": True},
        timeout=15.0,
    )
    resp.raise_for_status()
