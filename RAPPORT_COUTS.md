# Rapport d'analyse des coûts — WinCorp Foires

**Date** : 29 mars 2026
**Projet** : skadi — Gestion de prospection foires/marchés pour fromager artisanal
**Auteur** : WinCorp
**Statut** : MVP déployé sur Vercel

---

## PARTIE 1 — Coûts pour le développeur (WinCorp)

### 1.1 Périmètre du projet livré

| Métrique | Valeur |
|---|---|
| Pages frontend | 11 (dashboard, événements, calendrier, pipeline, prospection, agents, rapports, archives, paramètres, détail, nouveau) |
| Routes API | 3 (trigger agents, envoi emails, debug) |
| Agents backend | 5 (scraping, analyse IA, géocodage, coûts, email) |
| Scrapers Python | 3 (jours-de-marche.fr, eterritoire.fr, fetes-medievales.com) |
| Modèles Prisma | 8 (Evenement, CoutEvenement, Prospection, EmailTemplate, ResultatEvenement, AgentJob, GeocodingCache, Parametres) |
| Événements en BDD | 1 045 (789 actifs, 256 archivés) |
| Événements analysés IA | 789 (100% des actifs) |
| Événements géocodés | 740 avec distances et coûts calculés |

### 1.2 Coûts de développement

| Poste | Détail | Coût |
|---|---|---|
| Temps de développement | ~6h de travail intense avec Claude Code | Valorisé ci-dessous |
| Abonnement Claude Code | Anthropic Max (200$/mois) | ~6.50$ pour 6h (au prorata) |
| Serveur de dev | Local (PC personnel) | 0€ |
| Hébergement Vercel | Hobby plan (gratuit) | 0€ |
| Base de données Supabase | Free tier (500 MB, 50k MAU) | 0€ |
| Domaine / DNS | Non acheté (URL Vercel par défaut) | 0€ |
| **Total dev** | | **~6€** |

**Remarque** : le coût réel du développement est le temps du développeur. À 50€/h (tarif freelance junior), 6h représentent 300€ de main-d'œuvre. Claude Code a permis de livrer en 6h ce qui aurait pris 3 à 5 jours (24-40h) sans assistance IA.

### 1.3 Stack technique utilisée (100% gratuite)

| Technologie | Rôle | Licence / Coût |
|---|---|---|
| Next.js 14 | Framework frontend + API routes | MIT, gratuit |
| React 18 | Bibliothèque UI | MIT, gratuit |
| TypeScript 5 | Typage statique | Apache 2.0, gratuit |
| Prisma 7 | ORM + migrations | Apache 2.0, gratuit |
| Tailwind CSS 3 | Styles utilitaires | MIT, gratuit |
| shadcn/ui v4 | Composants UI | MIT, gratuit |
| Recharts 3 | Graphiques | MIT, gratuit |
| Nodemailer 8 | Envoi d'emails SMTP | MIT, gratuit |
| Python 3.12 | Scrapers | PSF, gratuit |
| Playwright | Scraping web | Apache 2.0, gratuit |
| BeautifulSoup | Parsing HTML | MIT, gratuit |
| asyncpg | Connexion PostgreSQL (scrapers) | Apache 2.0, gratuit |

### 1.4 Coûts d'hébergement actuels (mars 2026)

| Service | Plan actuel | Coût mensuel | Suffisant ? |
|---|---|---|---|
| Vercel | Hobby (gratuit) | 0€ | ✅ Oui — 100 GB bande passante, largement suffisant pour 1 utilisateur |
| Supabase | Free (gratuit) | 0€ | ⚠️ Suffisant MAIS pause après 7j d'inactivité |
| OpenRouteService | Gratuit | 0€ | ✅ Oui — 2 000 req/jour, plus que nécessaire |
| Gmail SMTP | Gratuit | 0€ | ✅ Oui — 500 emails/jour |
| Anthropic API (Haiku 4.5) | Pay-as-you-go | ~0.50€/mois | ✅ Coût négligeable |
| **Total actuel** | | **~0.50€/mois** | |

### 1.5 Coûts d'exploitation en régime client

