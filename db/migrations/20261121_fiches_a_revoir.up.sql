-- Migration additive : signal « à revoir » des fiches collectées (21/11/2026).
--
-- Pourquoi en SQL brut : la base n'a pas d'historique Prisma (aucun `prisma/migrations/`),
-- `prisma migrate deploy` la refuserait. `prisma/schema.prisma` décrit le même état.
--
-- doublon_possible_de_id : fiche déjà en base à laquelle la fiche collectée ressemble.
--                          ON DELETE SET NULL : supprimer la fiche ressemblante ne supprime pas
--                          le signal (porté par doublon_score).
-- doublon_score          : ressemblance nom + ville (0 à 1). Signal « à revoir » = NOT NULL.
--
-- Ordre de mise en service :
--   1. appliquer cette migration (l'application d'avant l'ignore, la collecte tolère les deux
--      états) ;
--   2. déployer ENSEMBLE l'application (Prisma lit toutes les colonnes du modèle : déployée
--      avant la migration, elle tombe) et la collecte (une collecte d'avant ce changement
--      continuerait d'écrire des notes texte au lieu des colonnes) ;
--   3. après la première collecte, vérifier qu'aucune nouvelle note n'a été posée :
--      SELECT count(*) FROM foires.evenements
--       WHERE notes LIKE 'À revoir : doublon possible de %' AND created_at >= <date de bascule>;
--      attendu : 0.
-- Reprise de l'existant : les fiches déjà signalées par la note texte (collecte d'avant
-- migration) reçoivent leurs colonnes, et la phrase générée est retirée de leur note (le
-- reste de la note, écrit par l'utilisateur, est conservé).
-- Retour arrière : 20261121_fiches_a_revoir.down.sql

BEGIN;

ALTER TABLE foires.evenements
  ADD COLUMN doublon_possible_de_id integer NULL,
  ADD COLUMN doublon_score double precision NULL;

ALTER TABLE foires.evenements
  ADD CONSTRAINT evenements_doublon_possible_de_id_fkey
  FOREIGN KEY (doublon_possible_de_id) REFERENCES foires.evenements (id)
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX evenements_doublon_score_idx ON foires.evenements (doublon_score);

-- Reprise des notes « À revoir » écrites par la collecte d'avant migration
-- (format : scraper/src/worker.py, _review_note).
WITH signal AS (
  SELECT id,
         regexp_match(
           notes,
           '^À revoir : doublon possible de « .* » \(.*\)(, fiche n° ([0-9]+))?, ressemblance ([0-9]+) %\. Signalé à la collecte du [0-9]{2}/[0-9]{2}/[0-9]{4}\.'
         ) AS m
    FROM foires.evenements
   WHERE notes LIKE 'À revoir : doublon possible de %'
)
UPDATE foires.evenements e
   SET doublon_score = (s.m[3])::double precision / 100,
       -- lien vide si la fiche ressemblante n'existe plus (le score garde le signal)
       doublon_possible_de_id = (SELECT c.id FROM foires.evenements c WHERE c.id = (s.m[2])::integer),
       notes = NULLIF(btrim(regexp_replace(
         e.notes,
         '^À revoir : doublon possible de « .* » \(.*\)(, fiche n° [0-9]+)?, ressemblance [0-9]+ %\. Signalé à la collecte du [0-9]{2}/[0-9]{2}/[0-9]{4}\.',
         ''
       ), E' 
	'), '')
  FROM signal s
 WHERE s.id = e.id AND s.m IS NOT NULL;

-- Post-conditions bloquantes : colonnes présentes et aucune note « À revoir » non reprise,
-- sinon tout est annulé.
DO $$
BEGIN
  IF (SELECT count(*) FROM information_schema.columns
      WHERE table_schema = 'foires' AND table_name = 'evenements'
        AND column_name IN ('doublon_possible_de_id', 'doublon_score')) <> 2 THEN
    RAISE EXCEPTION 'Post-condition : colonnes du signal « à revoir » absentes';
  END IF;
  IF EXISTS (SELECT 1 FROM foires.evenements
              WHERE notes LIKE 'À revoir : doublon possible de %' AND doublon_score IS NULL) THEN
    RAISE EXCEPTION 'Post-condition : une note « À revoir » n''a pas été reprise';
  END IF;
END $$;

COMMIT;
