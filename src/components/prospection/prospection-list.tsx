"use client";

import { useTransition } from "react";
import { useState } from "react";
import { markProspectionReady, deleteProspection, sendProspection, updateStatutProspection } from "@/lib/actions/prospection";
import { Mail, Check, Clock, Send, Trash2, AlertCircle, MessageSquare, X } from "lucide-react";

// ─── Types ────────────────────────────────────────────

interface Prospection {
  id: number;
  destinataire: string;
  sujet: string;
  corps: string;
  statut: string;
  dateEnvoi: Date | null;
  genereParIa: boolean;
  evenement: {
    id: number;
    nom: string;
    ville: string;
  };
  template: { id: number; nom: string } | null;
}

interface ProspectionListProps {
  prospections: Prospection[];
}

const statutConfig: Record<string, { label: string; color: string; icon: typeof Mail }> = {
  BROUILLON: { label: "Brouillon", color: "text-zinc-400", icon: Mail },
  PRET: { label: "Prêt à envoyer", color: "text-amber-400", icon: Clock },
  ENVOYE: { label: "Envoyé", color: "text-blue-400", icon: Send },
  REPONDU: { label: "Répondu", color: "text-emerald-400", icon: Check },
  SANS_REPONSE: { label: "Sans réponse", color: "text-red-400", icon: AlertCircle },
};

// ─── Composant ───────────────────────────────────────

export default function ProspectionList({ prospections }: ProspectionListProps) {
  const [isPending, startTransition] = useTransition();
  const [sendingId, setSendingId] = useState<number | null>(null);
  const [sendResult, setSendResult] = useState<{ id: number; success: boolean; message: string } | null>(null);

  if (prospections.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center rounded-lg border border-dashed border-zinc-800">
        <div className="text-center">
          <Mail className="mx-auto h-8 w-8 text-zinc-600" />
          <p className="mt-2 text-sm text-zinc-500">Aucune prospection</p>
          <p className="text-xs text-zinc-600">
            Créez un email depuis le formulaire ci-dessus
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {prospections.map((p) => {
        const config = statutConfig[p.statut] || statutConfig.BROUILLON;
        const Icon = config.icon;

        return (
          <div
            key={p.id}
            className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <Icon className={`h-4 w-4 ${config.color}`} />
                  <span className={`text-xs font-medium ${config.color}`}>
                    {config.label}
                  </span>
                  {p.genereParIa && (
                    <span className="rounded bg-violet-900/50 px-1.5 py-0.5 text-[10px] text-violet-300">
                      IA
                    </span>
                  )}
                </div>
                <h3 className="mt-1 text-sm font-medium text-zinc-100">
                  {p.sujet}
                </h3>
                <p className="mt-0.5 text-xs text-zinc-400">
                  → {p.destinataire} • {p.evenement.nom} ({p.evenement.ville})
                </p>
                {p.dateEnvoi && (
                  <p className="mt-0.5 text-xs text-zinc-500">
                    Envoyé le {new Date(p.dateEnvoi).toLocaleDateString("fr-FR")}
                  </p>
                )}
              </div>

              <div className="flex gap-1.5">
                {p.statut === "BROUILLON" && (
                  <button
                    onClick={() =>
                      startTransition(async () => {
                        await markProspectionReady(p.id);
                      })
                    }
                    disabled={isPending}
                    className="rounded px-2 py-1 text-xs text-amber-400 hover:bg-zinc-800"
                    title="Marquer comme prêt"
                  >
                    <Check className="h-3.5 w-3.5" />
                  </button>
                )}
                {p.statut === "PRET" && (
                  <button
                    onClick={async () => {
                      if (!confirm(`Envoyer l'email "${p.sujet}" à ${p.destinataire} ?`)) return;
                      setSendingId(p.id);
                      setSendResult(null);
                      const result = await sendProspection(p.id);
                      setSendResult({ id: p.id, ...result });
                      setSendingId(null);
                    }}
                    disabled={sendingId === p.id}
                    className="rounded bg-blue-900/50 px-2.5 py-1 text-xs font-medium text-blue-300 hover:bg-blue-800/50 disabled:opacity-50"
                    title="Envoyer l'email"
                  >
                    {sendingId === p.id ? (
                      <span className="flex items-center gap-1">
                        <span className="h-3 w-3 animate-spin rounded-full border border-blue-400 border-t-transparent" />
                        Envoi...
                      </span>
                    ) : (
                      <span className="flex items-center gap-1">
                        <Send className="h-3.5 w-3.5" />
                        Envoyer
                      </span>
                    )}
                  </button>
                )}
                {p.statut === "ENVOYE" && (
                  <>
                    <button
                      onClick={() =>
                        startTransition(async () => {
                          await updateStatutProspection(p.id, "REPONDU");
                        })
                      }
                      disabled={isPending}
                      className="rounded px-2 py-1 text-xs text-emerald-400 hover:bg-zinc-800 flex items-center gap-1"
                      title="Marquer comme répondu"
                    >
                      <MessageSquare className="h-3.5 w-3.5" />
                      Répondu
                    </button>
                    <button
                      onClick={() =>
                        startTransition(async () => {
                          await updateStatutProspection(p.id, "SANS_REPONSE");
                        })
                      }
                      disabled={isPending}
                      className="rounded px-2 py-1 text-xs text-red-400 hover:bg-zinc-800 flex items-center gap-1"
                      title="Marquer sans réponse"
                    >
                      <X className="h-3.5 w-3.5" />
                      Sans réponse
                    </button>
                  </>
                )}
                {(p.statut === "BROUILLON" || p.statut === "PRET") && (
                  <button
                    onClick={() => {
                      if (!confirm(`Supprimer l'email "${p.sujet}" ? Cette action est irréversible.`)) return;
                      startTransition(async () => {
                        await deleteProspection(p.id);
                      });
                    }}
                    disabled={isPending}
                    className="rounded px-2 py-1 text-xs text-red-400 hover:bg-zinc-800"
                    title="Supprimer"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Aperçu du corps */}
            <p className="mt-2 text-xs text-zinc-500 line-clamp-2">
              {p.corps}
            </p>
            {sendResult && sendResult.id === p.id && (
              <p className={`mt-1 text-xs ${sendResult.success ? "text-emerald-400" : "text-red-400"}`}>
                {sendResult.message}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
