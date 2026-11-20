"""SQLite-backed state store for deduplicating permits and tracking changes."""

import hashlib
import json
import sqlite3
from dataclasses import asdict
from datetime import datetime, timezone
from pathlib import Path

from .models import PermitRecord


class StateStore:
    """Persists seen permits and prevents duplicate notifications."""

    def __init__(self, db_path: str | Path) -> None:
        self.db_path = Path(db_path)
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._conn = sqlite3.connect(self.db_path)
        self._init_schema()

    def _init_schema(self) -> None:
        self._conn.execute(
            """
            CREATE TABLE IF NOT EXISTS permits (
                license_number TEXT PRIMARY KEY,
                payload_hash TEXT NOT NULL,
                status TEXT NOT NULL,
                geo_status TEXT NOT NULL,
                raw_json TEXT NOT NULL,
                first_seen_at TEXT NOT NULL,
                last_updated_at TEXT NOT NULL
            )
            """
        )
        self._conn.commit()

    @staticmethod
    def _compute_hash(record: PermitRecord) -> str:
        relevant = {
            "site_address": record.site_address,
            "site_block": record.site_block,
            "site_parcel": record.site_parcel,
            "trees": [asdict(t) for t in record.trees],
            "reasons": record.reasons,
            "appeal_deadline": record.appeal_deadline,
        }
        serialized = json.dumps(relevant, ensure_ascii=False, sort_keys=True)
        return hashlib.sha256(serialized.encode("utf-8")).hexdigest()

    def should_notify(self, record: PermitRecord) -> bool:
        """Return True if the permit is new or has materially changed."""
        cur = self._conn.execute(
            "SELECT payload_hash, status FROM permits WHERE license_number = ?",
            (record.license_number,),
        )
        row = cur.fetchone()
        if row is None:
            return True
        existing_hash, status = row
        if status == "EXPIRED":
            return False
        return existing_hash != self._compute_hash(record)

    def mark_notified(self, record: PermitRecord, geo_status: str) -> None:
        now = datetime.now(timezone.utc).isoformat()
        payload_hash = self._compute_hash(record)
        raw_json = json.dumps(
            {
                "license_number": record.license_number,
                "site_address": record.site_address,
                "site_block": record.site_block,
                "site_parcel": record.site_parcel,
                "trees": [asdict(t) for t in record.trees],
                "reasons": record.reasons,
                "publish_date": record.publish_date,
                "appeal_deadline": record.appeal_deadline,
                "source_id": record.source_id,
                "source_url": record.source_url,
            },
            ensure_ascii=False,
        )
        self._conn.execute(
            """
            INSERT INTO permits (
                license_number, payload_hash, status, geo_status,
                raw_json, first_seen_at, last_updated_at
            ) VALUES (?, ?, 'NOTIFIED', ?, ?, ?, ?)
            ON CONFLICT(license_number) DO UPDATE SET
                payload_hash = excluded.payload_hash,
                status = 'NOTIFIED',
                geo_status = excluded.geo_status,
                raw_json = excluded.raw_json,
                last_updated_at = excluded.last_updated_at
            """,
            (record.license_number, payload_hash, geo_status, raw_json, now, now),
        )
        self._conn.commit()

    def close(self) -> None:
        self._conn.close()
