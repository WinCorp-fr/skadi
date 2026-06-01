"""Moteur de dédoublonnage : hash déterministe + fuzzy Levenshtein.

Règle métier (CLAUDE.md) :
  Hash sur normalize(nom) + ville + date_debut
  Second pass fuzzy (Levenshtein) pour doublons inter-sources
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


@dataclass
class DedupResult:
    """Résultat du dédoublonnage d'un batch de ScrapedEvent."""

    to_insert: list[ScrapedEvent] = field(default_factory=list)
    to_update: list[ScrapedEvent] = field(default_factory=list)
    exact_duplicates: list[ScrapedEvent] = field(default_factory=list)
    fuzzy_review: list[tuple[ScrapedEvent, str, float]] = field(default_factory=list)
    # fuzzy_review : (event_nouveau, nom_existant_proche, score_similarité)


def deduplicate(
    new_events: list[ScrapedEvent],
    existing_hashes: set[str],
    existing_events: list[tuple[str, str, str]],  # (hash, nom, ville)
    threshold: int | None = None,
) -> DedupResult:
    """Dédoublonne un batch d'événements scrapés.

    Args:
        new_events: Événements bruts à dédoublonner
        existing_hashes: Set des hash_dedup déjà en base
        existing_events: Liste (hash, nom, ville) des events existants pour fuzzy
        threshold: Seuil fuzzy (0-100), défaut = settings.dedup_fuzzy_threshold

    Returns:
        DedupResult avec les 4 catégories
    """
    if threshold is None:
        threshold = settings.dedup_fuzzy_threshold

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

        # 3. Fuzzy match avec les events existants
        best_score = 0.0
        best_match_nom = ""
        for _existing_hash, existing_nom, existing_ville in existing_events:
            score = fuzzy_match(event.nom, event.ville, existing_nom, existing_ville)
            if score > best_score:
                best_score = score
                best_match_nom = existing_nom

        if best_score * 100 >= threshold:
            result.fuzzy_review.append((event, best_match_nom, best_score))
        else:
            result.to_insert.append(event)

        seen_hashes.add(h)

    return result
