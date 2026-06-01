"""Scraper pour eterritoire.fr — Foires, salons et expositions en France.

10 500+ événements indexés, filtrage par région/département.
URL pattern : https://www.eterritoire.fr/evenements/france[,region[,departement]]/foire-salon/[page]

Données extraites : nom, ville, département, dates, catégorie, description.
Sélecteurs basés sur l'analyse du DOM réel du site (mars 2026).

Structure HTML :
  ul.lstline > li (chaque événement)
    div.ttl > a (titre + href détail avec code postal)
             p[0] (ville + département textuel)
             p[1] (date : "Le 29/03/2026" ou "28/03/2026 au 29/03/2026")
             p[2] (catégories séparées par virgule)
    div.dsc (description)
  Pagination : span.pagination > a (numéros) + a text=">" pour page suivante
"""

import logging
import re
from datetime import datetime

import dateparser
from bs4 import BeautifulSoup, Tag
from playwright.async_api import Page

from ..dedup import ScrapedEvent
from .base import BaseScraper

logger = logging.getLogger(__name__)

# ─── Configuration du site ────────────────────────────

BASE_URL = "https://www.eterritoire.fr"
LISTING_PATH = "/evenements/france/foire-salon"

# Mapping département → slug URL eterritoire
DEPT_SLUGS: dict[str, tuple[str, str]] = {
    # Centre-Val de Loire
    "45": ("centre-val-de-loire", "loiret"),
    "18": ("centre-val-de-loire", "cher"),
    "28": ("centre-val-de-loire", "eure-et-loir"),
    "36": ("centre-val-de-loire", "indre"),
    "37": ("centre-val-de-loire", "indre-et-loire"),
    "41": ("centre-val-de-loire", "loir-et-cher"),
    # Limitrophes
    "89": ("bourgogne-franche-comte", "yonne"),
    "77": ("ile-de-france", "seine-et-marne"),
    "58": ("bourgogne-franche-comte", "nievre"),
    "91": ("ile-de-france", "essonne"),
    "78": ("ile-de-france", "yvelines"),
}

# Régions par défaut à scraper si pas de filtre
DEFAULT_REGIONS = [
    "centre-val-de-loire",
]

# Mapping catégories eterritoire → types événement
CATEGORY_MAP: dict[str, str] = {
    "foire": "FOIRE_ARTISANALE",
    "salon": "SALON",
    "marché": "MARCHE",
    "marche": "MARCHE",
    "exposition": "SALON",
    "brocante": "BROCANTE",
    "vide": "BROCANTE",
    "médiéval": "FOIRE_MEDIEVALE",
    "medieval": "FOIRE_MEDIEVALE",
    "artisan": "FOIRE_ARTISANALE",
}

# Département → région mapping
DEPT_TO_REGION: dict[str, str] = {
    "45": "Centre-Val de Loire", "18": "Centre-Val de Loire",
    "28": "Centre-Val de Loire", "36": "Centre-Val de Loire",
    "37": "Centre-Val de Loire", "41": "Centre-Val de Loire",
    "89": "Bourgogne-Franche-Comté", "58": "Bourgogne-Franche-Comté",
    "77": "Île-de-France", "91": "Île-de-France", "78": "Île-de-France",
}

# ─── Sélecteurs CSS (basés sur le DOM réel du site) ───
# ul.lstline > li = conteneur événements
# div.ttl > a = titre, p[0] = lieu, p[1] = date, p[2] = catégories
# div.dsc = description
# span.pagination > a text=">" = page suivante
SEL_EVENT_LIST = "ul.lstline"
SEL_EVENT_ITEM = "ul.lstline > li"
SEL_EVENT_TITLE = ".ttl > a"
SEL_EVENT_DESCRIPTION = ".dsc"
SEL_PAGINATION_NEXT = "span.pagination > a"


