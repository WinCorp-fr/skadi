"""Tests pour le scraper fetes_medievales — parsing HTML en ScrapedEvent."""

from datetime import datetime

from src.scrapers.fetes_medievales import (
    _extract_department,
    _parse_dates,
)


# ─── Tests _extract_department ────────────────────────

def test_extract_dept_parentheses() -> None:
    assert _extract_department("Provins (77)") == "77"


def test_extract_dept_zip_code() -> None:
    assert _extract_department("45500 Gien") == "45"


def test_extract_dept_three_digits() -> None:
    """DOM-TOM : 3 chiffres entre parenthèses."""
    assert _extract_department("Fort-de-France (972)") == "972"


def test_extract_dept_unknown() -> None:
    assert _extract_department("Quelque part") == "00"


# ─── Tests _parse_dates ──────────────────────────────

def test_parse_single_date() -> None:
    start, end = _parse_dates("14 juin 2026")
    assert start is not None
    assert start.day == 14
    assert start.month == 6
    assert start.year == 2026
    assert end == start


def test_parse_du_au() -> None:
    start, end = _parse_dates("du 14 au 16 juin 2026")
    assert start is not None
    assert end is not None
    assert start.day == 14
    assert end.day == 16
    assert start.month == 6


def test_parse_range_dash() -> None:
    start, end = _parse_dates("14-15 juin 2026")
    assert start is not None
    assert end is not None
    assert start.day == 14
    assert end.day == 15


def test_parse_unparseable() -> None:
    """Texte non parseable → None."""
    start, end = _parse_dates("bientôt")
    assert start is None
    assert end is None
