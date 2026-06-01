"""Consumer Redis pour les jobs de scraping BullMQ.

Écoute la queue foires:scraping en Redis et dispatch au bon scraper.
Le format des jobs BullMQ est stocké dans Redis sous :
  foires:scraping:waiting (liste FIFO des job IDs)
  foires:scraping:{jobId} (hash avec les données du job)

Ce consumer utilise BLPOP pour attendre les jobs (blocking pop).
"""

import asyncio
import json
import logging
from datetime import datetime

import redis.asyncio as aioredis

from .config import settings
from .database import get_connection
from .dedup import ScrapedEvent, TypeEvenement, deduplicate
from .scrapers.fetes_medievales import FetesMedievalesScraper
from .scrapers.jours_de_marche import JoursDeSmarcheScraper
from .scrapers.eterritoire import EterritoireScraper

logger = logging.getLogger(__name__)

# Registre des scrapers disponibles
SCRAPERS = {
    "fetes_medievales": FetesMedievalesScraper,
    "jours_de_marche": JoursDeSmarcheScraper,
    "eterritoire": EterritoireScraper,
}


async def _save_events_to_db(events: list[ScrapedEvent], conn: object | None = None) -> list[int]:
    """Sauvegarde les événements dédoublonnés en base et retourne les IDs créés."""
    import asyncpg
    close_conn = False
    if conn is None:
        conn = await get_connection()
        close_conn = True
    try:
        # Récupérer les hashes et noms/villes existants pour le dédoublonnage
        rows = await conn.fetch(
            "SELECT hash_dedup, nom, ville FROM evenements"
        )
        existing_hashes = {r["hash_dedup"] for r in rows if r["hash_dedup"]}
        existing_events = [(r["hash_dedup"] or "", r["nom"], r["ville"]) for r in rows]

        # Dédoublonner
        dedup_result = deduplicate(events, existing_hashes, existing_events)

        logger.info(
            "Dédoublonnage : %d à insérer, %d doublons exacts, %d à revoir (fuzzy)",
            len(dedup_result.to_insert),
            len(dedup_result.exact_duplicates),
            len(dedup_result.fuzzy_review),
        )

        # Insérer les nouveaux événements
        new_ids: list[int] = []
        for event in dedup_result.to_insert:
            row = await conn.fetchrow(
                """INSERT INTO evenements (
                    nom, type, description, ville, departement, region,
                    adresse_complete, date_debut, date_fin, recurrence,
                    site_web, email_contact, telephone,
                    prix_emplacement, taille_emplacement, nombre_visiteurs_estime,
                    source_url, source_nom, hash_dedup, scrape_date,
                    statut_pipeline, created_at, updated_at
                ) VALUES (
                    $1, $2, $3, $4, $5, $6,
                    $7, $8, $9, $10,
                    $11, $12, $13,
                    $14, $15, $16,
                    $17, $18, $19, $20,
                    'DECOUVERT', NOW(), NOW()
                ) RETURNING id""",
                event.nom,
                TypeEvenement.validate(event.type_evenement),
                event.description or None,
                event.ville,
                event.departement,
                event.region or None,
                event.adresse_complete or None,
                event.date_debut,
                event.date_fin,
                event.recurrence,
                event.site_web or None,
                event.email_contact or None,
                event.telephone or None,
                event.prix_emplacement,
                event.taille_emplacement or None,
                event.nombre_visiteurs_estime,
                event.source_url or None,
                event.source_nom or None,
                event.hash_dedup,
                datetime.now(),
            )
            if row:
                new_ids.append(row["id"])

        return new_ids
    finally:
        if close_conn:
            await conn.close()  # type: ignore[union-attr]


async def _update_job_status(
    job_db_id: int,
    statut: str,
    output_data: dict | None = None,
    error_message: str | None = None,
) -> None:
    """Met à jour le statut d'un AgentJob en base."""
    async with async_session_factory() as db_session:
        job = await db_session.get(AgentJob, job_db_id)
        if not job:
            logger.warning("AgentJob %d introuvable en DB", job_db_id)
            return
        job.statut = statut
        if statut == "RUNNING":
            job.started_at = datetime.now()
        elif statut in ("COMPLETED", "FAILED"):
            job.completed_at = datetime.now()
        if output_data:
            job.output_data = output_data
        if error_message:
            job.error_message = error_message
        await db_session.commit()


