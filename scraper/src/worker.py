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
from .dedup import ExistingEvent, FuzzyCase, ScrapedEvent, TypeEvenement, deduplicate
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


def _review_note(case: FuzzyCase) -> str:
    """Note posée sur un événement « à revoir » : dit à quelle fiche il ressemble."""
    match = case.match
    fiche = f", fiche n° {match.id}" if match.id is not None else ""
    return (
        f"À revoir : doublon possible de « {match.nom} » "
        f"({match.ville}, {match.date_debut:%d/%m/%Y}){fiche}, "
        f"ressemblance {round(case.score * 100)} %. "
        f"Signalé à la collecte du {datetime.now():%d/%m/%Y}."
    )


# Colonnes du signal « à revoir » (migration `db/migrations/20261121_fiches_a_revoir.up.sql`).
REVIEW_COLUMNS = ("doublon_possible_de_id", "doublon_score")

_INSERT_COLUMNS = (
    "nom", "type", "description", "ville", "departement", "region",
    "adresse_complete", "date_debut", "date_fin", "recurrence",
    "site_web", "email_contact", "telephone",
    "prix_emplacement", "taille_emplacement", "nombre_visiteurs_estime",
    "source_url", "source_nom", "hash_dedup", "scrape_date", "notes",
)


async def _has_review_columns(conn: object) -> bool:
    """Dit si la base porte les colonnes du signal « à revoir ».

    Tant que la migration n'est pas appliquée, la collecte retombe sur la note texte :
    citer une colonne absente ferait échouer chaque insertion.
    """
    count = await conn.fetchval(  # type: ignore[attr-defined]
        "SELECT count(*) FROM information_schema.columns"
        " WHERE table_schema = current_schema() AND table_name = 'evenements'"
        " AND column_name = ANY($1::text[])",
        list(REVIEW_COLUMNS),
    )
    return count == len(REVIEW_COLUMNS)


async def _insert_event(
    conn: object,
    event: ScrapedEvent,
    notes: str | None,
    review: FuzzyCase | None = None,
    review_columns: bool = False,
) -> int | None:
    """Insère un événement (statut DECOUVERT) et retourne son ID.

    Si `review_columns` est vrai, les colonnes du signal « à revoir » sont écrites
    (vides pour un événement sans ressemblance, remplies d'après `review` sinon).
    """
    columns = list(_INSERT_COLUMNS)
    values: list[object] = [
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
        notes,
    ]
    if review_columns:
        columns.extend(REVIEW_COLUMNS)
        values.extend(
            [review.match.id, review.score] if review is not None else [None, None]
        )
    placeholders = [f"${i}" for i in range(1, len(values) + 1)]
    if review_columns:
        # Lien relu dans la requête : si la fiche ressemblante a été supprimée depuis la
        # lecture, le lien reste vide (le score garde le signal) au lieu de violer la clé.
        i = columns.index("doublon_possible_de_id")
        placeholders[i] = f"(SELECT id FROM evenements WHERE id = {placeholders[i]})"
    row = await conn.fetchrow(  # type: ignore[attr-defined]
        f"INSERT INTO evenements ({', '.join(columns)}, statut_pipeline, created_at, updated_at)"
        f" VALUES ({', '.join(placeholders)}, 'DECOUVERT', NOW(), NOW()) RETURNING id",
        *values,
    )
    return row["id"] if row else None


async def _save_events_to_db(events: list[ScrapedEvent], conn: object | None = None) -> list[int]:
    """Sauvegarde les événements dédoublonnés en base et retourne les IDs créés.

    Sont insérés : les nouveaux événements et les cas « à revoir » (ressemblance avec un
    événement existant de date proche), ces derniers marqués par les colonnes
    `doublon_possible_de_id` et `doublon_score`, ou, sur une base non migrée, par une note
    qui nomme la fiche ressemblante. Seuls les doublons certains ne sont pas écrits.
    """
    import asyncpg
    close_conn = False
    if conn is None:
        conn = await get_connection()
        close_conn = True
    try:
        # Récupérer les événements existants pour le dédoublonnage
        rows = await conn.fetch(
            "SELECT id, hash_dedup, nom, ville, date_debut, recurrence::text AS recurrence"
            " FROM evenements"
        )
        existing_hashes = {r["hash_dedup"] for r in rows if r["hash_dedup"]}
        existing_events = [
            ExistingEvent(
                hash_dedup=r["hash_dedup"] or "",
                nom=r["nom"],
                ville=r["ville"],
                date_debut=r["date_debut"],
                recurrence=r["recurrence"],
                id=r["id"],
            )
            for r in rows
        ]

        # Dédoublonner
        dedup_result = deduplicate(events, existing_hashes, existing_events)

        logger.info(
            "Dédoublonnage : %d à insérer, %d doublons exacts, "
            "%d marchés récurrents déjà connus, %d à revoir (à insérer avec une note)",
            len(dedup_result.to_insert),
            len(dedup_result.exact_duplicates),
            len(dedup_result.known_recurring),
            len(dedup_result.fuzzy_review),
        )

        new_ids: list[int] = []
        review_columns = await _has_review_columns(conn)
        if not review_columns:
            logger.warning(
                "Colonnes du signal « à revoir » absentes : migration non appliquée,"
                " les cas douteux sont signalés par une note texte."
            )

        # Insérer les nouveaux événements
        for event in dedup_result.to_insert:
            new_id = await _insert_event(conn, event, None, review_columns=review_columns)
            if new_id is not None:
                new_ids.append(new_id)

        # Insérer les cas douteux avec leur note : un doute se montre, il ne s'écarte pas
        for case in dedup_result.fuzzy_review:
            # Base migrée : le signal va dans ses colonnes, le champ libre `notes` reste à
            # l'utilisateur. Sinon, repli sur la note texte (comportement d'avant migration).
            new_id = await _insert_event(
                conn,
                case.event,
                None if review_columns else _review_note(case),
                review=case,
                review_columns=review_columns,
            )
            logger.warning(
                "À revoir : « %s » (%s, %s) ressemble à « %s » (%s, %s, fiche n° %s), "
                "ressemblance %d %%. Inséré « à revoir » (fiche n° %s).",
                case.event.nom,
                case.event.ville,
                case.event.date_debut.strftime("%d/%m/%Y"),
                case.match.nom,
                case.match.ville,
                case.match.date_debut.strftime("%d/%m/%Y"),
                case.match.id,
                round(case.score * 100),
                new_id,
            )
            if new_id is not None:
                new_ids.append(new_id)

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
