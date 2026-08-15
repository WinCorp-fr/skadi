# [Nom du module] — Specification

> **Statut :** DRAFT | READY | IMPLEMENTED | DEPRECATED
> **Version :** 1.0
> **Niveau :** 1 (leger) | 2 (standard) | 3 (exhaustif)
> **Auteur :** [prenom nom]
> **Date de creation :** [YYYY-MM-DD]

<!-- GUIDE DES NIVEAUX — ce bloc se SUPPRIME de la spec produite AVANT le passage READY :
  il contient lui-meme la chaine du gate grep ("A CLARIFIER") et rendrait le gate
  infranchissable s'il restait dans la spec.
  Niveau 1 (leger)   : Sections 1, 3, 4, 6 obligatoires. Le reste optionnel (section 8 recommandee).
  Niveau 2 (standard): Toutes les sections obligatoires (dont 8. Verificateur deterministe).
  Niveau 3 (exhaustif): Toutes les sections + decomposition multi-fichiers.
  Section 9 (Agent-operable by design) : obligatoire si produit commercialisable a cycle de vie
    opere, sinon 1 ligne "Hors perimetre : <classe>" (perimetre : feedback_agent_operable_by_design).
  Section 10 (Human-operable by design) : obligatoire meme perimetre que la 9 (deltas : skills OUT,
    backends sans utilisateur final OUT, dashboards-tenant IN — UI acquise, acces authentifie a
    verifier — feedback_human_operable_by_design), sinon 1 ligne "Hors perimetre : <classe>".
  Section 11 (Changelog) : toujours renseignee, tous niveaux.
  Marqueur d'ambiguite [A CLARIFIER: question] (greffe Spec Kit /clarify, 2026-08-15) :
    toute ambiguite rencontree PENDANT la redaction se trace inline avec ce marqueur —
    jamais de resolution par devinette (regle 3 SDD). Un DRAFT peut en contenir ; le
    passage READY exige ZERO marqueur residuel (verif mecanique : grep -c "A CLARIFIER"
    sur la spec == 0, chaque marqueur resolu avec le user ou converti en decision tracee
    au changelog). Les formules d'esquive non marquees ("a definir", "TBD", "a preciser")
    sont interdites : les convertir en marqueur, sinon elles echappent au gate grep.
    Aucun hook ne porte ce gate a ce jour — verification par l'agent/humain au passage
    READY (hook en backlog). Piege connu : un marqueur SEUL comme unique contenu de la
    section 8 « Verificateur deterministe » serait refuse a la creation par le hook
    block-spec-without-verifier (il compte comme placeholder) — y declarer au minimum la
    boucle pressentie (tranchee au plan amont), le marqueur venant EN PLUS sur une ligne
    distincte.
-->

---

## 1. Objectif

<!-- OBLIGATOIRE tous niveaux. 1-3 phrases. Pourquoi ce module existe. Quel probleme il resout. -->

## 2. Perimetre

<!-- Niveau 2+ obligatoire. Niveau 1 optionnel mais recommande. -->

### IN — Ce que le module fait

- ...

### OUT — Ce que le module ne fait PAS

<!-- Aussi important que le IN. Evite le scope creep. -->

- ...

---

## 3. Interface

<!-- OBLIGATOIRE tous niveaux. -->

### Fonction(s) principale(s)

```
nomDeLaFonction(param1: Type, param2: Type): ReturnType
```

### Inputs

| Param | Type | Obligatoire | Description | Valeur par defaut | Exemple |
|-------|------|:-----------:|-------------|-------------------|---------|
| | | | | | |

### Outputs

| Champ | Type | Description | Exemple |
|-------|------|-------------|---------|
| | | | |

### Erreurs

| Code / Type | Condition de declenchement | Message / Comportement |
|-------------|---------------------------|------------------------|
| | | |

---

## 4. Regles metier

<!-- OBLIGATOIRE tous niveaux. Chaque regle = un test. Numerotation stable (ne pas renumeroter si suppression). -->

- **R1:** [Description de la regle]
  - *Ref :* [source normative, lien, doc interne — si applicable]

- **R2:** [...]

---

## 5. Edge cases

<!-- Niveau 2+ obligatoire. Situations limites, inputs degrades, cas rares mais possibles. -->

- **EC1:** [Situation] → [Comportement attendu]
- **EC2:** [...]

---

## 6. Exemples concrets

<!-- OBLIGATOIRE tous niveaux. -->

### Cas nominal

```
Input:  [...]
Output: [...]
```

### Cas d'erreur

```
Input:  [...]
Output: [erreur attendue]
```

<!-- Ajouter autant d'exemples que necessaire pour lever toute ambiguite. -->

---

## 7. Dependances & contraintes

<!-- Niveau 2+ obligatoire. -->

### Techniques

- Runtime : [Node >= 20 / Python >= 3.11 / ...]
- Module system : [ESM / CJS / ...]
- Dependances externes : [liste ou "aucune"]