| Service | Plan cible | Coût mensuel |
|---|---|---|
| Vercel | Hobby (gratuit) | 0€ |
| Supabase | **Pro** (pas de pause, backups quotidiens) | 23€ |
| Anthropic API (Haiku 4.5) | ~100-300 nouveaux événements/mois | ~0.18 à 0.54€ |
| OpenRouteService | Gratuit | 0€ |
| SMTP client | Gmail gratuit ou SMTP pro du client | 0€ |
| **Total coûts réels** | | **~23.50€/mois** |

#### Détail du calcul API Anthropic (Haiku 4.5)

| Paramètre | Valeur |
|---|---|
| Tarif input | 1.00$ / million de tokens |
| Tarif output | 5.00$ / million de tokens |
| Batch de 15 événements | ~12 000 tokens input + ~3 000 tokens output |
| Coût par batch | 0.012$ + 0.015$ = **0.027$** |
| Pour 300 nouveaux événements/mois | 20 batchs × 0.027$ = **0.54$** (~0.50€) |

**En pratique** : les événements ne sont analysés qu'une fois (au scraping). Le coût IA est lié au nombre de **nouveaux** événements, pas au total en base. Coût négligeable.

### 1.6 Qui supporte quels coûts — modèle SaaS retenu

| Service | Situation actuelle | Modèle SaaS cible |
|---|---|---|
| Anthropic API | Clé perso développeur | Clé développeur, coût inclus dans l'abonnement |
| OpenRouteService | Clé perso développeur | Gratuit, reste sur clé développeur |
| Vercel | Compte WinCorp | Compte développeur, facturé via abonnement |
| Supabase | Projet développeur | Projet développeur, facturé via abonnement |
| Gmail SMTP | compte de test dédié | Client fournit son propre Gmail/SMTP |

**Principe** : le développeur gère l'infrastructure, le client paie un abonnement tout compris. Pas de transfert de comptes.

---

## PARTIE 2 — Proposition commerciale pour le client

### 2.1 Profil du client

| Critère | Description |
|---|---|
| Activité | Fromager artisanal |
| Structure | Couple (le client + sa femme) |
| CA annuel | ~200 000€ |
| Expérience marchés | Plusieurs années, réseau établi |
| Prospection actuelle | Réseau personnel + recherche ponctuelle, maîtrisé |
| Besoin principal | Découverte de nouvelles opportunités + optimisation des choix |

### 2.2 Valeur apportée — scénario conservateur

Le client est un professionnel expérimenté qui connaît ses marchés. L'outil ne remplace pas son expertise, il la complète.

#### Temps économisé (hypothèse conservatrice)

| Tâche | Sans l'outil | Avec l'outil | Économie |
|---|---|---|---|
| Recherche de nouvelles foires/marchés | ~2h/semaine | ~15 min | ~1h45/semaine |
| Évaluation de la pertinence | ~30 min/semaine | ~10 min (score IA) | ~20 min/semaine |
| Calcul des coûts de déplacement | ~30 min/semaine | 0 min (calcul auto) | ~30 min/semaine |
| Suivi des candidatures/contacts | ~30 min/semaine | ~10 min (pipeline) | ~20 min/semaine |
| **Total hebdomadaire** | **~3h30** | **~35 min** | **~3h/semaine** |

#### Valorisation financière conservatrice

| Indicateur | Calcul | Valeur |
|---|---|---|
| Heures économisées par mois | ~3h × 4 semaines | **~12h/mois** |
| Coût horaire estimé (artisan, 200k CA) | Valeur ajoutée horaire | ~30€/h |
| Économie mensuelle en temps | 12h × 30€ | **~360€/mois** |
| Coût de l'outil | Abonnement mensuel | 49€/mois |
| **Économie nette mensuelle** | | **~310€/mois** |
| **ROI mensuel** | | **~7x** |

#### Gains qualitatifs (le vrai levier)

