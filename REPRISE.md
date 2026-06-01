# Reprise — skadi

## Prompt à copier-coller pour la prochaine session

```
On reprend le projet skadi (prospection foires/marchés pour un client fromager).

Contexte :
- Sous-projet dans C:\Users\tanph\OneDrive (1)\OneDrive\Documents\wincorp-workspace\skadi\
- Phase 1 TERMINÉE (24/03/2026) : scaffolding Next.js 14, Prisma 7, shadcn/ui, BullMQ, 9 pages, CRUD événements complet, page paramètres, dashboard agents
- Build OK (npx next build passe sans erreur)
- Le plan complet est dans C:\Users\tanph\.claude\plans\misty-conjuring-mccarthy.md

Avant de coder :
1. Lis le CLAUDE.md du projet : C:\Users\tanph\OneDrive (1)\OneDrive\Documents\wincorp-workspace\skadi\.claude\CLAUDE.md
2. Lis le plan : C:\Users\tanph\.claude\plans\misty-conjuring-mccarthy.md
3. Résume-moi l'état en 3 lignes et attends ma confirmation

On attaque la Phase 2 : Scraping Agent Python + Analyse Agent IA.
Les étapes :
1. Créer le module Python scraper/ (pyproject.toml, BaseScraper, config, models SQLAlchemy, consumer Redis)
2. Premier scraper : fetesmedievales.com (Playwright + BeautifulSoup)
3. Moteur de dédoublonnage (hash + fuzzy Levenshtein)
4. Analyse Agent TS (Claude Haiku batch, catégorisation + scoring pertinence fromager)
5. Route API /api/agents/trigger pour déclencher le scraping depuis le dashboard
6. Chaînage scraping → analyse dans l'orchestrateur

Prérequis infra :
- PostgreSQL doit tourner (docker compose -f docker-compose.dev.yml up -d postgres redis depuis svartalfheim/)
- Il faut créer le schéma foires en base et lancer npx prisma migrate dev --name init si pas encore fait
- Les clés API (ANTHROPIC_API_KEY, ORS_API_KEY) doivent être renseignées dans .env
```

## Fichiers clés à relire en début de session

| Fichier | Contenu |
|---------|---------|
| `.claude/CLAUDE.md` | État projet, à faire, erreurs connues (ERR-F01 à F04) |
| `prisma/schema.prisma` | 7 modèles, 7 enums — le schéma de données complet |
| `src/lib/orchestrator.ts` | Orchestrateur central + chaînage auto |
| `src/lib/queues.ts` | 5 queues BullMQ (scraping, analysis, geocoding, costs, email) |
| `src/lib/actions/evenements.ts` | Server Actions CRUD événements |
| `.env` | Variables d'environnement (DB, Redis, API keys) |
