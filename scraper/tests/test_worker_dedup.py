"""Tests de régression : sort des événements qui ressemblent à un événement déjà en base.

Constat du 21/11/2026 : `_save_events_to_db` n'insérait que les `to_insert` de `deduplicate`.
Tout événement ressemblant (nom + ville) à un événement connu était écarté sans trace, quelle
que soit sa date : la nouvelle édition annuelle d'une foire déjà en base était donc perdue.

Ces tests passent par `_save_events_to_db` avec une fausse connexion : ils vérifient ce qui
part réellement en base, pas seulement le classement interne.
"""

import logging
import re
from datetime import datetime
from typing import Any

from src.dedup import ScrapedEvent, compute_hash
from src.worker import _save_events_to_db


class FakeConn:
    """Fausse connexion asyncpg : sert les événements existants, enregistre les INSERT."""

    def __init__(self, existing: list[dict[str, Any]]) -> None:
        self._existing = existing
        self.inserted: list[dict[str, Any]] = []

    async def fetch(self, _sql: str) -> list[dict[str, Any]]:
        return self._existing

    async def fetchrow(self, sql: str, *args: Any) -> dict[str, int]:
        match = re.search(r"INSERT INTO evenements \((.*?)\)\s*VALUES", sql, re.S)
        assert match, "INSERT inattendu"
        columns = [c.strip() for c in match.group(1).split(",")]
        # Autant de paramètres passés que de marqueurs $n dans la requête (sinon zip tronque)
        assert len(args) == len(set(re.findall(r"\$\d+", sql)))
        # Les N premiers paramètres correspondent aux N premières colonnes
        self.inserted.append(dict(zip(columns, args)))
        return {"id": 1000 + len(self.inserted)}


def _existing(
    id_: int, nom: str, ville: str, date: datetime, recurrence: str = "ANNUEL"
) -> dict[str, Any]:
    return {
        "id": id_,
        "hash_dedup": compute_hash(nom, ville, date),
        "nom": nom,
        "ville": ville,
        "date_debut": date,
        "recurrence": recurrence,
    }


def _scraped(nom: str, ville: str, date: datetime, recurrence: str = "ANNUEL") -> ScrapedEvent:
    return ScrapedEvent(
        nom=nom,
        ville=ville,
        departement="77",
        date_debut=date,
        date_fin=date,
        source_nom="test",
        recurrence=recurrence,
    )


async def test_nouvelle_edition_annuelle_est_inseree() -> None:
    """Même nom, même ville, un an plus tard : c'est une nouvelle édition, pas un doublon."""
    conn = FakeConn([_existing(1, "Fête Médiévale de Provins", "Provins", datetime(2026, 6, 14))])
    edition_2027 = _scraped("Fête Médiévale de Provins", "Provins", datetime(2027, 6, 13))

    new_ids = await _save_events_to_db([edition_2027], conn)

    assert len(new_ids) == 1
    assert len(conn.inserted) == 1
    assert conn.inserted[0]["date_debut"] == datetime(2027, 6, 13)
    assert not conn.inserted[0].get("notes")


async def test_cas_douteux_est_insere_avec_note_a_revoir(caplog: Any) -> None:
    """Nom proche, même ville, même date : doute réel. Conservé et signalé, jamais perdu."""
    conn = FakeConn([_existing(42, "Fête Médiévale de Provins", "Provins", datetime(2026, 6, 14))])
    douteux = _scraped("Fete Medievale Provins", "Provins", datetime(2026, 6, 14))

    with caplog.at_level(logging.WARNING, logger="src.worker"):
        new_ids = await _save_events_to_db([douteux], conn)

    assert len(new_ids) == 1
    assert len(conn.inserted) == 1
    note = conn.inserted[0].get("notes") or ""
    assert note.startswith("À revoir")
    assert "Fête Médiévale de Provins" in note  # l'événement auquel il ressemble
    assert "42" in note  # son numéro de fiche, pour le retrouver
    # Le journal nomme le cas (avant : un simple compteur)
    assert "Fete Medievale Provins" in caplog.text
    assert "Fête Médiévale de Provins" in caplog.text


async def test_marche_hebdomadaire_recollecte_n_est_pas_duplique() -> None:
    """Un marché hebdomadaire a une date fabriquée (prochain jour de marché).

    Recollecté une autre semaine, même nom, même ville, même jour : c'est le même marché.
    """
    samedi_avril = datetime(2026, 4, 4)
    samedi_novembre = datetime(2026, 11, 28)
    assert samedi_avril.weekday() == samedi_novembre.weekday() == 5
    conn = FakeConn([_existing(7, "Marché de Gien", "Gien", samedi_avril, "HEBDOMADAIRE")])

    new_ids = await _save_events_to_db(
        [_scraped("Marché de Gien", "Gien", samedi_novembre, "HEBDOMADAIRE")], conn
    )

    assert new_ids == []
    assert conn.inserted == []


async def test_marche_hebdomadaire_autre_jour_de_semaine_est_insere() -> None:
    """Le même marché tenu un autre jour de la semaine est une ligne distincte."""
    samedi = datetime(2026, 4, 4)
    mercredi = datetime(2026, 11, 25)
    assert mercredi.weekday() == 2
    conn = FakeConn([_existing(7, "Marché de Gien", "Gien", samedi, "HEBDOMADAIRE")])

    new_ids = await _save_events_to_db(
        [_scraped("Marché de Gien", "Gien", mercredi, "HEBDOMADAIRE")], conn
    )

    assert len(new_ids) == 1
    assert not conn.inserted[0].get("notes")


async def test_doublon_exact_n_est_pas_reinsere() -> None:
    """Même nom, même ville, même date : déjà en base, rien à écrire."""
    date = datetime(2026, 6, 14)
    conn = FakeConn([_existing(1, "Fête Médiévale de Provins", "Provins", date)])

    new_ids = await _save_events_to_db(
        [_scraped("Fête Médiévale de Provins", "Provins", date)], conn
    )

    assert new_ids == []
    assert conn.inserted == []