### Performance

- [ex: < 2s pour 10k lignes d'entree]

### Securite

- [ex: pas de donnees client en clair dans les logs]

---

## 8. Verificateur deterministe

<!-- Niveau 2+ obligatoire. Niveau 1 recommande. Principe (Karpathy, Sequoia Ascent 30/04/2026) :
     le logiciel classique automatise ce qu'on peut SPECIFIER ; les LLM automatisent ce qu'on
     peut VERIFIER. Un agent ne peut boucler en autonomie sur ce module que s'il dispose d'un
     signal pass/fail automatique. Cette section definit ce signal — et ce qu'il ne couvre PAS.
     Retro-fit : si la spec a deja un invariant gate / mapping tests, cette section les
     REFERENCE (path:line), elle ne les duplique pas. -->

### Boucle de verification (signal pass/fail automatique)

<!-- La commande — ou sequence chainee `&&` / cible npm-make — qu'un agent execute en boucle
     (exit 0 = pass). Elle DOIT inclure le gate bloquant-deploiement (build/lint/typecheck/
     couverture), pas seulement les tests : un pytest/vitest vert avec lint ou build rouge
     = faux pass. Deterministe obligatoire : meme input => meme verdict. Un LLM-judge /
     auto-scoring n'est PAS un verificateur (meme input, verdict variable).
     Oracles mobilisables : tests Rx/ECx (section 4. Regles metier ci-dessus), moteur mimir
     (wincorp_common.compta.revision — pour les modules qui le consomment), invariants
     comptables (balance equilibree, TVA au centime, FEC conforme A.47 A-1),
     build/lint/typecheck.
     Module non executable localement (infra, deploy, migration) : nommer l'environnement du
     verificateur (CI, healthcheck post-deploy staging) — l'absence de boucle locale est un
     item explicite du residu ci-dessous, jamais un blanc. -->

```
[commande ou sequence, ex: ruff check . && mypy . && pytest --cov -q]
```

Budget de boucle : [N iterations / duree max avant STOP + escalade au checkpoint humain]

### Residu non verifiable mecaniquement → checkpoint humain

<!-- Ce que la boucle NE prouve PAS. Chaque item nomme le checkpoint humain qui le ferme
     (smoke E2E PROD, dimension audit-360, baseline N+30j, jugement metier, validation
     visuelle) — raccorde aux conditions IMPLEMENTED existantes, pas de checklist parallele.
     Liste vide = a justifier explicitement. Pieges : (a) un module deterministe teste sur
     fixtures synthetiques garde un residu — la justesse sur donnees reelles n'est jamais
     prouvee par la boucle (=> smoke E2E PROD) ; (b) front/visuel : boucle mince (build +
     lint + typecheck + a11y) et residu epais (hierarchie, esthetique) est un remplissage
     LEGITIME — ne pas fabriquer un faux oracle visuel. -->

- [ex: justesse des chiffres sur dossier client reel → smoke E2E PROD (condition 2 IMPLEMENTED)]

---

## 9. Agent-operable by design

<!-- OBLIGATOIRE si le module est un produit commercialisable a cycle de vie opere (meme
     perimetre que multi-tenant by design — table IN/ADAPTE/OUT des cas limites : skills,
     dashboards-tenant, vitrines, librairies → memory/feedback_agent_operable_by_design.md).
     Module hors perimetre : remplacer le contenu par 1 ligne "Hors perimetre : <classe
     d'objet>" — jamais un blanc.
     Principe (Karpathy) : l'utilisateur des docs d'exploitation est desormais aussi souvent
     un agent qu'un humain. Une operation accessible uniquement par clic UI est invisible
     pour un agent — le produit reste a charge de Tan a vie. -->

### Voie scriptable (CLI / API)

<!-- Chaque operation cle du cycle de vie a son equivalent scriptable : operer (actions
     metier recurrentes), deployer, diagnostiquer (sante, derniers runs, erreurs).
     Operation offerte en UI sans equivalent scriptable = justification explicite ici
     (ex : validation humaine legale). -->

| Operation cle | Commande / endpoint |
|---------------|---------------------|
| [deployer]    | [...] |
| [diagnostiquer] | [...] |

### AGENTS.md (racine du repo)

<!-- Adresse un agent FRAIS (sans la conversation d'origine) : commandes exactes
     copiables-collables, pre-requis (env vars, secrets garm, acces), erreurs connues +
     remede. Complement d'EXPLOITATION.md (humain : cas d'usage nommes), pas doublon ;
     distinct du CLAUDE.md du repo (comportement en session de dev). Redige AU FIL du
     build, pas apres. Anti-drift : toute PR qui change la surface deploy/API/CLI met a
     jour AGENTS.md dans la MEME PR. -->

- Emplacement : `[repo]/AGENTS.md` — etapes humaines legitimes (DNS registrar, agrement
  plateforme) explicitement listees dedans, jamais implicites.

### Logs structures

<!-- JSON/JSONL ou cle=valeur stable, sur les services/batchs diagnosticables. Un front
     s'appuie sur les logs structures de son backend (exiger du JSON d'une vitrine =
     sur-ingenierie). -->

