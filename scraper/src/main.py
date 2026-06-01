"""Point d'entrée CLI du scraper skadi.

Usage :
  python -m src.main consumer          # Démarre le consumer Redis (mode production)
  python -m src.main scrape-once SITE   # Scrape un site une fois (mode test)
  python -m src.main list-scrapers      # Liste les scrapers disponibles
"""

import argparse
import asyncio
import logging
import sys

from .worker import SCRAPERS, _save_events_to_db, run_consumer

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger(__name__)


async def scrape_once(site_name: str, filtres: dict[str, str]) -> None:
    """Exécute un scraping unique sans passer par Redis (mode test)."""
    from .database import get_connection

    scraper_class = SCRAPERS.get(site_name)
    if not scraper_class:
        logger.error("Scraper inconnu : %s (disponibles : %s)", site_name, list(SCRAPERS))
        sys.exit(1)

    # Ouvrir la connexion DB AVANT Playwright (évite conflit réseau Windows)
    logger.info("Connexion à la base de données...")
    db_conn = await get_connection()
    logger.info("Connexion DB OK")

    scraper = scraper_class()
    events = await scraper.run(filtres=filtres)

    if not events:
        logger.info("Aucun événement trouvé.")
        await db_conn.close()
        return

    logger.info("Événements trouvés : %d", len(events))
    for e in events[:5]:
        logger.info("  - %s | %s (%s) | %s → %s", e.nom, e.ville, e.departement,
                     e.date_debut.strftime("%d/%m/%Y"), e.date_fin.strftime("%d/%m/%Y"))
    if len(events) > 5:
        logger.info("  ... et %d de plus", len(events) - 5)

    # Sauvegarder en base avec la connexion pré-ouverte
    new_ids = await _save_events_to_db(events, db_conn)
    logger.info("Sauvegardé : %d nouveaux événements (IDs: %s)", len(new_ids), new_ids[:10])
    await db_conn.close()


def cli() -> None:
    """CLI principal du scraper."""
    parser = argparse.ArgumentParser(
        prog="foires-scraper",
        description="Agent de scraping skadi",
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    # consumer
    subparsers.add_parser("consumer", help="Démarrer le consumer Redis (mode production)")

    # scrape-once
    sp_scrape = subparsers.add_parser("scrape-once", help="Scraper un site une fois (test)")
    sp_scrape.add_argument("site", choices=list(SCRAPERS.keys()), help="Nom du scraper")
    sp_scrape.add_argument("--region", help="Filtrer par région")
    sp_scrape.add_argument("--departement", help="Filtrer par département")

    # list-scrapers
    subparsers.add_parser("list-scrapers", help="Lister les scrapers disponibles")

    args = parser.parse_args()

    if args.command == "consumer":
        logger.info("Démarrage du consumer scraping...")
        asyncio.run(run_consumer())

    elif args.command == "scrape-once":
        filtres: dict[str, str] = {}
        if args.region:
            filtres["region"] = args.region
        if args.departement:
            filtres["departement"] = args.departement
        asyncio.run(scrape_once(args.site, filtres))

    elif args.command == "list-scrapers":
        print("Scrapers disponibles :")
        for name, cls in SCRAPERS.items():
            print(f"  - {name} ({cls.__doc__.strip().splitlines()[0] if cls.__doc__ else ''})")


if __name__ == "__main__":
    cli()
