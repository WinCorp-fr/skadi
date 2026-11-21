# skadi — Prospection foires/marches pour fromager

> **Yggdrasil** : Skadi — deesse de la chasse, exploration terrain. Royaume **Muspelheim** (Veille & R&D). Ex `skadi`.

## ÉTAT DU PROJET (02/04/2026)

Déployé sur Vercel. Backlog 18 points livré (sprints A→D, 30/03/2026). Progression : 97%.
1045 événements en BDD (789 actifs, 256 archivés). 3 scrapers, 5 agents, 10 pages, 4 onglets.
SMTP Gmail configuré. Client fromager basé à Gien (45).
En attente : session tests UI client.

## Niveaux de protection

### VERROU — ne jamais modifier sans instruction explicite
- `.env` — secrets SMTP, API keys, DATABASE_URL pooler
- `src/generated/prisma/` — généré par `npx prisma generate`, jamais éditer manuellement

### STABLE — modifier avec prudence, vérifier les régressions
- `prisma/schema.prisma` — cohérence avec `scraper/src/models.py` requise avant toute modif
- `src/lib/prisma.ts` — contient le monkey-patch IPv4 critique pour Vercel (ERR-F04, ne pas simplifier)

### CONVENTION — respecter la méthode indiquée
- `src/components/ui/` — composants shadcn/ui, modifier avec `npx shadcn@latest add` uniquement

## À FAIRE

1. Session tests UI client (toutes pages, pipeline, envoi email, templates)
2. Géocoder les ~50 événements restants sans coordonnées
3. Export PDF des rapports (si besoin client)
4. Authentification (optionnel)

## RÈGLES MÉTIER

- Catégories : FOIRE_MEDIEVALE, MARCHE, FOIRE_ARTISANALE, SALON, BROCANTE, AUTRE
- Pipeline : DECOUVERT → INTERESSE → PROSPECTION → RESERVE → CONFIRME → TERMINE → ARCHIVE
- Événements passés → archivés automatiquement, visibles /archives uniquement
- /evenements et /calendrier : futurs non archivés uniquement
- Coût carburant = distance × 2 × (conso/100) × prix_litre
- Seuil rentabilité = coût_total / (1 - marge_cible/100)
- IA : catégorisation + scoring pertinence uniquement (Claude Haiku, batch de 15)
- Emails : jamais envoyés sans validation manuelle (brouillon → prêt → envoyer)
- Dédoublonnage scraping : hash sur normalize(nom) + ville + date_debut = doublon exact, ignoré. Puis ressemblance nom + ville (seuil 85) départagée par la date : dates éloignées (> 30 jours, `dedup_same_edition_days`) = autre édition, insérée ; marché hebdomadaire de même nom, même ville, même jour de semaine = déjà connu, ignoré ; dates proches = doute, inséré « à revoir » (colonnes `doublon_possible_de_id` + `doublon_score`, ou note texte si la migration `db/migrations/20261121_fiches_a_revoir.up.sql` n'est pas appliquée) et détaillé au journal de la collecte. Un événement ressemblant n'est jamais écarté sans trace (correctif du 21/11/2026).
- Fiche « À revoir » : pastille et filtre « À revoir uniquement » dans `/evenements`, encadré sur la fiche avec « Ce n'est pas un doublon » (efface le signal) et « C'est un doublon » (archive, l'empreinte reste en base donc la fiche ne revient pas). Supprimer une fiche signalée est refusé côté serveur. Guide : `docs/fiches-a-revoir.md`
- Signal « à revoir » = `doublon_score IS NOT NULL` (survit à la suppression de la fiche ressemblante, `ON DELETE SET NULL` sur le lien)
- Base sans historique Prisma (pas de `prisma/migrations/`) : migrations en SQL brut dans `db/migrations/` (`.up.sql` + `.down.sql`), appliquées par le connecteur Supabase sur feu vert, AVANT le déploiement de l'application qui lit les nouvelles colonnes
- Tests application : `npm test` (vitest, Prisma simulé). Tests collecte : `cd scraper && python -m pytest tests`
- ANNUEL = ponctuel dans l'exercice (pas de nextOccurrence)

## CONVENTIONS SPÉCIFIQUES

- Next.js 14 App Router, React 18, TypeScript strict, Tailwind 3 (pas v4)
- shadcn/ui composants v4 (base-ui, pas Radix) — pas de `asChild`, wrapper `<Link>` autour de `<Button>` (ERR-F01)
- Prisma 7 avec adapter-pg : `new PrismaClient({ adapter: new PrismaPg(pool, { schema: "foires" }) })` (ERR-F03)
- Import Prisma : `from "@/generated/prisma/client"` (pas `@/generated/prisma`)
- DB : pooler Supabase transaction mode port 6543, `max: 1` dans Pool pg (ERR-F05)
- Pages dynamiques (DB) : `export const dynamic = "force-dynamic"` + try/catch
- Scraper Python : asyncpg avec `statement_cache_size=0` (ERR-F07), connexion DB ouverte AVANT Playwright (ERR-F08)
- Variable système `DATABASE_URL` override le .env — toujours passer explicitement (ERR-F06)

## ERREURS CONNUES

- **ERR-F01** — shadcn/ui v4 n'a pas `asChild` → wrapper `<Link>` autour du `<Button>`
- **ERR-F02** — globals.css : directives classiques `@tailwind base/components/utilities` avec variables HSL (Tailwind v3 vs shadcn imports v4)
- **ERR-F03** — Prisma v7 requiert un adapter pg
- **ERR-F04** — Vercel résout en IPv6, Supabase écoute IPv4 → monkey-patch `net.Socket.prototype.connect` dans prisma.ts, forcer `family: 4`
- **ERR-F05** — Session pooler Supabase : MaxClientsInSessionMode → Transaction pooler port 6543 + `max: 1`
- **ERR-F06** — Variable système DATABASE_URL override le .env Python du scraper
- **ERR-F07** — asyncpg + pooler transaction : DuplicatePreparedStatement → `statement_cache_size=0`
- **ERR-F08** — Playwright corrompt la stack réseau Windows → ouvrir connexion DB AVANT de lancer Playwright

## Spec-Driven Development (SDD)

Ce projet suit le framework SDD. Voir `saga/SPEC-DRIVEN-DEVELOPMENT.md`.
Specs locales dans `specs/`. Template : `specs/_SPEC-TEMPLATE.md`.

## Planification

Ce projet est éligible à `/ultraplan` (repo GitHub remote connecté).
Pour les chantiers > 30 min de planification prévisible, privilégier la voie : plan mode local → refine with Ultraplan.