def _guess_type(text: str) -> str:
    """Devine le type d'événement depuis le nom ou la catégorie."""
    text_lower = text.lower()
    for keyword, event_type in CATEGORY_MAP.items():
        if keyword in text_lower:
            return event_type
    return "AUTRE"


def _extract_department(location_text: str) -> str:
    """Extrait le code département depuis un texte de lieu."""
    # Format "(45)" ou "Loiret (45)"
    match = re.search(r"\((\d{2,3})\)", location_text)
    if match:
        return match.group(1).zfill(2)[:3]
    # Code postal
    match = re.search(r"\b(\d{5})\b", location_text)
    if match:
        return match.group(1)[:2]
    return "00"


def _parse_date_fr(text: str) -> datetime | None:
    """Parse une date au format dd/mm/yyyy."""
    match = re.search(r"(\d{2})/(\d{2})/(\d{4})", text)
    if match:
        try:
            return datetime(
                int(match.group(3)), int(match.group(2)), int(match.group(1))
            )
        except ValueError:
            pass
    # Fallback dateparser pour formats textuels
    return dateparser.parse(text, languages=["fr"])


def _parse_date(text: str) -> tuple[datetime | None, datetime | None]:
    """Parse une date ou plage de dates eterritoire.

    Formats observés :
      - "Le 29/03/2026"
      - "28/03/2026 au 29/03/2026"
    """
    text = text.strip()

    # Format "XX/XX/XXXX au XX/XX/XXXX"
    match = re.search(
        r"(\d{2}/\d{2}/\d{4})\s+au\s+(\d{2}/\d{2}/\d{4})", text
    )
    if match:
        start = _parse_date_fr(match.group(1))
        end = _parse_date_fr(match.group(2))
        return start, end

    # Format "Le XX/XX/XXXX" ou juste "XX/XX/XXXX"
    text_clean = re.sub(r"^[Ll]e\s+", "", text)
    parsed = _parse_date_fr(text_clean)
    return parsed, parsed


