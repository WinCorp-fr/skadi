"""Configuration du scraper via variables d'environnement."""

from pathlib import Path

from pydantic_settings import BaseSettings

# Chemin absolu vers le .env à la racine du projet (pas relatif au CWD)
_ENV_FILE = Path(__file__).resolve().parent.parent.parent / ".env"


class Settings(BaseSettings):
    """Config chargée depuis .env ou variables d'environnement."""

    # Base de données PostgreSQL (schéma foires)
    database_url: str = "postgresql://wincorp:dev-password-change-me@localhost:5432/wincorp_dev"

    # Redis (partagé avec BullMQ côté TS)
    redis_url: str = "redis://localhost:6379"

    # Préfixe Redis pour isoler les queues foires
    redis_prefix: str = "foires"

    # Scraping : délais anti-détection (secondes)
    scrape_delay_min: float = 2.0
    scrape_delay_max: float = 8.0

    # Dédoublonnage : seuil fuzzy Levenshtein (0-100)
    dedup_fuzzy_threshold: int = 85

    # Dédoublonnage : deux événements ressemblants dont les débuts sont séparés d'au plus
    # N jours sont peut-être la même édition (à revoir) ; au-delà, c'est une autre édition.
    # Mesure du 21/11/2026 sur la base : entre deux éditions d'une même foire, l'écart
    # observé va de 238 à 1 827 jours, aucun sous 30 jours.
    dedup_same_edition_days: int = 30

    model_config = {"env_file": str(_ENV_FILE), "env_file_encoding": "utf-8", "extra": "ignore"}


settings = Settings()