async def _publish_result(
    redis_client: aioredis.Redis,
    job_db_id: int,
    new_event_ids: list[int],
) -> None:
    """Publie le résultat du scraping pour l'orchestrateur TS.

    L'orchestrateur écoute le canal foires:orchestrator:results
    """
    result = json.dumps({
        "agent": "SCRAPING",
        "jobId": job_db_id,
        "newEventIds": new_event_ids,
        "completedAt": datetime.now().isoformat(),
    })
    await redis_client.publish("foires:orchestrator:results", result)
    logger.info("Résultat publié sur foires:orchestrator:results (jobId=%d)", job_db_id)


async def process_job(redis_client: aioredis.Redis, job_data: dict) -> None:
    """Traite un job de scraping.

    Args:
        redis_client: Client Redis pour publier les résultats
        job_data: Données du job BullMQ (jobId, sites, filtres)
    """
    job_db_id: int = job_data.get("jobId", 0)
    sites: list[str] = job_data.get("sites", [])
    filtres: dict[str, str] = job_data.get("filtres", {})

    logger.info("Traitement job #%d : sites=%s, filtres=%s", job_db_id, sites, filtres)

    # Marquer le job comme en cours
    if job_db_id:
        await _update_job_status(job_db_id, "RUNNING")

    all_events: list[ScrapedEvent] = []
    errors: list[str] = []

    for site_name in sites:
        scraper_class = SCRAPERS.get(site_name)
        if not scraper_class:
            logger.warning("Scraper inconnu : %s (disponibles : %s)", site_name, list(SCRAPERS))
            errors.append(f"Scraper inconnu : {site_name}")
            continue

        try:
            scraper = scraper_class()
            events = await scraper.run(filtres=filtres)
            all_events.extend(events)
        except Exception as e:
            logger.exception("Erreur scraper %s", site_name)
            errors.append(f"{site_name}: {e}")

    # Sauvegarder en base avec dédoublonnage
    try:
        new_ids = await _save_events_to_db(all_events)
    except Exception as e:
        logger.exception("Erreur sauvegarde en base")
        if job_db_id:
            await _update_job_status(
                job_db_id, "FAILED",
                error_message=f"Erreur DB : {e}",
            )
        return

    # Résultat
    output = {
        "events_found": len(all_events),
        "events_new": len(new_ids),
        "events_duplicates": len(all_events) - len(new_ids),
        "new_event_ids": new_ids,
        "errors": errors,
    }

    if job_db_id:
        statut = "COMPLETED" if not errors else "COMPLETED"  # Succès partiel OK
        await _update_job_status(job_db_id, statut, output_data=output)

    # Publier le résultat pour l'orchestrateur (chaînage vers analyse)
    await _publish_result(redis_client, job_db_id, new_ids)


async def run_consumer() -> None:
    """Boucle principale du consumer Redis.

    Écoute la queue BullMQ foires:scraping:wait et traite les jobs.
    BullMQ stocke les jobs comme des hashes Redis avec préfixe.
    """
    redis_client = aioredis.from_url(settings.redis_url, decode_responses=True)
    logger.info("Consumer scraping démarré — écoute foires:scraping:wait...")

    # Queue BullMQ : les jobs en attente sont dans une liste Redis
    queue_key = f"{settings.redis_prefix}:scraping:wait"

    try:
        while True:
            # BLPOP bloquant : attend qu'un job arrive dans la queue
            result = await redis_client.blpop(queue_key, timeout=30)

            if result is None:
                # Timeout — on boucle (heartbeat)
                continue

            _key, job_id = result
            logger.info("Job reçu : %s", job_id)

            # Récupérer les données du job depuis le hash BullMQ
            job_hash_key = f"{settings.redis_prefix}:scraping:{job_id}"
            job_raw = await redis_client.hget(job_hash_key, "data")

            if not job_raw:
                logger.warning("Job %s : pas de données dans %s", job_id, job_hash_key)
                continue

            job_data = json.loads(job_raw)
            await process_job(redis_client, job_data)

    except asyncio.CancelledError:
        logger.info("Consumer arrêté proprement")
    finally:
        await redis_client.aclose()