class EterritoireScraper(BaseScraper):
    """Scraper pour eterritoire.fr — foires et salons en France."""

    name = "eterritoire"

    async def scrape(
        self,
        page: Page,
        filtres: dict[str, str],
    ) -> list[ScrapedEvent]:
        """Scrape les foires et salons."""
        events: list[ScrapedEvent] = []

        # Construire l'URL selon les filtres
        if "departement" in filtres:
            dept = filtres["departement"]
            if dept in DEPT_SLUGS:
                region_slug, dept_slug = DEPT_SLUGS[dept]
                base_url = f"{BASE_URL}/evenements/france,{region_slug},{dept_slug}/foire-salon"
            else:
                base_url = f"{BASE_URL}{LISTING_PATH}"
        elif "region" in filtres:
            region_slug = filtres["region"].lower().replace(" ", "-")
            base_url = f"{BASE_URL}/evenements/france,{region_slug}/foire-salon"
        else:
            # Par défaut : Centre-Val de Loire
            base_url = f"{BASE_URL}/evenements/france,centre-val-de-loire/foire-salon"

        # Pagination — ~20 events/page, garde-fou à 25 pages (500 events max)
        max_pages = 25
        for page_num in range(1, max_pages + 1):
            url = base_url if page_num == 1 else f"{base_url}/{page_num}"
            logger.info("[%s] Page %d : %s", self.name, page_num, url)

            await self._random_delay()
            try:
                await page.goto(url, wait_until="domcontentloaded", timeout=30000)
                await page.wait_for_load_state("networkidle", timeout=15000)
            except Exception:
                logger.exception("[%s] Erreur navigation %s", self.name, url)
                break

            html = await page.content()
            soup = BeautifulSoup(html, "html.parser")

            # Extraire les événements (ul.lstline > li)
            items = soup.select(SEL_EVENT_ITEM)
            if not items:
                logger.warning("[%s] Aucun item trouvé page %d", self.name, page_num)
                break

            page_events = 0
            for item in items:
                try:
                    event = self._parse_event(item)
                    if event:
                        events.append(event)
                        page_events += 1
                except Exception:
                    logger.exception("[%s] Erreur parsing event", self.name)
                    continue

            logger.info(
                "[%s] Page %d : %d événements extraits", self.name, page_num, page_events
            )

            # Si la page n'a retourné aucun événement → fin de pagination
            if page_events == 0:
                break

            # Vérifier s'il y a un lien ">" (page suivante) dans span.pagination
            has_next = False
            for link in soup.select(SEL_PAGINATION_NEXT):
                if link.get_text(strip=True) == ">":
                    has_next = True
                    break
            if not has_next:
                break

        logger.info("[%s] Total : %d foires/salons scrapés", self.name, len(events))
        return events

    def _parse_event(self, item: Tag) -> ScrapedEvent | None:
        """Parse un élément <li> en ScrapedEvent.

        Structure attendue :
          li
            div.ttl
              a          → titre + href (lien détail avec code postal)
              p (1er)    → " Ville Département-textuel"
              p (2e)     → "Le 29/03/2026" ou "28/03/2026 au 29/03/2026"
              p (3e)     → "Foire - Salon, Brocante - Vide-grenier"
            div.dsc      → description
        """
        # Ignorer les LI publicitaires / suggestions (class="suggest", ou sans div.ttl)
        ttl_div = item.select_one(".ttl")
        if not ttl_div:
            return None

        # Titre (premier <a> direct dans div.ttl)
        title_el = ttl_div.select_one("a")
        if not title_el:
            return None
        nom = title_el.get_text(strip=True)
        if not nom or len(nom) < 3:
            return None

        # Lien détail — href contient le code postal entre parenthèses
        href = str(title_el.get("href", ""))
        detail_url = href if href.startswith("http") else f"{BASE_URL}{href}"

        # Récupérer tous les <p> dans div.ttl
        paragraphs = ttl_div.find_all("p")

        # Lieu — premier <p> : " Ville Département-textuel"
        ville = ""
        departement = "00"
        if len(paragraphs) >= 1:
            location_text = paragraphs[0].get_text(strip=True)
            # Extraire la ville (premier mot avant le nom du département)
            # Format typique : "Tours Indre-et-Loire" ou "Montargis Loiret"
            ville = location_text.strip()

        # Extraire le département depuis le code postal dans l'URL
        # Format href : .../tours(37000) → dept = "37"
        cp_match = re.search(r"\((\d{5})\)", href)
        if cp_match:
            departement = cp_match.group(1)[:2]
        elif ville:
            departement = _extract_department(ville)

        if not ville:
            ville = "Inconnue"

        # Dates — deuxième <p>
        date_debut: datetime | None = None
        date_fin: datetime | None = None
        if len(paragraphs) >= 2:
            date_text = paragraphs[1].get_text(strip=True)
            date_debut, date_fin = _parse_date(date_text)

        if not date_debut:
            logger.debug("[%s] Pas de date pour '%s'", self.name, nom)
            return None
        if not date_fin:
            date_fin = date_debut

        # Catégories — troisième <p> : "Foire - Salon, Brocante - Vide-grenier"
        category_text = ""
        if len(paragraphs) >= 3:
            category_text = paragraphs[2].get_text(strip=True)
        type_evenement = _guess_type(f"{nom} {category_text}")

        # Description — div.dsc
        dsc_el = item.select_one(SEL_EVENT_DESCRIPTION)
        description = dsc_el.get_text(strip=True) if dsc_el else ""

        # Région
        region = DEPT_TO_REGION.get(departement[:2], "")

        return ScrapedEvent(
            nom=nom,
            ville=ville,
            departement=departement,
            date_debut=date_debut,
            date_fin=date_fin,
            description=description[:500] if description else "",
            region=region,
            site_web=detail_url,
            source_url=detail_url or f"{BASE_URL}{LISTING_PATH}",
            source_nom=self.name,
            type_evenement=type_evenement,
            recurrence="ANNUEL",
        )
