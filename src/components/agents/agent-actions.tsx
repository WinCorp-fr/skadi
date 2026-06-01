"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Play, Zap, Loader2 } from "lucide-react";
import {
  triggerPipeline,
  triggerAnalysis,
  getUnanalyzedEventIds,
} from "@/lib/actions/agents";

export function AgentActions() {
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handlePipeline() {
    setStatus(null);
    setError(null);
    startTransition(async () => {
      try {
        const eventIds = await getUnanalyzedEventIds();
        if (eventIds.length === 0) {
          setStatus("Aucun événement à analyser.");
          return;
        }
        setStatus(`Pipeline lancé sur ${eventIds.length} événements...`);
        await triggerPipeline(eventIds);
        setStatus(`Pipeline terminé (${eventIds.length} événements traités).`);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur inconnue");
      }
    });
  }

  async function handleAnalysis() {
    setStatus(null);
    setError(null);
    startTransition(async () => {
      try {
        const eventIds = await getUnanalyzedEventIds();
        if (eventIds.length === 0) {
          setStatus("Aucun événement à analyser.");
          return;
        }
        setStatus(`Analyse IA de ${eventIds.length} événements...`);
        await triggerAnalysis(eventIds);
        setStatus("Analyse terminée.");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur inconnue");
      }
    });
  }

  return (
    <Card className="border-zinc-800 bg-zinc-900 p-4">
      <h2 className="mb-3 text-sm font-medium text-zinc-300">
        Actions rapides
      </h2>

      <div className="flex flex-wrap gap-2">
        <Button
          variant="default"
          size="sm"
          onClick={handlePipeline}
          disabled={isPending}
        >
          {isPending ? (
            <Loader2 className="mr-2 h-3 w-3 animate-spin" />
          ) : (
            <Zap className="mr-2 h-3 w-3" />
          )}
          Pipeline complet (nouveaux)
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={handleAnalysis}
          disabled={isPending}
        >
          {isPending ? (
            <Loader2 className="mr-2 h-3 w-3 animate-spin" />
          ) : (
            <Play className="mr-2 h-3 w-3" />
          )}
          Analyser les nouveaux
        </Button>
      </div>

      {status && (
        <p className="mt-3 text-xs text-emerald-400">{status}</p>
      )}
      {error && (
        <p className="mt-3 text-xs text-red-400">{error}</p>
      )}
    </Card>
  );
}
