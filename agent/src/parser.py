"""HTML, PDF, and JSON parsers for tree-felling permit sources."""

import io
import json
import re
from typing import Any

from bs4 import BeautifulSoup
from pypdf import PdfReader

from .fetcher import FetchedSource
from .models import PermitRecord, TreeItem


class ParseError(RuntimeError):
    """Raised when a fetched source cannot be parsed (e.g., scanned PDF requiring OCR)."""


_DATE_RE = re.compile(r"\b(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})\b")
_LICENSE_RE = re.compile(r"(?:מספר\s*רישיון|רישיון\s*מס['׳]?|מס['׳]?\s*רישיון)\s*[:\-]?\s*(\d{5,9})")
_ADDRESS_RE = re.compile(r"(?:כתובת|מיקום|רחוב)\s*[:\-]\s*([^\n\r|]+)")
_BLOCK_RE = re.compile(r"גוש\s*[:\-]?\s*(\d{4,6})")
_PARCEL_RE = re.compile(r"חלקה\s*[:\-]?\s*([\d\s,\-–]+)")
_PUBLISH_DATE_RE = re.compile(r"(?:תאריך\s*פרסום|פורסם\s*ב)\s*[:\-]?\s*(\d{1,2}[./-]\d{1,2}[./-]\d{2,4})")
_DEADLINE_RE = re.compile(r"(?:מועד\s*אחרון\s*להשגה|תאריך\s*אחרון\s*להגשת\s*השגה)\s*[:\-]?\s*(\d{1,2}[./-]\d{1,2}[./-]\d{2,4})")
_REASON_RE = re.compile(r"(?:עילה|סיבת\s*הכריתה|סיבה)\s*[:\-]\s*([^\n\r]+)")
_TREE_LINE_RE = re.compile(
    r"(?P<species>[א-ת\s\"'׳\-]{2,40}?)\s*[-–:|]\s*(?P<count>\d+)\s*(?:עצים|עץ)?\s*(?:\((?P<action>כריתה|העתקה)\)|[-–]\s*(?P<action2>כריתה|העתקה))?"
)


def normalize_date_to_iso(raw_date: str) -> str:
    """Convert DD.MM.YY / DD/MM/YYYY to YYYY-MM-DD, or return empty string if invalid."""
    match = _DATE_RE.search(raw_date or "")
    if not match:
        return ""
    day, month, year = int(match.group(1)), int(match.group(2)), int(match.group(3))
    if year < 100:
        year += 2000
    if not (1 <= month <= 12 and 1 <= day <= 31):
        return ""
    return f"{year:04d}-{month:02d}-{day:02d}"


def parse_permit_dict(raw: dict[str, Any], source_id: str = "", source_url: str = "") -> PermitRecord:
    """Convert a raw dictionary (from API/JSON/table row) into a PermitRecord."""
    trees = [
        TreeItem(
            species=str(t.get("species", "")).strip(),
            count=max(1, int(t.get("count", 1) or 1)),
            action="העתקה" if t.get("action") == "העתקה" else "כריתה",
        )
        for t in raw.get("trees", [])
        if isinstance(t, dict)
    ]
    reasons = [str(r).strip() for r in raw.get("reasons", []) if str(r).strip()]

    raw_pub = str(raw.get("publishDate") or raw.get("publish_date") or "").strip()
    raw_dead = str(raw.get("appealDeadline") or raw.get("appeal_deadline") or "").strip()

    return PermitRecord(
        license_number=str(raw.get("licenseNumber") or raw.get("license_number") or "").strip(),
        site_address=str(raw.get("siteAddress") or raw.get("site_address") or "").strip(),
        site_block=str(raw.get("siteBlock") or raw.get("site_block") or "").strip(),
        site_parcel=str(raw.get("siteParcel") or raw.get("site_parcel") or "").strip(),
        trees=trees,
        reasons=reasons,
        publish_date=normalize_date_to_iso(raw_pub) or raw_pub,
        appeal_deadline=normalize_date_to_iso(raw_dead) or raw_dead,
        source_id=source_id or str(raw.get("source_id", "")),
        source_url=source_url or str(raw.get("source_url", "")),
        notes=str(raw.get("notes", "")).strip(),
    )