- [ex: worker emet JSONL {ts, level, run_id, msg} — filtrable par niveau/champ sans regex fragile]

### Test d'acceptation (test Karpathy)

<!-- Protocole anti-theatre : prompt de l'agent frais STRICTEMENT limite a "suis les
     instructions de <repo>/AGENTS.md pour <operation>" — aucune commande, aucun credential,
     aucun indice dans le prompt. Zero clic manuel hors etapes humaines listees dans
     AGENTS.md. "Zero clic" mesure la SCRIPTABILITE — il n'annule JAMAIS les checkpoints
     humains dus (confirmation avant deploy PROD / action destructive). Echec de l'agent =
     AGENTS.md incomplet, pas "agent pas doue". Rejouer a chaque changement de la surface
     deploy/API/CLI. -->

- Phrase du test : [ex: "deploie <produit> en suivant AGENTS.md"]
- Preuve = artefact date : [chemin du log/transcript de la run + SHA du repo au moment du
  test — "test passe" sans artefact = non passe]

---

## 10. Human-operable by design

<!-- OBLIGATOIRE si le module est un produit commercialisable a cycle de vie opere (meme
     perimetre que la section 9 ; deltas : skills OUT — pas d'utilisateur final non
     technicien ; backends sans utilisateur final direct OUT — volet porte par le produit
     consommateur ; dashboards-tenant IN — UI acquise mais acces authentifie A VERIFIER,
     jamais presume ; table complete : memory/feedback_human_operable_by_design.md).
     Module hors perimetre : remplacer le contenu par 1 ligne "Hors perimetre : <classe
     d'objet>" — jamais un blanc.
     Principe : la regle 8 couvre l'operateur (EXPLOITATION.md), la section 9 couvre
     l'agent — cette section couvre l'UTILISATEUR FINAL non technicien. Une capacite
     accessible uniquement en CLI ou cockpit interne est invisible pour lui (cas
     fondateur : thor, 4 mois de capacites CLI-only). -->

### UI web (operations metier recurrentes)

<!-- Chaque operation metier recurrente de l'utilisateur final a son ecran : login simple
     (email/mdp), zero installation, zero config, zero terminal cote utilisateur.
     Operation volontairement absente de l'UI = justification explicite ici. -->

| Operation utilisateur | Ecran / parcours |
|-----------------------|------------------|
| [operation cle]       | [...] |

### Onboarding + guide 1 page

<!-- Onboarding DANS le produit : premier parcours guide ou etat vide actionnable (jamais
     un ecran blanc). Guide 1 page NON TECHNIQUE (quoi cliquer, avec captures) — document
     derive de l'UI : toute PR qui modifie un ecran couvert met a jour le guide et ses
     captures dans la MEME PR (anti-drift, meme regle que AGENTS.md section 9). -->

- Emplacement du guide : [ex: `<repo>/docs/GUIDE-UTILISATEUR.md` + canal de distribution]

### Test d'acceptation (test « collegue »)

<!-- Miroir du test Karpathy : un utilisateur NON TECHNICIEN — nomme A PRIORI ci-dessous,
     ni l'auteur du produit, ni Tan, n'ayant jamais utilise le produit NI son predecesseur
     (cockpit interne inclus) — muni de l'URL + identifiants + guide 1 page, execute
     l'operation cle nommee ci-dessous de bout en bout SANS assistance ni terminal
     (aucun coaching, aucune demo prealable). Echec = guide ou UI incomplets, jamais
     "utilisateur pas a l'aise". Changement d'operation cle = amendement de spec trace au
     changelog. Rejeu = non-regression du guide quand un ecran du tableau UI web change
     (testeur deja forme accepte ; parcours a froid exige au test initial seul).
     Pour un produit IN, la condition 2 IMPLEMENTED n'est close qu'avec cette capture
     (rules/03-sdd.md condition 2, amendee 2026-08-14) — une capture de l'auteur/Tan
     valide le smoke technique seul. "Zero technique" mesure le parcours utilisateur,
     jamais les checkpoints d'exploitation (deploy, migrations). NON exiges : design
     system complet, i18n, accessibilite AAA, app mobile, inscription publique. -->

- Operation cle testee : [...]
- Testeur pressenti (nomme a priori, jamais utilise le produit ni son predecesseur) : [...]
- Preuve = capture « OK » datee + version servie : [ex: `/api/health/version` + chemin capture]

---

## 11. Changelog

| Version | Date | Modification |
|---------|------|--------------|
| 1.0 | YYYY-MM-DD | Creation initiale |
