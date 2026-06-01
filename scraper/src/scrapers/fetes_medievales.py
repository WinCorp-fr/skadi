"""Scraper pour fetes-medievales.com — foires et fêtes médiévales.

Le site liste les événements médiévaux par région avec dates, lieu, type.
Structure HTML : div.col-lg-3.item-search > div.single-post-wrap > (div.thumb + div.post-details)
Les sélecteurs CSS sont isolés en constantes pour faciliter la maintenance si le site change.

Sélecteurs vérifiés le 29/03/2026 sur la version live du site.
Lancer avec --scrape-once fetes_medievales pour tester.
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

BASE_URL = "https://www.fetes-medievales.com"
LISTING_URL = f"{BASE_URL}/evenements-a-venir"

# Sélecteurs CSS (vérifiés 29/03/2026)
SEL_EVENT_CARD = "div.col-lg-3.item-search"
SEL_EVENT_TITLE = ".post-details h6"
SEL_EVENT_LOCATION = ".post-details .localisation"
SEL_EVENT_DATE = ".post-details .meta .date"
SEL_EVENT_DESCRIPTION = ".thumb .tag"  # badge type (pas de description en listing)
SEL_EVENT_LINK = ".post-details h6 a[href], .thumb > a[href]"
SEL_PAGINATION_NEXT = "ul.pagination a:not(.current-page)"

# Mapping département → région (les plus courants, complété au fur et à mesure)
DEPT_TO_REGION: dict[str, str] = {
    "01": "Auvergne-Rhône-Alpes", "03": "Auvergne-Rhône-Alpes",
    "07": "Auvergne-Rhône-Alpes", "15": "Auvergne-Rhône-Alpes",
    "26": "Auvergne-Rhône-Alpes", "38": "Auvergne-Rhône-Alpes",
    "42": "Auvergne-Rhône-Alpes", "43": "Auvergne-Rhône-Alpes",
    "63": "Auvergne-Rhône-Alpes", "69": "Auvergne-Rhône-Alpes",
    "73": "Auvergne-Rhône-Alpes", "74": "Auvergne-Rhône-Alpes",
    "13": "Provence-Alpes-Côte d'Azur", "83": "Provence-Alpes-Côte d'Azur",
    "84": "Provence-Alpes-Côte d'Azur", "06": "Provence-Alpes-Côte d'Azur",
    "04": "Provence-Alpes-Côte d'Azur", "05": "Provence-Alpes-Côte d'Azur",
    "31": "Occitanie", "34": "Occitanie", "30": "Occitanie",
    "11": "Occitanie", "66": "Occitanie", "09": "Occitanie",
    "12": "Occitanie", "32": "Occitanie", "46": "Occitanie",
    "65": "Occitanie", "81": "Occitanie", "82": "Occitanie",
    "48": "Occitanie",
    "33": "Nouvelle-Aquitaine", "40": "Nouvelle-Aquitaine",
    "47": "Nouvelle-Aquitaine", "64": "Nouvelle-Aquitaine",
    "24": "Nouvelle-Aquitaine", "17": "Nouvelle-Aquitaine",
    "16": "Nouvelle-Aquitaine", "19": "Nouvelle-Aquitaine",
    "23": "Nouvelle-Aquitaine", "79": "Nouvelle-Aquitaine",
    "86": "Nouvelle-Aquitaine", "87": "Nouvelle-Aquitaine",
    "44": "Pays de la Loire", "49": "Pays de la Loire",
    "53": "Pays de la Loire", "72": "Pays de la Loire",
    "85": "Pays de la Loire",
    "22": "Bretagne", "29": "Bretagne", "35": "Bretagne", "56": "Bretagne",
    "75": "Île-de-France", "77": "Île-de-France", "78": "Île-de-France",
    "91": "Île-de-France", "92": "Île-de-France", "93": "Île-de-France",
    "94": "Île-de-France", "95": "Île-de-France",
    "45": "Centre-Val de Loire", "18": "Centre-Val de Loire",
    "28": "Centre-Val de Loire", "36": "Centre-Val de Loire",
    "37": "Centre-Val de Loire", "41": "Centre-Val de Loire",
}


def _extract_department(text: str) -> str:
    """Extrait le code département depuis un texte (ex: '(45)', 'Loiret (45)')."""
    match = re.search(r"\((\d{2,3})\)", text)
    if match:
        return match.group(1).zfill(2)[:3]
    # Essayer un code postal
    match = re.search(r"\b(\d{5})\b", text)
    if match:
        return match.group(1)[:2]
    return "00"


def _parse_dates(text: str) -> tuple[datetime | None, datetime | None]:
    """Parse une chaîne de dates francaise en (date_debut, date_fin).

    Gère les formats courants :
    - "14 juin 2026"
    - "14-15 juin 2026"
    - "du 14 au 16 juin 2026"
    - "14 juin au 15 juillet 2026"
    - "Du 28/03/2026 au 29/03/2026" (format fetes-medievales.com)
    - "Le 28/03/2026" (événement sur un seul jour)
    """
    text = text.strip().lower()

    # Format "du DD/MM/YYYY au DD/MM/YYYY" (format principal du site)
    match = re.search(r"du\s+(\d{2}/\d{2}/\d{4})\s+au\s+(\d{2}/\d{2}/\d{4})", text)
    if match:
        try:
            start = datetime.strptime(match.group(1), "%d/%m/%Y")
            end = datetime.strptime(match.group(2), "%d/%m/%Y")
            return start, end
        except ValueError:
            pass

    # Format "le DD/MM/YYYY" (jour unique)
    match = re.search(r"le\s+(\d{2}/\d{2}/\d{4})", text)
    if match:
        try:
            dt = datetime.strptime(match.group(1), "%d/%m/%Y")
            return dt, dt
        except ValueError:
            pass

    # Format "du X au Y" (mots, pas slashes)
    match = re.search(r"du\s+(.+?)\s+au\s+(.+)", text)
    if match:
        raw_start = match.group(1).strip()
        raw_end = match.group(2).strip()
        # Parser la date de fin d'abord (elle a toujours le mois)
        end = dateparser.parse(raw_end, languages=["fr"])
        # Si le début est juste un jour (ex: "14"), ajouter le mois/année de la fin
        if end and re.match(r"^\d{1,2}$", raw_start):
            start = end.replace(day=int(raw_start))
        else:
            start = dateparser.parse(raw_start, languages=["fr"])
        return start, end

    # Format "X-Y mois année" ou "X et Y mois année"
    match = re.search(r"(\d{1,2})\s*[-et]+\s*(\d{1,2})\s+(\w+\s+\d{4})", text)
    if match:
        start = dateparser.parse(f"{match.group(1)} {match.group(3)}", languages=["fr"])
        end = dateparser.parse(f"{match.group(2)} {match.group(3)}", languages=["fr"])
        return start, end

    # Date simple
    parsed = dateparser.parse(text, languages=["fr"])
    return parsed, parsed


def _extract_text(tag: Tag | None, selector: str) -> str:
    """Extrait le texte d'un sous-élément, ou chaîne vide."""
    if tag is None:
        return ""
    el = tag.select_one(selector)
    return el.get_text(strip=True) if el else ""


