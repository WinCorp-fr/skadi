"""Connexion PostgreSQL directe via asyncpg pour le schéma foires.

Utilise asyncpg directement (pas SQLAlchemy) pour éviter les conflits
entre greenlets SQLAlchemy et Playwright sous Windows.
"""

import ssl
from urllib.parse import unquote, urlparse

import asyncpg

from .config import settings

# Parser l'URL pour extraire les composants (le mot de passe peut contenir %24 = $)
_parsed = urlparse(settings.database_url)
_password = unquote(_parsed.password or "")
_host = _parsed.hostname or "localhost"
_port = _parsed.port or 5432
_user = _parsed.username or "postgres"
_database = _parsed.path.lstrip("/") or "postgres"

# SSL pour Supabase
_ssl_context = ssl.create_default_context()
_ssl_context.check_hostname = False
_ssl_context.verify_mode = ssl.CERT_NONE


async def get_connection() -> asyncpg.Connection:
    """Crée une connexion asyncpg directe vers Supabase (schéma foires)."""
    return await asyncpg.connect(
        host=_host,
        port=_port,
        user=_user,
        password=_password,
        database=_database,
        ssl=_ssl_context,
        server_settings={"search_path": "foires,public"},
    )
