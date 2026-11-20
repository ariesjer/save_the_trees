"""Unit tests for HTML, PDF text, and JSON permit parsing."""

import pytest

from src.parser import (
    ParseError,
    normalize_date_to_iso,
    parse_html_tables,
    parse_json_bytes,
    parse_pdf_text,
    parse_yeela_json,
)


def test_normalize_date_to_iso():
    assert normalize_date_to_iso("19.11.26") == "2026-11-19"
    assert normalize_date_to_iso("03/04/2026") == "2026-04-03"
    assert normalize_date_to_iso("לא ידוע") == ""


def test_parse_html_tables_groups_trees_by_license():
    html = """
    <html><body>
      <table>
        <tr>
          <th>מספר רישיון</th>
          <th>כתובת</th>
          <th>גוש</th>
          <th>חלקה</th>
          <th>מין העץ</th>
          <th>כמות</th>
          <th>פעולה</th>
          <th>עילה</th>
          <th>תאריך פרסום</th>
          <th>מועד אחרון להשגה</th>
        </tr>
        <tr>
          <td>1008726</td>
          <td>הנרייטה סולד 12</td>
          <td>30149</td>
          <td>110</td>
          <td>ברוש מצוי</td>
          <td>4</td>
          <td>כריתה</td>
          <td>בנייה ופיתוח</td>
          <td>10.11.2026</td>
          <td>24.11.2026</td>
        </tr>
        <tr>
          <td>1008726</td>
          <td>הנרייטה סולד 12</td>
          <td>30149</td>
          <td>110</td>
          <td>זית אירופי</td>
          <td>1</td>
          <td>העתקה</td>
          <td>בנייה ופיתוח</td>
          <td>10.11.2026</td>
          <td>24.11.2026</td>
        </tr>
      </table>
    </body></html>
    """
    records = parse_html_tables(html, source_id="test_html", source_url="https://example.com")
    assert len(records) == 1
    rec = records[0]
    assert rec.license_number == "1008726"
    assert rec.site_address == "הנרייטה סולד 12"
    assert rec.publish_date == "2026-11-10"
    assert rec.appeal_deadline == "2026-11-24"
    assert len(rec.trees) == 2
    assert rec.trees[0].species == "ברוש מצוי"
    assert rec.trees[0].count == 4
    assert rec.trees[1].action == "העתקה"


def test_parse_pdf_text_extracts_fields():
    sample_text = """
    רישיון כריתה מס' 1009111
    כתובת: אברהם שטרן 8, ירושלים
    גוש: 30135 חלקה: 44
    תאריך פרסום: 12.11.2026
    מועד אחרון להשגה: 26.11.2026
    עילה: צורכי בנייה
    ברוש מצוי - 3 (כריתה)
    זית אירופי - 1 (העתקה)
    """
    records = parse_pdf_text(sample_text, source_id="pdf_src", source_url="https://example.com/1.pdf")
    assert len(records) == 1
    rec = records[0]
    assert rec.license_number == "1009111"
    assert rec.site_block == "30135"
    assert rec.site_parcel == "44"
    assert len(rec.trees) == 2


def test_parse_pdf_text_raises_on_empty_scanned_pdf():
    with pytest.raises(ParseError):
        parse_pdf_text("   \n  ", source_id="pdf_src", source_url="https://example.com/scan.pdf")


def test_parse_json_bytes():
    raw = b'{"results": [{"licenseNumber": "1009222", "siteAddress": "\xd7\x91\xd7\xa8\xd7\x96\xd7\x99\xd7\x9c 5", "trees": [{"species": "\xd7\x90\xd7\x95\xd7\xa8\xd7\x9f", "count": 2, "action": "\xd7\x9b\xd7\xa8\xd7\x99\xd7\xaa\xd7\x94"}]}]}'
    records = parse_json_bytes(raw, source_id="api", source_url="https://example.com/api")
    assert len(records) == 1
    assert records[0].license_number == "1009222"
    assert records[0].trees[0].count == 2


def test_parse_yeela_json_groups_species_and_actions():
    payload = {
        "pagination": {"currentPage": 1, "totalPages": 1, "itemsPerPage": 20, "totalCount": 2},
        "result": [
            {
                "requestId": 19628,
                "licenseId": 1009534,
                "treeName": "עוזרר קוצני",
                "unproot": 2,
                "copying": 0,
                "appealLastDate": "03/12/2026",
                "expandRows": [
                    {
                        "street": "הנרייטה סולד",
                        "homeNumber": "12",
                        "block": "30135",
                        "parcel": "110",
                        "requestReason": "בנייה ופיתוח",
                        "dateOLicensePublic": "19/11/2026",
                        "approvedBy": "פקיד/ת יערות רשותי",
                    }
                ],
            },
            {
                "requestId": 19628,
                "licenseId": 1009534,
                "treeName": "זית אירופי",
                "unproot": 0,
                "copying": 1,
                "appealLastDate": "03/12/2026",
                "expandRows": [
                    {
                        "street": "הנרייטה סולד",
                        "homeNumber": "12",
                        "block": "30135",
                        "parcel": "110",
                        "requestReason": "בנייה ופיתוח",
                        "dateOLicensePublic": "19/11/2026",
                        "approvedBy": "פקיד/ת יערות רשותי",
                    }
                ],
            },
        ],
    }
    records = parse_yeela_json(
        payload,
        source_id="yeela_moag_jerusalem_open",
        source_url="https://yeela-trees.moag.gov.il/FoPublic/FoLicence",
    )
    assert len(records) == 1
    rec = records[0]
    assert rec.license_number == "1009534"
    assert rec.site_address == "הנרייטה סולד 12"
    assert rec.site_block == "30135"
    assert rec.publish_date == "2026-11-19"
    assert rec.appeal_deadline == "2026-12-03"
    assert len(rec.trees) == 2
    assert rec.trees[0].action == "כריתה"
    assert rec.trees[1].action == "העתקה"