def _parse_location(text: str) -> tuple[str, str]:
    """Parse le texte localisation du site : 'Ville, Région' → (ville, région).

    Le site affiche directement la région (pas le département).
    Ex: 'Courson-Monteloup, Île-de-France' → ('Courson-Monteloup', 'Île-de-France')
    """
    if not text:
        return "Inconnue", ""
    parts = [p.strip() for p in text.split(",", 1)]
    ville = parts[0] if parts else "Inconnue"
    region = parts[1] if len(parts) > 1 else ""
    return ville, region


# Mapping des badges type du site vers notre enum
_TYPE_MAPPING: dict[str, str] = {
    "fête médiévale": "FOIRE_MEDIEVALE",
    "fete medievale": "FOIRE_MEDIEVALE",
    "marché médiéval": "FOIRE_MEDIEVALE",
    "marche medieval": "FOIRE_MEDIEVALE",
    "festival": "FOIRE_MEDIEVALE",
    "reconstitution": "FOIRE_MEDIEVALE",
    "campement": "FOIRE_MEDIEVALE",
    "spectacle": "FOIRE_MEDIEVALE",
    "tournoi": "FOIRE_MEDIEVALE",
    "banquet": "FOIRE_MEDIEVALE",
    "salon": "SALON",
    "brocante": "BROCANTE",
    "marché": "MARCHE",
    "foire": "FOIRE_ARTISANALE",
}


def _map_event_type(badge_text: str) -> str:
    """Mappe le texte du badge type vers notre enum d'événement."""
    if not badge_text:
        return "FOIRE_MEDIEVALE"
    normalized = badge_text.strip().lower()
    for key, value in _TYPE_MAPPING.items():
        if key in normalized:
            return value
    # Défaut : tout événement de ce site est médiéval
    return "FOIRE_MEDIEVALE"