- **Couverture exhaustive** : scraping automatique de 3 sources → le client ne rate plus les nouvelles foires dans sa zone, même celles qu'il n'aurait pas trouvées par le bouche-à-oreille
- **Seuil de rentabilité par événement** : avant de s'inscrire, il sait combien il doit vendre pour couvrir ses frais (déplacement, emplacement, temps). Fini les déplacements à perte
- **Filtre distance intelligent** : ne voir que les événements à moins de X km, adapté à son rayon d'action habituel
- **Historique de performance** : après chaque marché, il enregistre son CA réel. En 6 mois, il a une base de données personnelle de rentabilité par événement que personne d'autre ne possède
- **Prospection structurée** : emails personnalisés via templates, suivi dans un pipeline visuel — plus professionnel que les relances au feeling
- **Vue récurrents / ponctuels** : distinguer les marchés réguliers des foires one-shot
- **Archivage automatique** : les événements passés sont archivés, la vue principale reste propre

### 2.3 Tarification — Modèle SaaS tout compris

#### Formule unique

| Poste | Détail | Tarif |
|---|---|---|
| **Mise en service** | Configuration personnalisée, import des marchés existants, paramétrage zones géographiques, formation visio (1h) | **400€ HT** (paiement unique) |
| **Abonnement mensuel** | Hébergement + maintenance + support + coûts API inclus | **49€ HT/mois** |
| **Engagement** | 3 mois minimum, puis résiliable avec préavis d'1 mois | |

#### Détail de l'abonnement mensuel

**Inclus :**
- Hébergement Vercel + Supabase Pro (pas de coupure, backups quotidiens)
- Scraping automatique des nouvelles foires et marchés (3 sources)
- Scoring IA et calcul de rentabilité par événement
- Coûts API Anthropic inclus (jusqu'à 500 nouveaux événements/mois)
- Prospection email via ses propres templates
- Maintenance corrective (bugs, mises à jour sécurité)
- Support par email ou téléphone (réponse sous 48h ouvrables)
- 1 évolution mineure par trimestre (ajout d'un filtre, modification d'un template, etc.)

**Évolutions sur demande :**
- Évolution significative (nouvelle fonctionnalité, nouveau scraper, intégration) : **40€ HT/h**, devis préalable

#### Économie du modèle

| Poste | Montant |
|---|---|
| Abonnement mensuel | 49€ HT |
| Coûts réels d'infrastructure | -23.50€ |
| **Marge brute mensuelle** | **~25.50€** |
| Marge brute annuelle (hors setup) | ~306€ |
| Temps de maintenance estimé | ~1h/mois en moyenne |

### 2.4 Synthèse financière — scénario conservateur

| | Année 1 | Année 2+ |
|---|---|---|
| Coût total client | 400€ + 588€ = **988€ HT** | **588€ HT** |
| Économie temps estimée | ~4 320€ (12h/mois × 30€ × 12) | ~4 320€ |
| Gains qualitatifs | Meilleurs choix, moins de déplacements non rentables | Historique de performance |
| **ROI conservateur** | **~4,4x** | **~7,3x** |
| **Amortissement** | ~3 mois | Immédiat |

### 2.5 Comparaison avec les alternatives

| Solution | Coût 1ère année | Caractéristiques |
|---|---|---|
| Méthode actuelle (réseau + recherche ponctuelle) | 0€ (mais ~12h/mois = 4 320€ valorisés + opportunités ratées) | Éprouvée, mais pas exhaustive |
| CRM générique (HubSpot, Pipedrive) | 200-600€/an | Générique, pas adapté aux foires, pas de scraping |
| Solution sur mesure (agence web) | 5 000-15 000€ + maintenance | Équivalent mais bien plus cher |
| **WinCorp Foires** | **988€ HT** | **Sur mesure, IA, scraping auto, emailing, pipeline, calcul rentabilité** |

### 2.6 Résumé pour le client

```
┌────────────────────────────────────────────────────┐
│  MISE EN SERVICE :       400€ HT (une fois)        │
│  ABONNEMENT :             49€ HT / mois            │
│  ENGAGEMENT :              3 mois minimum           │
│                                                    │
│  COÛT ANNÉE 1 :          988€ HT                   │
│  ÉCONOMIE ESTIMÉE :    4 320€ / an (conservateur)  │
│  ROI :                   ~4,4x dès la 1ère année   │
│  AMORTISSEMENT :         ~3 mois                   │
└────────────────────────────────────────────────────┘
```

---

*Rapport généré le 29/03/2026 — WinCorp Foires v0.1.0*
