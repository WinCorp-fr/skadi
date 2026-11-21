"""Moteur de dédoublonnage : hash déterministe + fuzzy Levenshtein.

Règle métier (CLAUDE.md) :
  1. Hash sur normalize(nom) + ville + date_debut : doublon exact, ignoré.
  2. Second passage fuzzy (Levenshtein nom + ville) contre la base, départagé par la date :
     - ressemblant mais dates éloignées → autre édition, à insérer ;
     - marché hebdomadaire de même nom, même ville, même jour de semaine → déjà connu, ignoré
       (sa date est fabriquée par le scraper : elle change à chaque collecte) ;
     - ressemblant et dates proches → doute réel, « à revoir » (jamais écarté en silence).
"""

import hashlib
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum

from Levenshtein import ratio as levenshtein_ratio
from unidecode import unidecode

from .config import settings


class TypeEvenement(str, Enum):
    """Types d'événements — miroir de l'enum Prisma TypeEvenement."""

    FOIRE_MEDIEVALE = "FOIRE_MEDIEVALE"
    MARCHE = "MARCHE"
    FOIRE_ARTISANALE = "FOIRE_ARTISANALE"
    SALON = "SALON"
    BROCANTE = "BROCANTE"
    AUTRE = "AUTRE"

    @classmethod
    def validate(cls, value: str) -> str:
        """Valide et retourne la valeur enum, ou AUTRE si invalide."""
        try:
            return cls(value).value
        except ValueError:
            return cls.AUTRE.value


def normalize(text: str) -> str:
    """Normalise un texte : minuscules, sans accents, sans ponctuation superflue."""
    text = unidecode(text).lower().strip()
    # Retirer la ponctuation courante qui varie entre sources
    for char in ["'", '"', "-", "_", ".", ",", "!", "?", "(", ")", "/"]:
        text = text.replace(char, " ")
    # Compresser les espaces multiples
    return " ".join(text.split())


def compute_hash(nom: str, ville: str, date_debut: datetime) -> str:
    """Calcule le hash de dédoublonnage unique pour un événement.

    Format : SHA256 de "nom_normalisé|ville_normalisée|date_iso"
    """
    key = f"{normalize(nom)}|{normalize(ville)}|{date_debut.date().isoformat()}"
    return hashlib.sha256(key.encode("utf-8")).hexdigest()


def fuzzy_match(nom_a: str, ville_a: str, nom_b: str, ville_b: str) -> float:
    """Score de similarité entre deux événements (0.0-1.0).

    Combine le ratio Levenshtein sur le nom (poids 70%) et la ville (poids 30%).
    """
    nom_score = levenshtein_ratio(normalize(nom_a), normalize(nom_b))
    ville_score = levenshtein_ratio(normalize(ville_a), normalize(ville_b))
    return nom_score * 0.7 + ville_score * 0.3


@dataclass
class ScrapedEvent:
    """Événement brut extrait par un scraper."""

    nom: str
    ville: str
    departement: str
    date_debut: datetime
    date_fin: datetime
    description: str = ""
    region: str = ""
    adresse_complete: str = ""
    site_web: str = ""
    email_contact: str = ""
    telephone: str = ""
    prix_emplacement: float | None = None
    taille_emplacement: str = ""
    nombre_visiteurs_estime: int | None = None
    source_url: str = ""
    source_nom: str = ""
    type_evenement: str = TypeEvenement.AUTRE.value
    recurrence: str = "UNIQUE"

    @property
    def hash_dedup(self) -> str:
        return compute_hash(self.nom, self.ville, self.date_debut)


@dataclass(frozen=True)
class ExistingEvent:
    """Événement déjà en base, tel que le dédoublonnage a besoin de le voir."""

    hash_dedup: str
    nom: str
    ville: str
    date_debut: datetime
    recurrence: str = "UNIQUE"
    id: int | None = None


@dataclass(frozen=True)
class FuzzyCase:
    """Événement collecté qui ressemble à un événement existant de date proche."""

    event: ScrapedEvent
    match: ExistingEvent
    score: float  # similarité nom + ville (0.0-1.0)


