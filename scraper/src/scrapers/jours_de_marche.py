"""Scraper pour jours-de-marche.fr — marchés récurrents par département.

Le site liste les marchés de France par département avec :
- Nom du marché / ville
- Jour(s) de la semaine
- Type (alimentaire, brocante, etc.)
- Adresse

URL pattern : https://www.jours-de-marche.fr/{code}-{nom}/
Exemple : https://www.jours-de-marche.fr/45-loiret/

Les sélecteurs CSS sont isolés en constantes pour faciliter la maintenance.
NOTE : Les sélecteurs doivent être vérifiés/ajustés lors du premier run réel.
"""

import logging
import re
from datetime import datetime, timedelta

import dateparser
from bs4 import BeautifulSoup, Tag
from playwright.async_api import Page

from ..dedup import ScrapedEvent
from .base import BaseScraper

logger = logging.getLogger(__name__)

# ─── Configuration du site ────────────────────────────

BASE_URL = "https://www.jours-de-marche.fr"

# Départements cibles (Centre-Val de Loire + limitrophes — zone de chalandise)
DEFAULT_DEPARTMENTS = [
    ("45", "loiret"),
    ("18", "cher"),
    ("28", "eure-et-loir"),
    ("36", "indre"),
    ("37", "indre-et-loire"),
    ("41", "loir-et-cher"),
    ("89", "yonne"),
    ("77", "seine-et-marne"),
    ("58", "nievre"),
]

# Sélecteurs CSS (vérifiés le 29/03/2026 sur jours-de-marche.fr)
# Structure : div.card.shadow-sm.mb-4 > h3.card-header > a (nom)
#             div.card > a.text-reset > div.card-body > p > b (horaires)
#             div.card > a.text-reset > div.card-footer (adresse + CP + ville)
SEL_MARKET_CARD = "div.card.shadow-sm.mb-4"
SEL_CARD_NAME = "h3.card-header > a"
SEL_CARD_SCHEDULE = ".card-body b"
SEL_CARD_TYPE = ".card-body span.tag"
SEL_CARD_FOOTER = ".card-footer"
SEL_CARD_LINK = "h3.card-header > a[href]"

# Mapping jour FR → numéro (lundi=0)
JOUR_TO_NUM: dict[str, int] = {
    "lundi": 0, "mardi": 1, "mercredi": 2, "jeudi": 3,
    "vendredi": 4, "samedi": 5, "dimanche": 6,
}

# Mapping département → région
DEPT_TO_REGION: dict[str, str] = {
    "45": "Centre-Val de Loire", "18": "Centre-Val de Loire",
    "28": "Centre-Val de Loire", "36": "Centre-Val de Loire",
    "37": "Centre-Val de Loire", "41": "Centre-Val de Loire",
    "89": "Bourgogne-Franche-Comté", "58": "Bourgogne-Franche-Comté",
    "77": "Île-de-France",
}


def _next_weekday(day_num: int) -> datetime:
    """Retourne la date du prochain jour de la semaine donné (0=lundi)."""
    today = datetime.now()
    days_ahead = day_num - today.weekday()
    if days_ahead <= 0:
        days_ahead += 7
    return today + timedelta(days=days_ahead)


def _parse_day(text: str) -> int | None:
    """Parse un texte de jour en numéro (0=lundi). Retourne None si non reconnu."""
    text = text.strip().lower()
    for jour, num in JOUR_TO_NUM.items():
        if jour in text:
            return num
    return None


def _extract_text(tag: Tag | None, selector: str) -> str:
    """Extrait le texte d'un sous-élément, ou chaîne vide."""
    if tag is None:
        return ""
    el = tag.select_one(selector)
    return el.get_text(strip=True) if el else ""


# Regex pour extraire CP + ville du footer (ex: "Place Clovis à 45750 Saint-Pryvé-Saint-Mesmin")
_RE_CP_VILLE = re.compile(r"à\s+(\d{5})\s+(.+?)$", re.IGNORECASE)

# Regex pour extraire horaires (ex: "de 8h à 12h" ou "de 8h30 à 13h")
_RE_HORAIRES = re.compile(r"de\s+(\d{1,2}h\d{0,2})\s+à\s+(\d{1,2}h\d{0,2})", re.IGNORECASE)


