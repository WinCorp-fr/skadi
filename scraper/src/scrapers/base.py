"""BaseScraper abstrait : gestion Playwright, anti-détection, rate-limiting."""

import asyncio
import logging
import random
from abc import ABC, abstractmethod

from playwright.async_api import Browser, Page, async_playwright

from ..config import settings
from ..dedup import ScrapedEvent

logger = logging.getLogger(__name__)

# Rotation User-Agent pour anti-détection
USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.2 Safari/605.1.15",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
]


class BaseScraper(ABC):
    """Classe de base pour tous les scrapers.

    Gère le cycle de vie Playwright, les délais anti-détection,
    et la rotation User-Agent. Les sous-classes implémentent scrape().
    """

    # Nom du scraper (utilisé pour les logs et source_nom en DB)
    name: str = "base"

    def __init__(self) -> None:
        self._pw: object | None = None  # Playwright instance
        self._browser: Browser | None = None
        self._page: Page | None = None

    async def _random_delay(self) -> None:
        """Délai aléatoire entre les requêtes (anti-détection)."""
        delay = random.uniform(settings.scrape_delay_min, settings.scrape_delay_max)
        logger.debug("Délai anti-détection : %.1fs", delay)
        await asyncio.sleep(delay)

    async def _setup_browser(self) -> Page:
        """Initialise Playwright avec un User-Agent aléatoire."""
        self._pw = await async_playwright().start()
        self._browser = await self._pw.chromium.launch(headless=True)
        context = await self._browser.new_context(
            user_agent=random.choice(USER_AGENTS),
            viewport={"width": 1920, "height": 1080},
            locale="fr-FR",
        )
        self._page = await context.new_page()
        return self._page

    async def _teardown_browser(self) -> None:
        """Ferme proprement le navigateur et arrête Playwright."""
        if self._browser:
            await self._browser.close()
            self._browser = None
            self._page = None
        if self._pw:
            await self._pw.stop()  # type: ignore[union-attr]
            self._pw = None

    async def run(
        self,
        filtres: dict[str, str] | None = None,
    ) -> list[ScrapedEvent]:
        """Exécute le scraping avec gestion du navigateur.

        Args:
            filtres: Filtres optionnels (region, departement)

        Returns:
            Liste des événements scrapés
        """
        logger.info("[%s] Démarrage du scraping...", self.name)
        try:
            page = await self._setup_browser()
            events = await self.scrape(page, filtres or {})
            logger.info("[%s] %d événements trouvés", self.name, len(events))
            return events
        except Exception:
            logger.exception("[%s] Erreur pendant le scraping", self.name)
            raise
        finally:
            await self._teardown_browser()

    @abstractmethod
    async def scrape(
        self,
        page: Page,
        filtres: dict[str, str],
    ) -> list[ScrapedEvent]:
        """Scrape le site et retourne les événements bruts.

        À implémenter par chaque scraper concret.

        Args:
            page: Page Playwright prête à naviguer
            filtres: Filtres optionnels (region, departement)

        Returns:
            Liste des ScrapedEvent extraits
        """
        ...
