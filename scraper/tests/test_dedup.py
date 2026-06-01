"""Tests unitaires pour le moteur de dédoublonnage."""

from datetime import datetime

from src.dedup import (
    DedupResult,
    ScrapedEvent,
    compute_hash,
    deduplicate,
    fuzzy_match,
    normalize,
)


# ─── Tests normalize ─────────────────────────────────

def test_normalize_accents() -> None:
    assert normalize("Fête Médiévale") == "fete medievale"


def test_normalize_punctuation() -> None:
    assert normalize("L'Événement (2026)") == "l evenement 2026"


def test_normalize_spaces() -> None:
    assert normalize("  Marché   de   Noël  ") == "marche de noel"


# ─── Tests compute_hash ──────────────────────────────

def test_hash_deterministic() -> None:
    """Le même événement doit toujours produire le même hash."""
    dt = datetime(2026, 6, 14)
    h1 = compute_hash("Fête Médiévale de Provins", "Provins", dt)
    h2 = compute_hash("Fête Médiévale de Provins", "Provins", dt)
    assert h1 == h2


def test_hash_ignores_case_and_accents() -> None:
    """Le hash doit être insensible à la casse et aux accents."""
    dt = datetime(2026, 6, 14)
    h1 = compute_hash("Fête Médiévale", "Provins", dt)
    h2 = compute_hash("fete medievale", "provins", dt)
    assert h1 == h2


def test_hash_different_events() -> None:
    """Deux événements différents doivent avoir des hashes différents."""
    dt = datetime(2026, 6, 14)
    h1 = compute_hash("Fête Médiévale de Provins", "Provins", dt)
    h2 = compute_hash("Marché de Noël", "Strasbourg", dt)
    assert h1 != h2


def test_hash_different_dates() -> None:
    """Le même nom/ville avec des dates différentes = hashes différents."""
    h1 = compute_hash("Marché", "Gien", datetime(2026, 6, 14))
    h2 = compute_hash("Marché", "Gien", datetime(2026, 7, 14))
    assert h1 != h2


# ─── Tests fuzzy_match ───────────────────────────────

def test_fuzzy_exact_match() -> None:
    """Noms identiques → score ~1.0."""
    score = fuzzy_match("Marché de Noël", "Gien", "Marché de Noël", "Gien")
    assert score > 0.95


def test_fuzzy_similar_names() -> None:
    """Noms proches → score élevé."""
    score = fuzzy_match(
        "Fête Médiévale de Provins", "Provins",
        "Fete Medievale Provins", "Provins",
    )
    assert score > 0.80


def test_fuzzy_different_events() -> None:
    """Événements totalement différents → score bas."""
    score = fuzzy_match(
        "Marché de Noël", "Strasbourg",
        "Salon du Livre", "Paris",
    )
    assert score < 0.50


def test_fuzzy_same_name_different_city() -> None:
    """Même nom, ville différente → score moyen (ville pèse 30%)."""
    score = fuzzy_match("Marché", "Gien", "Marché", "Lyon")
    # nom = 1.0 * 0.7 = 0.7, ville ≈ 0.25 * 0.3 ≈ 0.075 → ~0.775
    assert 0.6 < score < 0.9


# ─── Tests deduplicate ───────────────────────────────

def _make_event(nom: str, ville: str, date: datetime) -> ScrapedEvent:
    return ScrapedEvent(
        nom=nom,
        ville=ville,
        departement="45",
        date_debut=date,
        date_fin=date,
        source_nom="test",
    )


def test_deduplicate_new_events() -> None:
    """Événements sans doublons → tous dans to_insert."""
    events = [
        _make_event("Marché de Gien", "Gien", datetime(2026, 6, 14)),
        _make_event("Fête de Sully", "Sully-sur-Loire", datetime(2026, 7, 1)),
    ]
    result = deduplicate(events, set(), [])
    assert len(result.to_insert) == 2
    assert len(result.exact_duplicates) == 0


def test_deduplicate_exact_duplicate() -> None:
    """Événement déjà en base (même hash) → doublon exact."""
    event = _make_event("Marché de Gien", "Gien", datetime(2026, 6, 14))
    existing_hashes = {event.hash_dedup}
    result = deduplicate([event], existing_hashes, [])
    assert len(result.exact_duplicates) == 1
    assert len(result.to_insert) == 0


def test_deduplicate_batch_internal_duplicate() -> None:
    """Deux événements identiques dans le même batch → un seul inséré."""
    dt = datetime(2026, 6, 14)
    events = [
        _make_event("Marché de Gien", "Gien", dt),
        _make_event("Marché de Gien", "Gien", dt),
    ]
    result = deduplicate(events, set(), [])
    assert len(result.to_insert) == 1
    assert len(result.exact_duplicates) == 1


def test_deduplicate_fuzzy_review() -> None:
    """Événement proche d'un existant → mis en fuzzy_review."""
    event = _make_event("Fete Medievale de Provins", "Provins", datetime(2026, 6, 14))
    existing = [("hash_old", "Fête Médiévale de Provins", "Provins")]
    result = deduplicate([event], set(), existing, threshold=75)
    assert len(result.fuzzy_review) == 1
    assert len(result.to_insert) == 0
    # Vérifier le score
    _, match_nom, score = result.fuzzy_review[0]
    assert match_nom == "Fête Médiévale de Provins"
    assert score > 0.75