class JoursDeSmarcheScraper(BaseScraper):
    """Scraper pour jours-de-marche.fr — marchés récurrents."""

    name = "jours_de_marche"

    async def scrape(
        self,
        page: Page,
        filtres: dict[str, str],
    ) -> list[ScrapedEvent]:
        """Scrape les marchés par département."""
        events: list[ScrapedEvent] = []

        # Déterminer les départements à scraper
        if "departement" in filtres:
            dept_code = filtres["departement"]
            # Chercher le nom du département dans la liste par défaut
            dept_name = next(
                (name for code, name in DEFAULT_DEPARTMENTS if code == dept_code),
                dept_code.lower(),
            )
            departments = [(dept_code, dept_name)]
        else:
            departments = DEFAULT_DEPARTMENTS

        for dept_code, dept_name in departments:
            try:
                dept_events = await self._scrape_department(page, dept_code, dept_name)
                events.extend(dept_events)
            except Exception:
                # Log + département suivant (jamais crasher la boucle entière)
                logger.exception("[%s] Erreur scraping département %s", self.name, dept_code)

            # Filtrer par région si demandé
            if "region" in filtres:
                region_filter = filtres["region"].lower()
                events = [e for e in events if region_filter in e.region.lower()]

        logger.info("[%s] Total : %d marchés scrapés", self.name, len(events))
        return events

    async def _scrape_department(
        self,
        page: Page,
        dept_code: str,
        dept_name: str,
    ) -> list[ScrapedEvent]:
        """Scrape tous les marchés d'un département."""
        events: list[ScrapedEvent] = []
        url = f"{BASE_URL}/{dept_code}-{dept_name}/"

        logger.info("[%s] Département %s (%s) : %s", self.name, dept_code, dept_name, url)

        await self._random_delay()
        try:
            await page.goto(url, wait_until="domcontentloaded", timeout=30000)
            await page.wait_for_load_state("networkidle", timeout=15000)
        except Exception:
            logger.exception("[%s] Erreur navigation %s", self.name, url)
            return events

        html = await page.content()
        soup = BeautifulSoup(html, "html.parser")

        # Extraire les marchés listés (cards Bootstrap)
        items = soup.select(SEL_MARKET_CARD)
        if not items:
            logger.warning(
                "[%s] Aucun marché trouvé pour %s avec sélecteur '%s'",
                self.name, dept_code, SEL_MARKET_CARD,
            )
            return events

        for item in items:
            try:
                event = self._parse_market(item, dept_code, dept_name)
                if event:
                    events.append(event)
            except Exception:
                logger.exception("[%s] Erreur parsing marché", self.name)
                continue

        logger.info("[%s] %s : %d marchés trouvés", self.name, dept_code, len(events))
        return events

    def _parse_market(
        self, card: Tag, dept_code: str, dept_name: str
    ) -> ScrapedEvent | None:
        """Parse une card de marché en ScrapedEvent.

        Structure HTML (vérifiée 29/03/2026) :
          div.card.shadow-sm.mb-4
            h3.card-header > a          → nom + lien détail
            a.text-reset
              div.card-body > p > b     → horaires ("Ce marché a lieu ... le samedi de 8h à 12h")
              div.card-body span.tag    → type optionnel ("Marché de producteurs")
              div.card-footer           → adresse + "à {CP} {ville}"
        """
        # Nom du marché
        nom_text = _extract_text(card, SEL_CARD_NAME)
        if not nom_text or len(nom_text) < 3:
            return None

        # Nom = garder tel quel si contient "marché", sinon préfixer
        nom = nom_text if "marché" in nom_text.lower() else f"Marché de {nom_text}"

        # Lien détail
        link_tag = card.select_one(SEL_CARD_LINK)
        detail_url = ""
        if link_tag and link_tag.get("href"):
            href = str(link_tag["href"])
            detail_url = href if href.startswith("http") else f"{BASE_URL}{href}"

        # Horaires (balise <b> dans card-body)
        schedule_text = _extract_text(card, SEL_CARD_SCHEDULE)

        # Jour de la semaine (chercher dans horaires, sinon dans le nom)
        day_num = _parse_day(schedule_text) if schedule_text else _parse_day(nom_text)

        # Date : prochain jour de la semaine (marché récurrent)
        if day_num is not None:
            date_debut = _next_weekday(day_num)
        else:
            # Pas de jour identifié → samedi par défaut (jour de marché le plus courant)
            date_debut = _next_weekday(5)

        # Ville et adresse depuis le footer ("Place Clovis à 45750 Saint-Pryvé-Saint-Mesmin")
        footer_text = _extract_text(card, SEL_CARD_FOOTER)
        ville = ""
        if footer_text:
            match_cp = _RE_CP_VILLE.search(footer_text)
            if match_cp:
                ville = match_cp.group(2).strip()

        # Fallback : extraire la ville depuis le nom ou l'URL
        if not ville:
            ville = nom_text.split(" - ")[0].strip()

        # Type (badge optionnel, ex: "Marché de producteurs")
        type_text = _extract_text(card, SEL_CARD_TYPE)
        type_evenement = "MARCHE"

        # Horaires lisibles pour la description
        horaires = ""
        if schedule_text:
            match_h = _RE_HORAIRES.search(schedule_text)
            if match_h:
                horaires = f"{match_h.group(1)} - {match_h.group(2)}"

        # Construire la description
        desc_parts = []
        if type_text:
            desc_parts.append(type_text)
        if schedule_text:
            desc_parts.append(schedule_text)
        elif horaires:
            desc_parts.append(horaires)
        description = " — ".join(desc_parts)

        region = DEPT_TO_REGION.get(dept_code, "")

        return ScrapedEvent(
            nom=nom,
            ville=ville,
            departement=dept_code,
            date_debut=date_debut,
            date_fin=date_debut,  # Marché = 1 jour
            description=description,
            region=region,
            site_web=detail_url,
            source_url=detail_url or f"{BASE_URL}/{dept_code}-{dept_name}/",
            source_nom=self.name,
            type_evenement=type_evenement,
            recurrence="HEBDOMADAIRE",
        )
