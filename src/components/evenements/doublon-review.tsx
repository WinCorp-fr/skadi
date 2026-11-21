"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { confirmerDoublon, ecarterSignalDoublon } from "@/lib/actions/evenements";

interface DoublonReviewProps {
  evenementId: number;
  score: number;
  archivee: boolean;
  /** Fiche ressemblante, null si elle a été supprimée depuis la collecte. */
  ressemblante: { id: number; nom: string; ville: string; dateDebut: string } | null;
}

/**
 * Encadré « à revoir » d'une fiche : la collecte l'a trouvée proche d'une fiche existante.
 * Deux gestes : « Ce n'est pas un doublon » (efface le signal) et « C'est un doublon »
 * (archive la fiche, qui ne reviendra pas à la collecte suivante).
 */
export function DoublonReview({ evenementId, score, archivee, ressemblante }: DoublonReviewProps) {
  const [isPending, startTransition] = useTransition();
  const [erreur, setErreur] = useState<string | null>(null);
  const pct = Math.round(score * 100);

  function lancer(action: () => Promise<void>) {
    setErreur(null);
    startTransition(async () => {
      try {
        await action();
      } catch {
        setErreur("L'enregistrement a échoué. Réessayez dans un instant.");
      }
    });
  }

  const cible = ressemblante ? (
    <>
      <Link href={`/evenements/${ressemblante.id}`} className="font-medium text-amber-100 underline">
        {ressemblante.nom}
      </Link>{" "}
      ({ressemblante.ville}, {new Date(ressemblante.dateDebut).toLocaleDateString("fr-FR")}, fiche n°{" "}
      {ressemblante.id})
    </>
  ) : (
    <>une fiche supprimée depuis</>
  );

  // Archivée : par « C'est un doublon » ou par un archivage ordinaire. On ne sait pas
  // lequel, donc formulation neutre et possibilité d'effacer le signal.
  if (archivee) {
    return (
      <div className="space-y-2 rounded-lg border border-zinc-700 bg-zinc-900 p-4 text-sm text-zinc-400">
        <p>
          Archivée, signalée comme doublon possible de {cible}, ressemblance {pct} %. Gardée en
          archive, elle ne reviendra pas à la prochaine collecte.
        </p>
        <button
          onClick={() => lancer(() => ecarterSignalDoublon(evenementId))}
          disabled={isPending}
          className="rounded-md border border-zinc-600 bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-200 hover:bg-zinc-700 disabled:opacity-50"
        >
          Ce n&apos;est pas un doublon
        </button>
        {erreur && <p className="text-xs text-red-400">{erreur}</p>}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-amber-700/60 bg-amber-950/30 p-4">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
        <div className="space-y-3">
          <div>
            <h2 className="text-sm font-medium text-amber-200">À revoir : doublon possible</h2>
            <p className="mt-1 text-sm text-amber-100/80">
              La collecte a trouvé cette fiche très proche de {cible}, ressemblance {pct} %.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => lancer(() => ecarterSignalDoublon(evenementId))}
              disabled={isPending}
              className="rounded-md border border-zinc-600 bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-200 hover:bg-zinc-700 disabled:opacity-50"
            >
              Ce n&apos;est pas un doublon
            </button>
            <button
              onClick={() => lancer(() => confirmerDoublon(evenementId))}
              disabled={isPending}
              className="rounded-md bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-500 disabled:opacity-50"
            >
              C&apos;est un doublon (archiver)
            </button>
          </div>
          <p className="text-xs text-zinc-500">
            Archiver plutôt que supprimer : une fiche supprimée reviendrait à la prochaine collecte.
          </p>
          {erreur && <p className="text-xs text-red-400">{erreur}</p>}
        </div>
      </div>
    </div>
  );
}
