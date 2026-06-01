"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { MapPin, Star, Trash2 } from "lucide-react";
import { deleteEvenements } from "@/lib/actions/evenements";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { typeEvenementOptions } from "@/lib/validations/evenement";

interface ArchiveEvent {
  id: number;
  nom: string;
  type: string;
  ville: string;
  departement: string;
  dateDebut: Date;
  scorePertinence: number | null;
  resultat: { chiffreAffaires: unknown; noteSatisfaction: number | null } | null;
}

interface ArchivesTableProps {
  evenements: ArchiveEvent[];
}

export function ArchivesTable({ evenements }: ArchivesTableProps) {
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [isPending, startTransition] = useTransition();

  function toggleAll() {
    if (selected.size === evenements.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(evenements.map((e) => e.id)));
    }
  }

  function toggleOne(id: number) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  }

  function handleDeleteSelected() {
    if (selected.size === 0) return;
    if (!confirm(`Supprimer définitivement ${selected.size} événement(s) ? Cette action est irréversible.`)) return;
    const ids = Array.from(selected);
    startTransition(async () => {
      await deleteEvenements(ids);
      setSelected(new Set());
    });
  }

  return (
    <div className="space-y-3">
      {/* Barre d'actions sélection */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 rounded-md border border-red-800/50 bg-red-950/30 px-4 py-2">
          <span className="text-sm text-red-300">{selected.size} sélectionné(s)</span>
          <button
            onClick={handleDeleteSelected}
            disabled={isPending}
            className="flex items-center gap-1.5 rounded bg-red-700 px-3 py-1 text-xs font-medium text-white hover:bg-red-600 disabled:opacity-50"
          >
            <Trash2 className="h-3.5 w-3.5" />
            {isPending ? "Suppression..." : "Supprimer la sélection"}
          </button>
          <button
            onClick={() => setSelected(new Set())}
            className="text-xs text-zinc-500 hover:text-zinc-300"
          >
            Annuler
          </button>
        </div>
      )}

      <div className="rounded-lg border border-zinc-800">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-800 text-left text-xs text-zinc-500">
              <th className="px-4 py-3 font-medium w-8">
                <input
                  type="checkbox"
                  checked={selected.size === evenements.length && evenements.length > 0}
                  onChange={toggleAll}
                  className="accent-amber-500"
                />
              </th>
              <th className="px-4 py-3 font-medium">Nom</th>
              <th className="px-4 py-3 font-medium">Type</th>
              <th className="px-4 py-3 font-medium">Lieu</th>
              <th className="px-4 py-3 font-medium">Dates</th>
              <th className="px-4 py-3 font-medium text-center">Score</th>
              <th className="px-4 py-3 font-medium text-right">CA</th>
              <th className="px-4 py-3 font-medium text-center">Satisfaction</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/50">
            {evenements.map((evt) => {
              const typeLabel = typeEvenementOptions.find((o) => o.value === evt.type)?.label ?? evt.type;
              const dateStr = format(new Date(evt.dateDebut), "MMM yyyy", { locale: fr });
              const ca = evt.resultat ? Number(evt.resultat.chiffreAffaires) : null;
              const satisfaction = evt.resultat?.noteSatisfaction;
              const isSelected = selected.has(evt.id);

              return (
                <tr
                  key={evt.id}
                  className={`transition-colors hover:bg-zinc-900/50 ${isSelected ? "bg-red-950/20" : ""}`}
                >
                  <td className="px-4 py-2.5">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleOne(evt.id)}
                      className="accent-amber-500"
                    />
                  </td>
                  <td className="px-4 py-2.5">
                    <Link
                      href={`/evenements/${evt.id}`}
                      className="text-zinc-200 hover:text-zinc-50 hover:underline"
                    >
                      {evt.nom}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5">
                    <Badge variant="outline" className="text-xs">
                      {typeLabel}
                    </Badge>
                  </td>
                  <td className="px-4 py-2.5 text-zinc-400">
                    <div className="flex items-center gap-1">
                      <MapPin className="h-3 w-3 text-zinc-600" />
                      {evt.ville} ({evt.departement})
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-zinc-400 capitalize">{dateStr}</td>
                  <td className="px-4 py-2.5 text-center">
                    {evt.scorePertinence != null ? (
                      <span
                        className={`font-mono text-xs ${
                          evt.scorePertinence >= 7
                            ? "text-emerald-400"
                            : evt.scorePertinence >= 4
                              ? "text-amber-400"
                              : "text-zinc-500"
                        }`}
                      >
                        {evt.scorePertinence}/10
                      </span>
                    ) : (
                      <span className="text-zinc-600">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {ca != null ? (
                      <span className="font-mono text-xs text-emerald-400">
                        {ca.toLocaleString("fr-FR")}€
                      </span>
                    ) : (
                      <Link
                        href={`/evenements/${evt.id}`}
                        className="text-xs text-zinc-500 hover:text-amber-400"
                      >
                        Saisir
                      </Link>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    {satisfaction != null ? (
                      <span className="flex items-center justify-center gap-1 text-xs text-amber-400">
                        <Star className="h-3 w-3" />
                        {satisfaction}/5
                      </span>
                    ) : (
                      <span className="text-zinc-600">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