@dataclass
class DedupResult:
    """Résultat du dédoublonnage d'un batch de ScrapedEvent.

    Chaque événement du batch finit dans exactement une des quatre catégories
    to_insert, exact_duplicates, known_recurring, fuzzy_review.
    """

    to_insert: list[ScrapedEvent] = field(default_factory=list)
    to_update: list[ScrapedEvent] = field(default_factory=list)
    exact_duplicates: list[ScrapedEvent] = field(default_factory=list)
    # Marchés hebdomadaires déjà en base (même nom, même ville, même jour de semaine)
    known_recurring: list[ScrapedEvent] = field(default_factory=list)
    # Doutes réels : à conserver et à signaler par l'appelant, jamais à écarter
    fuzzy_review: list[FuzzyCase] = field(default_factory=list)


def _both_weekly(event: ScrapedEvent, existing: ExistingEvent) -> bool:
    return event.recurrence == "HEBDOMADAIRE" and existing.recurrence == "HEBDOMADAIRE"


def _same_occurrence(event: ScrapedEvent, existing: ExistingEvent, same_edition_days: int) -> bool:
    """Les deux dates peuvent-elles désigner la même tenue de l'événement ?

    Deux hebdomadaires : même jour de la semaine (leur date est le prochain jour de marché
    au moment de la collecte, l'écart en jours ne veut rien dire). Sinon : débuts séparés
    d'au plus same_edition_days jours.
    """
    gap_days = abs((event.date_debut.date() - existing.date_debut.date()).days)
    if _both_weekly(event, existing):
        return gap_days % 7 == 0
    return gap_days <= same_edition_days


def _same_weekly_market(event: ScrapedEvent, existing: ExistingEvent) -> bool:
    """Même marché hebdomadaire : nom et ville identiques une fois normalisés."""
    return (
        _both_weekly(event, existing)
        and normalize(event.nom) == normalize(existing.nom)
        and normalize(event.ville) == normalize(existing.ville)
    )


def deduplicate(
    new_events: list[ScrapedEvent],
    existing_hashes: set[str],
    existing_events: list[ExistingEvent],
    threshold: int | None = None,
    same_edition_days: int | None = None,
) -> DedupResult:
    """Dédoublonne un batch d'événements scrapés.

    Args:
        new_events: Événements bruts à dédoublonner
        existing_hashes: Set des hash_dedup déjà en base
        existing_events: Événements existants (nom, ville, date, récurrence) pour le fuzzy
        threshold: Seuil fuzzy (0-100), défaut = settings.dedup_fuzzy_threshold
        same_edition_days: Écart maximal en jours entre deux débuts pour soupçonner la même
            édition, défaut = settings.dedup_same_edition_days

    Returns:
        DedupResult : chaque événement est dans exactement une catégorie
    """
    if threshold is None:
        threshold = settings.dedup_fuzzy_threshold
    if same_edition_days is None:
        same_edition_days = settings.dedup_same_edition_days

    result = DedupResult()
    seen_hashes: set[str] = set()

    for event in new_events:
        h = event.hash_dedup

        # 1. Doublon exact dans le batch courant
        if h in seen_hashes:
            result.exact_duplicates.append(event)
            continue

        # 2. Doublon exact avec la base existante
        if h in existing_hashes:
            result.exact_duplicates.append(event)
            seen_hashes.add(h)
            continue

        # 3. Marché hebdomadaire déjà connu (même nom, même ville, même jour de semaine).
        #    Vérifié avant tout rapprochement approximatif : un marché connu ne doit pas
        #    devenir « à revoir » parce qu'une autre fiche de même score passe avant lui.
        if any(
            _same_weekly_market(event, existing)
            and _same_occurrence(event, existing, same_edition_days)
            for existing in existing_events
        ):
            result.known_recurring.append(event)
            seen_hashes.add(h)
            continue

        # 4. Fuzzy match avec les events existants, départagé par la date :
        #    seul un existant ressemblant ET de date proche fait douter.
        best: ExistingEvent | None = None
        best_score = 0.0
        for existing in existing_events:
            score = fuzzy_match(event.nom, event.ville, existing.nom, existing.ville)
            if score * 100 < threshold or score <= best_score:
                continue
            if _same_occurrence(event, existing, same_edition_days):
                best = existing
                best_score = score

        if best is None:
            # Rien de ressemblant à une date proche : nouvel événement ou nouvelle édition
            result.to_insert.append(event)
        else:
            result.fuzzy_review.append(FuzzyCase(event=event, match=best, score=best_score))

        seen_hashes.add(h)

    return result
