"""Source fetcher for tree permit portals (GET HTML/PDF and POST JSON APIs)."""

from dataclasses import dataclass
from typing import Any

import httpx


class FetchError(RuntimeError):
    """Raised when a source cannot be fetched cleanly."""


@dataclass(frozen=True)
class FetchedSource:
    source_id: str
    source_url: str
    content_type: str
    raw_bytes: bytes
    portal_url: str = ""


def fetch_source(source: dict[str, Any], timeout: float = 25.0) -> FetchedSource:
    """Fetch raw content from a configured source URL (supports GET and POST JSON)."""
    url = source["url"]
    source_id = source["id"]
    method = str(source.get("method", "GET")).upper()
    portal_url = str(source.get("portal_url") or url)
    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
        ),
        "Accept": "application/json, text/plain, */*",
        "Accept-Language": "he-IL,he;q=0.9,en-US;q=0.8,en;q=0.7",
        "Origin": "https://yeela-trees.moag.gov.il",
        "Referer": portal_url,
    }

    try:
        if method == "POST":
            response = httpx.post(
                url,
                json=source.get("payload") or {},
                timeout=timeout,
                follow_redirects=True,
                headers=headers,
            )
        else:
            response = httpx.get(
                url,
                timeout=timeout,
                follow_redirects=True,
                headers=headers,
            )
        response.raise_for_status()
    except httpx.HTTPError as exc:
        raise FetchError(f"כשל במשיכת מקור {source_id} ({url}): {exc}") from exc

    content_type = response.headers.get("content-type", "")
    return FetchedSource(
        source_id=source_id,
        source_url=str(response.url),
        content_type=content_type,
        raw_bytes=response.content,
        portal_url=portal_url,
    )
