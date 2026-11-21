"""Tests unitaires pour le moteur de dédoublonnage."""

from datetime import datetime

from src.dedup import (
    DedupResult,
    ExistingEvent,
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


def _existing(
    nom: str, ville: str, date: datetime, recurrence: str = "ANNUEL", id_: int = 1
) -> ExistingEvent:
    return ExistingEvent(
        hash_dedup=compute_hash(nom, ville, date),
        nom=nom,
        ville=ville,
        date_debut=date,
        recurrence=recurrence,
        id=id_,
    )


def _categories(result: DedupResult) -> int:
    return (
        len(result.to_insert)
        + len(result.exact_duplicates)
        + len(result.known_recurring)
        + len(result.fuzzy_review)
    )


def test_deduplicate_fuzzy_review() -> None:
    """Événement proche d'un existant à la même date → mis en fuzzy_review."""
    event = _make_event("Fete Medievale de Provins", "Provins", datetime(2026, 6, 14))
    existing = [_existing("Fête Médiévale de Provins", "Provins", datetime(2026, 6, 13))]
    result = deduplicate([event], set(), existing, threshold=75)
    assert len(result.fuzzy_review) == 1
    assert len(result.to_insert) == 0
    # Vérifier le rapprochement et le score
    case = result.fuzzy_review[0]
    assert case.event is event
    assert case.match.nom == "Fête Médiévale de Provins"
    assert case.score > 0.75


def test_deduplicate_new_edition_is_inserted() -> None:
    """Même nom, même ville, un an plus tard → nouvelle édition, à insérer."""
    existing = [_existing("Fête Médiévale de Provins", "Provins", datetime(2026, 6, 14))]
    event = _make_event("Fête Médiévale de Provins", "Provins", datetime(2027, 6, 13))
    result = deduplicate([event], {existing[0].hash_dedup}, existing)
    assert result.to_insert == [event]
    assert result.fuzzy_review == []


def test_deduplicate_same_edition_window_boundary() -> None:
    """Dates proches (jusqu'à 30 jours inclus) → à revoir ; au-delà → autre édition."""
    existing = [_existing("Brocante du Centre", "Gien", datetime(2026, 6, 1))]
    a_30_jours = _make_event("Brocante du Centre", "Gien", datetime(2026, 7, 1))
    a_31_jours = _make_event("Brocante du Centre", "Gien", datetime(2026, 7, 2))
    avant_30_jours = _make_event("Brocante du Centre", "Gien", datetime(2026, 5, 2))

    result = deduplicate([a_30_jours, a_31_jours, avant_30_jours], set(), existing)

    assert [c.event for c in result.fuzzy_review] == [a_30_jours, avant_30_jours]
    assert result.to_insert == [a_31_jours]


def test_deduplicate_same_edition_window_is_configurable() -> None:
    """La fenêtre « même édition » se règle (paramètre same_edition_days)."""
    existing = [_existing("Brocante du Centre", "Gien", datetime(2026, 6, 1))]
    event = _make_event("Brocante du Centre", "Gien", datetime(2026, 6, 11))
    assert deduplicate([event], set(), existing, same_edition_days=5).to_insert == [event]
    assert len(deduplicate([event], set(), existing, same_edition_days=10).fuzzy_review) == 1


def test_deduplicate_weekly_market_same_weekday_is_known() -> None:
    """Marché hebdomadaire recollecté une autre semaine, même jour → déjà connu."""
    existing = [_existing("Marché de Gien", "Gien", datetime(2026, 4, 4), "HEBDOMADAIRE")]
    event = _make_event("Marche de Gien", "gien", datetime(2026, 11, 28))
    event.recurrence = "HEBDOMADAIRE"
    result = deduplicate([event], set(), existing)
    assert result.known_recurring == [event]
    assert result.to_insert == []
    assert result.fuzzy_review == []


def test_deduplicate_weekly_market_other_weekday_is_inserted() -> None:
    """Même marché, autre jour de la semaine → ligne distincte, à insérer."""
    existing = [_existing("Marché de Gien", "Gien", datetime(2026, 4, 4), "HEBDOMADAIRE")]
    event = _make_event("Marché de Gien", "Gien", datetime(2026, 11, 25))
    event.recurrence = "HEBDOMADAIRE"
    result = deduplicate([event], set(), existing)
    assert result.to_insert == [event]


def test_deduplicate_weekly_market_near_name_same_weekday_goes_to_review() -> None:
    """Hebdomadaire : la date est fabriquée, l'écart en jours ne prouve rien.

    Nom proche (pas identique), même jour de semaine, des mois plus tard → doute réel,
    à revoir (et surtout pas « nouvelle édition » insérée sans signalement).
    """
    existing = [_existing("Marché de Gien", "Gien", datetime(2026, 4, 4), "HEBDOMADAIRE")]
    event = _make_event("Marché de Gien centre", "Gien", datetime(2026, 11, 28))
    event.recurrence = "HEBDOMADAIRE"
    result = deduplicate([event], set(), existing, threshold=80)
    assert [c.event for c in result.fuzzy_review] == [event]
    assert result.to_insert == []
    assert result.known_recurring == []


def test_deduplicate_known_weekly_market_wins_whatever_the_order() -> None:
    """Un marché connu exact l'emporte sur un autre candidat de même score.

    Sans cette priorité, le verdict dépendait de l'ordre des lignes rendues par la base :
    une fiche de même nom saisie à la main (non hebdomadaire) de date proche faisait
    créer une fiche « à revoir » à chaque collecte.
    """
    manuel = _existing("Marché de Gien", "Gien", datetime(2026, 12, 10), "UNIQUE", id_=1)
    hebdo = _existing("Marché de Gien", "Gien", datetime(2026, 4, 4), "HEBDOMADAIRE", id_=2)
    event = _make_event("Marché de Gien", "Gien", datetime(2026, 11, 28))
    event.recurrence = "HEBDOMADAIRE"

    for existing in ([manuel, hebdo], [hebdo, manuel]):
        result = deduplicate([event], set(), existing)
        assert result.known_recurring == [event]
        assert result.fuzzy_review == []
        assert result.to_insert == []


def test_deduplicate_review_matches_close_candidate_not_best_far_one() -> None:
    """Le rapprochement signalé est celui dont la date est proche, pas le meilleur score."""
    edition_2025 = _existing("Fete Medievale Provins", "Provins", datetime(2025, 6, 15), id_=1)
    edition_2026 = _existing("Fête Médiévale de Provins", "Provins", datetime(2026, 6, 14), id_=2)
    event = _make_event("Fete Medievale Provins", "Provins", datetime(2026, 6, 14))

    result = deduplicate([event], set(), [edition_2025, edition_2026])

    assert len(result.fuzzy_review) == 1
    assert result.fuzzy_review[0].match is edition_2026


def test_deduplicate_never_loses_an_event() -> None:
    """Chaque événement du lot finit dans une catégorie, et une seule."""
    existing = [
        _existing("Fête Médiévale de Provins", "Provins", datetime(2026, 6, 14)),
        _existing("Marché de Gien", "Gien", datetime(2026, 4, 4), "HEBDOMADAIRE"),
    ]
    marche = _make_event("Marché de Gien", "Gien", datetime(2026, 11, 28))
    marche.recurrence = "HEBDOMADAIRE"
    events = [
        _make_event("Fête Médiévale de Provins", "Provins", datetime(2026, 6, 14)),  # exact
        _make_event("Fête Médiévale de Provins", "Provins", datetime(2027, 6, 13)),  # édition
        _make_event("Fete Medievale Provins", "Provins", datetime(2026, 6, 14)),  # douteux
        marche,  # récurrent connu
        _make_event("Salon du Fromage", "Tours", datetime(2026, 9, 5)),  # nouveau
    ]
    result = deduplicate(events, {e.hash_dedup for e in existing}, existing)
    assert _categories(result) == len(events)
    assert len(result.to_insert) == 2
    assert len(result.exact_duplicates) == 1
    assert len(result.known_recurring) == 1
    assert len(result.fuzzy_review) == 1
