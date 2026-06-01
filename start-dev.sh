#!/bin/bash
# Supprimer le DATABASE_URL hérité du shell parent (format asyncpg de heimdall)
# Next.js chargera automatiquement le .env du projet via dotenv
unset DATABASE_URL
exec npx next dev --port 3002
