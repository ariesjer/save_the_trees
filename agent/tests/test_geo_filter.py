"""Unit tests for Kiryat HaYovel geo-filtering, state deduplication, and URL generation."""

from pathlib import Path
from urllib.parse import parse_qs, urlparse

from src.geo_filter import load_geo_config, match_kiryat_hayovel, normalize_hebrew_text
from src.models import GeoStatus, PermitRecord, TreeItem
from src.notifier import build_appeal_url
from src.state_store import StateStore

CONFIG_PATH = Path(__file__).resolve().parent.parent / "config" / "kiryat_hayovel.json"


def test_normalize_hebrew_text_strips_prefixes_and_punctuation():
    assert normalize_hebrew_text('רח\' הנרייטה סולד 12') == "הנרייטה סולד 12"
    assert normalize_hebrew_text("שד' הרצל 90") == "הרצל 90"
    assert normalize_hebrew_text("רחוב אברהם שטרן 5") == "אברהם שטרן 5"


def test_match_kiryat_hayovel_street():
    cfg = load_geo_config(CONFIG_PATH)
    res = match_kiryat_hayovel("רח' יעקב טהון 14, ירושלים", config=cfg)
    assert res.status == GeoStatus.MATCH


def test_match_kiryat_hayovel_borderline():
    cfg = load_geo_config(CONFIG_PATH)
    res = match_kiryat_hayovel("שדרות הרצל 102", config=cfg)
    assert res.status == GeoStatus.BORDERLINE


def test_no_match_other_neighborhood():
    cfg = load_geo_config(CONFIG_PATH)
    res = match_kiryat_hayovel("עמק רפאים 22, המושבה הגרמנית", block="30010", config=cfg)
    assert res.status == GeoStatus.NO_MATCH


def test_state_store_deduplication(tmp_path: Path):
    store = StateStore(tmp_path / "permits.db")
    record = PermitRecord(
        license_number="1009999",
        site_address="אורוגוואי 3",
        trees=[TreeItem(species="ברוש מצוי", count=2, action="כריתה")],
    )
    assert store.should_notify(record) is True
    store.mark_notified(record, GeoStatus.MATCH.value)
    assert store.should_notify(record) is False

    # Material change (count increased) should trigger re-notification
    updated = PermitRecord(
        license_number="1009999",
        site_address="אורוגוואי 3",
        trees=[TreeItem(species="ברוש מצוי", count=4, action="כריתה")],
    )
    assert store.should_notify(updated) is True
    store.close()


def test_build_appeal_url_contains_expected_params():
    record = PermitRecord(
        license_number="1008726",
        site_address="הנרייטה סולד 12",
        site_block="30149",
        site_parcel="110",
        trees=[TreeItem(species="ברוש מצוי", count=3, action="כריתה")],
    )
    url = build_appeal_url(record, "https://example.com/index.html")
    parsed = urlparse(url)
    qs = parse_qs(parsed.query)
    assert qs["licenseNumber"] == ["1008726"]
    assert qs["siteAddress"] == ["הנרייטה סולד 12"]
    assert qs["siteBlock"] == ["30149"]
    assert "ברוש מצוי" in qs["trees"][0]
