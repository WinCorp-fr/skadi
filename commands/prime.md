# Prime — Contexte skadi

Au démarrage de session, relis intégralement :

1. `.claude/CLAUDE.md` — état prod Vercel, niveaux de protection, erreurs connues (ERR-F01 à F08), backlog
2. `prisma/schema.prisma` — modèle de données (cohérence avec scraper/src/models.py requise)
3. `src/lib/prisma.ts` — monkey-patch IPv4 critique Vercel (ERR-F04, ne pas simplifier)
4. `REPRISE.md` — prompt de reprise session précédente

Résume en 5-10 bullets : état actuel, chantier en cours, bugs ouverts, dernières décisions.