def _map_header(header_text: str) -> str:
    h = header_text.strip()
    if "רישיון" in h:
        return "license_number"
    if "כתובת" in h or "מיקום" in h or "רחוב" in h:
        return "site_address"
    if "גוש" in h:
        return "site_block"
    if "חלקה" in h:
        return "site_parcel"
    if "מין" in h or "סוג עץ" in h:
        return "species"
    if "כמות" in h or "מספר עצים" in h or "מס' עצים" in h:
        return "count"
    if "פעולה" in h or "סוג בקשה" in h:
        return "action"
    if "סיבה" in h or "עילה" in h:
        return "reason"
    if "פרסום" in h:
        return "publish_date"
    if "אחרון" in h or "השגה" in h:
        return "appeal_deadline"
    return ""


def parse_html_tables(html_text: str, source_id: str = "", source_url: str = "") -> list[PermitRecord]:
    """Extract and group permit rows from HTML tables."""
    soup = BeautifulSoup(html_text, "html.parser")
    grouped: dict[str, PermitRecord] = {}

    for table in soup.find_all("table"):
        rows = table.find_all("tr")
        if len(rows) < 2:
            continue

        header_cells = rows[0].find_all(["th", "td"])
        col_map = [_map_header(c.get_text(" ", strip=True)) for c in header_cells]
        if "license_number" not in col_map:
            continue

        for tr in rows[1:]:
            cells = [c.get_text(" ", strip=True) for c in tr.find_all(["td", "th"])]
            if len(cells) != len(col_map):
                continue

            row_data: dict[str, str] = {}
            for col_name, val in zip(col_map, cells):
                if col_name and val:
                    row_data[col_name] = val

            lic = row_data.get("license_number", "").strip()
            if not lic:
                continue

            if lic not in grouped:
                reasons = [row_data["reason"]] if row_data.get("reason") else []
                grouped[lic] = PermitRecord(
                    license_number=lic,
                    site_address=row_data.get("site_address", ""),
                    site_block=row_data.get("site_block", ""),
                    site_parcel=row_data.get("site_parcel", ""),
                    reasons=reasons,
                    publish_date=normalize_date_to_iso(row_data.get("publish_date", "")),
                    appeal_deadline=normalize_date_to_iso(row_data.get("appeal_deadline", "")),
                    source_id=source_id,
                    source_url=source_url,
                )

            species = row_data.get("species", "")
            if species:
                raw_count = re.sub(r"\D", "", row_data.get("count", "1"))
                count = max(1, int(raw_count)) if raw_count else 1
                action = "העתקה" if "העתק" in row_data.get("action", "") else "כריתה"
                grouped[lic].trees.append(TreeItem(species=species, count=count, action=action))

    return list(grouped.values())


def parse_pdf_text(text: str, source_id: str = "", source_url: str = "") -> list[PermitRecord]:
    """Parse extracted Hebrew PDF text into one or more PermitRecord objects."""
    if not text or not text.strip():
        raise ParseError(f"קובץ PDF ריק מטקסט (כנראה סרוק ודורש OCR): {source_url or source_id}")

    lic_match = _LICENSE_RE.search(text)
    if not lic_match:
        return []

    license_number = lic_match.group(1)
    addr_match = _ADDRESS_RE.search(text)
    block_match = _BLOCK_RE.search(text)
    parcel_match = _PARCEL_RE.search(text)
    pub_match = _PUBLISH_DATE_RE.search(text)
    dead_match = _DEADLINE_RE.search(text)
    reason_match = _REASON_RE.search(text)

    trees: list[TreeItem] = []
    for line in text.splitlines():
        m = _TREE_LINE_RE.search(line.strip())
        if not m:
            continue
        species = m.group("species").strip()
        if any(skip in species for skip in ("רישיון", "גוש", "חלקה", "כתובת", "תאריך")):
            continue
        action_raw = m.group("action") or m.group("action2") or "כריתה"
        action = "העתקה" if "העתק" in action_raw else "כריתה"
        trees.append(TreeItem(species=species, count=max(1, int(m.group("count"))), action=action))

    return [
        PermitRecord(
            license_number=license_number,
            site_address=addr_match.group(1).strip() if addr_match else "",
            site_block=block_match.group(1).strip() if block_match else "",
            site_parcel=parcel_match.group(1).strip() if parcel_match else "",
            trees=trees,
            reasons=[reason_match.group(1).strip()] if reason_match else [],
            publish_date=normalize_date_to_iso(pub_match.group(1)) if pub_match else "",
            appeal_deadline=normalize_date_to_iso(dead_match.group(1)) if dead_match else "",
            source_id=source_id,
            source_url=source_url,
        )
    ]


