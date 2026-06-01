"use client";

import { useState, useTransition } from "react";
import { createOrUpdateResultat } from "@/lib/actions/rapports";

interface ResultatFormProps {
  evenementId: number;
  evenementNom: string;
  existing?: {
    chiffreAffaires: number;
    nombreClients: number | null;
    meteo: string | null;
    noteSatisfaction: number | null;
    commentaire: string | null;
    recommande: boolean;
  };
}

export default function ResultatForm({
  evenementId,
  evenementNom,
  existing,
}: ResultatFormProps) {
  const [isPending, startTransition] = useTransition();
  const [success, setSuccess] = useState(false);

  const [ca, setCa] = useState(existing ? Number(existing.chiffreAffaires) : 0);
  const [clients, setClients] = useState(existing?.nombreClients ?? 0);
  const [meteo, setMeteo] = useState(existing?.meteo ?? "");
  const [satisfaction, setSatisfaction] = useState(existing?.noteSatisfaction ?? 3);
  const [commentaire, setCommentaire] = useState(existing?.commentaire ?? "");
  const [recommande, setRecommande] = useState(existing?.recommande ?? false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSuccess(false);

    startTransition(async () => {
      await createOrUpdateResultat({
        evenementId,
        chiffreAffaires: ca,
        nombreClients: clients || undefined,
        meteo: meteo || undefined,
        noteSatisfaction: satisfaction,
        commentaire: commentaire || undefined,
        recommande,
      });
      setSuccess(true);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h3 className="text-sm font-medium text-zinc-300">
        Résultat — {evenementNom}
      </h3>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs text-zinc-400 mb-1">
            Chiffre d&apos;affaires (€)
          </label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={ca}
            onChange={(e) => setCa(Number(e.target.value))}
            className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
            required
          />
        </div>
        <div>
          <label className="block text-xs text-zinc-400 mb-1">
            Nombre de clients
          </label>
          <input
            type="number"
            min="0"
            value={clients}
            onChange={(e) => setClients(Number(e.target.value))}
            className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs text-zinc-400 mb-1">Météo</label>
          <select
            value={meteo}
            onChange={(e) => setMeteo(e.target.value)}
            className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
          >
            <option value="">—</option>
            <option value="Soleil">Soleil</option>
            <option value="Nuageux">Nuageux</option>
            <option value="Pluie">Pluie</option>
            <option value="Froid">Froid</option>
            <option value="Vent">Vent</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-zinc-400 mb-1">
            Satisfaction (1-5)
          </label>
          <div className="flex gap-1 pt-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setSatisfaction(n)}
                className={`h-8 w-8 rounded text-sm font-medium transition ${
                  satisfaction >= n
                    ? "bg-amber-600 text-white"
                    : "bg-zinc-800 text-zinc-500 hover:bg-zinc-700"
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div>
        <label className="block text-xs text-zinc-400 mb-1">Commentaire</label>
        <textarea
          value={commentaire}
          onChange={(e) => setCommentaire(e.target.value)}
          rows={3}
          className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 resize-y"
          placeholder="Notes sur l'événement, clientèle, ambiance..."
        />
      </div>

      <label className="flex items-center gap-2 text-sm text-zinc-300 cursor-pointer">
        <input
          type="checkbox"
          checked={recommande}
          onChange={(e) => setRecommande(e.target.checked)}
          className="rounded border-zinc-600"
        />
        Recommandé (y retourner l&apos;année prochaine)
      </label>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-900
                     hover:bg-zinc-200 disabled:opacity-50"
        >
          {isPending ? "Enregistrement..." : existing ? "Mettre à jour" : "Enregistrer"}
        </button>
        {success && (
          <span className="text-xs text-emerald-400">Résultat enregistré</span>
        )}
      </div>
    </form>
  );
}
