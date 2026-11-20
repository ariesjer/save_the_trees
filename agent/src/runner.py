"""Main pipeline runner for Kiryat HaYovel tree-felling permit monitoring."""

import json
import os
from pathlib import Path

from .analyzer import evaluate_urgency
from .fetcher import FetchError, fetch_source
from .geo_filter import load_geo_config, match_kiryat_hayovel
from .models import GeoStatus, PermitRecord
from .notifier import build_appeal_url, format_alert_message, send_alert
from .parser import ParseError, parse_fetched_source
from .state_store import StateStore


def process_records(
    records: list[PermitRecord],
    geo_config: dict,
    store: StateStore,
    appeal_base_url: str,
) -> int:
    """Filter, deduplicate, analyze, and notify for a list of PermitRecords."""
    notified_count = 0
    for record in records:
        if not record.license_number:
            continue

        geo_result = match_kiryat_hayovel(
            address=record.site_address,
            block=record.site_block,
            notes=record.notes,
            config=geo_config,
        )
        if geo_result.status == GeoStatus.NO_MATCH:
            continue

        if not store.should_notify(record):
            continue

        urgency, review_points = evaluate_urgency(record, geo_config)
        appeal_url = build_appeal_url(record, appeal_base_url)
        message = format_alert_message(
            record=record,
            geo_result=geo_result,
            urgency=urgency,
            review_points=review_points,
            appeal_url=appeal_url,
        )
        send_alert(message)
        store.mark_notified(record, geo_result.status.value)
        notified_count += 1

    return notified_count


def run_pipeline() -> None:
    agent_dir = Path(__file__).resolve().parent.parent
    geo_config = load_geo_config(agent_dir / "config" / "kiryat_hayovel.json")
    sources_path = agent_dir / "config" / "sources.json"
    sources = json.loads(sources_path.read_text(encoding="utf-8")).get("sources", [])

    db_path = agent_dir / os.getenv("PERMITS_DB_PATH", "data/permits.db")
    appeal_base_url = os.getenv(
        "APPEAL_APP_BASE_URL",
        "../index.html",
    )

    store = StateStore(db_path)
    try:
        all_records: list[PermitRecord] = []
        errors: list[str] = []

        for source in sources:
            if not source.get("enabled", True):
                continue
            try:
                fetched = fetch_source(source)
                all_records.extend(parse_fetched_source(fetched))
            except (FetchError, ParseError) as exc:
                errors.append(str(exc))

        count = process_records(all_records, geo_config, store, appeal_base_url)
        print(f"סיום ריצה: נשלחו {count} התראות חדשות.")

        if errors:
            error_msg = "⚠️ שגיאות טכניות בסריקת המקורות:\n" + "\n".join(f"- {e}" for e in errors)
            send_alert(error_msg)
    finally:
        store.close()


if __name__ == "__main__":
    run_pipeline()
