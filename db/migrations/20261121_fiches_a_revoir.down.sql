-- Retour arrière de 20261121_fiches_a_revoir.up.sql.
--
-- Effet : chaque signal « à revoir » est réécrit en tête de la note, au format de l'ancienne
-- collecte (scraper/src/worker.py, _review_note), puis les colonnes sont supprimées. Rien ne se
-- perd : un nouvel up relit ces notes. La date « Signalé à la collecte du » devient celle du
-- retour arrière (la date d'origine n'est pas stockée en colonne).
-- Ordre : redéployer d'abord l'application d'avant la migration (sinon Prisma lit des colonnes
-- absentes), puis jouer ce script. La collecte retombe d'elle-même sur la note texte.

BEGIN;

UPDATE foires.evenements e
   SET notes = concat_ws(
         E'\n',
         'À revoir : doublon possible de « ' || coalesce(c.nom, 'fiche supprimée') || ' » ('
           || coalesce(c.ville || ', ' || to_char(c.date_debut, 'DD/MM/YYYY'), 'lieu inconnu') || ')'
           || coalesce(', fiche n° ' || c.id, '')
           || ', ressemblance ' || round(e.doublon_score * 100)::integer || ' %. '
           || 'Signalé à la collecte du ' || to_char(now(), 'DD/MM/YYYY') || '.',
         e.notes
       )
  FROM foires.evenements e2
  LEFT JOIN foires.evenements c ON c.id = e2.doublon_possible_de_id
 WHERE e2.id = e.id AND e.doublon_score IS NOT NULL;

DROP INDEX IF EXISTS foires.evenements_doublon_score_idx;

ALTER TABLE foires.evenements
  DROP CONSTRAINT IF EXISTS evenements_doublon_possible_de_id_fkey;

ALTER TABLE foires.evenements
  DROP COLUMN IF EXISTS doublon_possible_de_id,
  DROP COLUMN IF EXISTS doublon_score;

COMMIT;