def parse_pdf_bytes(pdf_bytes: bytes, source_id: str = "", source_url: str = "") -> list[PermitRecord]:
    """Extract text from PDF bytes using pypdf and parse permits."""
    reader = PdfReader(io.BytesIO(pdf_bytes))
    extracted = "\n".join(page.extract_text() or "" for page in reader.pages)
    return parse_pdf_text(extracted, source_id=source_id, source_url=source_url)


def parse_yeela_json(
    payload: dict[str, Any],
    source_id: str = "",
    source_url: str = "",
) -> list[PermitRecord]:
    """Parse response from Yeela's getFOGridPublicityLicenses JSON API."""
    rows = payload.get("result") or []
    grouped: dict[str, PermitRecord] = {}

    for row in rows:
        if not isinstance(row, dict):
            continue
        lic = str(row.get("licenseId") or row.get("requestId") or "").strip()
        if not lic:
            continue

        expand = (row.get("expandRows") or [{}])[0]
        if not isinstance(expand, dict):
            expand = {}

        if lic not in grouped:
            street = str(expand.get("street") or "").strip()
            home_num = str(expand.get("homeNumber") or "").strip()
            address = f"{street} {home_num}".strip() if street or home_num else ""
            reason = str(expand.get("requestReason") or "").strip()
            pub_raw = str(expand.get("dateOLicensePublic") or row.get("approvedDate") or "")
            dead_raw = str(row.get("appealLastDate") or "")
            approver = str(expand.get("approvedBy") or "").strip()

            grouped[lic] = PermitRecord(
                license_number=lic,
                site_address=address,
                site_block=str(expand.get("block") or "").strip(),
                site_parcel=str(expand.get("parcel") or "").strip(),
                reasons=[reason] if reason else [],
                publish_date=normalize_date_to_iso(pub_raw),
                appeal_deadline=normalize_date_to_iso(dead_raw),
                source_id=source_id,
                source_url=source_url,
                notes=f"מאשר: {approver}" if approver else "",
            )

        species = str(row.get("treeName") or "").strip()
        if species:
            felling_count = int(row.get("unproot") or 0)
            copying_count = int(row.get("copying") or 0)
            if felling_count > 0:
                grouped[lic].trees.append(
                    TreeItem(species=species, count=felling_count, action="כריתה")
                )
            if copying_count > 0:
                grouped[lic].trees.append(
                    TreeItem(species=species, count=copying_count, action="העתקה")
                )

    return list(grouped.values())


def parse_json_bytes(json_bytes: bytes, source_id: str = "", source_url: str = "") -> list[PermitRecord]:
    """Parse JSON API payload into PermitRecord items."""
    payload = json.loads(json_bytes.decode("utf-8"))
    if isinstance(payload, dict) and "result" in payload and "pagination" in payload:
        return parse_yeela_json(payload, source_id=source_id, source_url=source_url)

    if isinstance(payload, dict):
        items = payload.get("results") or payload.get("data") or payload.get("items") or []
    elif isinstance(payload, list):
        items = payload
    else:
        items = []

    return [
        parse_permit_dict(item, source_id=source_id, source_url=source_url)
        for item in items
        if isinstance(item, dict)
    ]


def parse_fetched_source(fetched: FetchedSource) -> list[PermitRecord]:
    """Dispatch fetched content to the appropriate parser by content type."""
    ctype = fetched.content_type.lower()
    display_url = fetched.portal_url or fetched.source_url
    if "application/pdf" in ctype or fetched.source_url.lower().endswith(".pdf"):
        return parse_pdf_bytes(fetched.raw_bytes, fetched.source_id, display_url)
    if "application/json" in ctype or fetched.source_url.lower().endswith(".json"):
        return parse_json_bytes(fetched.raw_bytes, fetched.source_id, display_url)
    html_text = fetched.raw_bytes.decode("utf-8", errors="replace")
    return parse_html_tables(html_text, fetched.source_id, display_url)