class FetesMedievalesScraper(BaseScraper):
    """Scraper pour fetes-medievales.com."""

    name = "fetes_medievales"

    async def scrape(
        self,
        page: Page,
        filtres: dict[str, str],
    ) -> list[ScrapedEvent]:
        """Scrape l'agenda des fêtes médiévales."""
        events: list[ScrapedEvent] = []
        url = LISTING_URL

        # Filtre par département : le site ne supporte pas de query param,
        # on filtre côté client après scraping.

        page_num = 0
        max_pages = 10  # Garde-fou

        while url and page_num < max_pages:
            page_num += 1
            logger.info("[%s] Page %d : %s", self.name, page_num, url)

            await self._random_delay()
            await page.goto(url, wait_until="domcontentloaded", timeout=30000)

            # Attendre que le contenu charge
            await page.wait_for_load_state("networkidle", timeout=15000)

            html = await page.content()
            soup = BeautifulSoup(html, "html.parser")

            # Extraire les cartes événements
            cards = soup.select(SEL_EVENT_CARD)
            if not cards:
                logger.warning(
                    "[%s] Aucune carte trouvée avec les sélecteurs '%s'. "
                    "Vérifier les sélecteurs CSS.",
                    self.name,
                    SEL_EVENT_CARD,
                )
                break

            for card in cards:
                try:
                    event = self._parse_card(card)
                    if event:
                        events.append(event)
                except Exception:
                    # Log + élément suivant (jamais crasher la boucle entière)
                    logger.exception("[%s] Erreur parsing carte", self.name)
                    continue

            # Pagination : chercher le lien ">" (page suivante)
            next_url = self._find_next_page(soup, page_num)
            url = next_url

        # Filtrer par région si demandé
        if "region" in filtres:
            region_filter = filtres["region"].lower()
            events = [e for e in events if region_filter in e.region.lower()]

        # Filtrer par département si demandé (filtrage client)
        if "departement" in filtres:
            dept_filter = filtres["departement"]
            events = [e for e in events if e.departement.startswith(dept_filter)]

        logger.info("[%s] Total : %d événements scrapés", self.name, len(events))
        return events

    @staticmethod
    def _find_next_page(soup: BeautifulSoup, current_page: int) -> str:
        """Trouve l'URL de la page suivante depuis la pagination.

        La pagination du site est :  [1] [2] [3] ... [>] [>>]
        Le ">" pointe vers la page suivante. On cherche aussi le lien
        avec le numéro current_page + 1 en fallback.
        """
        pagination = soup.select_one("ul.pagination")
        if not pagination:
            return ""

        # Chercher le lien ">" (symbole suivant)
        for link in pagination.select("a"):
            if link.get_text(strip=True) == ">":
                href = link.get("href", "")
                if href:
                    return href if href.startswith("http") else f"{BASE_URL}{href}"

        # Fallback : chercher le lien vers page N+1
        next_num = str(current_page + 1)
        for link in pagination.select("a"):
            if link.get_text(strip=True) == next_num:
                href = link.get("href", "")
                if href:
                    return href if href.startswith("http") else f"{BASE_URL}{href}"

        return ""

    def _parse_card(self, card: Tag) -> ScrapedEvent | None:
        """Parse une carte HTML en ScrapedEvent.

        Structure attendue (vérifiée 29/03/2026) :
          div.col-lg-3.item-search
            div.single-post-wrap
              div.thumb          → image + badge type (a.tag)
              div.post-details
                div.meta > div.date → "Du 28/03/2026 au 29/03/2026"
                div.localisation    → "Courson-Monteloup, Île-de-France"
                h6 > a              → titre + lien détail
        """
        # Nom de l'événement
        nom = _extract_text(card, SEL_EVENT_TITLE)
        if not nom:
            return None

        # Lieu : format "Ville, Région"
        location_text = _extract_text(card, SEL_EVENT_LOCATION)
        ville, region_from_site = _parse_location(location_text)

        # Dates
        date_text = _extract_text(card, SEL_EVENT_DATE)
        date_debut, date_fin = _parse_dates(date_text)
        if not date_debut:
            logger.debug("[%s] Date non parsée pour '%s': '%s'", self.name, nom, date_text)
            return None

        if not date_fin:
            date_fin = date_debut

        # Type d'événement depuis le badge
        type_badge = _extract_text(card, SEL_EVENT_DESCRIPTION)

        # Lien vers la page détail
        link_tag = card.select_one(SEL_EVENT_LINK)
        detail_url = ""
        if link_tag and link_tag.get("href"):
            href = str(link_tag["href"])
            detail_url = href if href.startswith("http") else f"{BASE_URL}{href}"

        # Région : utiliser celle du site si disponible, sinon le mapping département
        departement = _extract_department(location_text)
        region = region_from_site or DEPT_TO_REGION.get(departement[:2], "")

        # Mapper le type badge vers notre enum
        type_evenement = _map_event_type(type_badge)

        return ScrapedEvent(
            nom=nom,
            ville=ville,
            departement=departement,
            date_debut=date_debut,
            date_fin=date_fin,
            description=type_badge[:500] if type_badge else "",
            region=region,
            site_web=detail_url,
            source_url=detail_url or LISTING_URL,
            source_nom=self.name,
            type_evenement=type_evenement,
            recurrence="ANNUEL",
        )
