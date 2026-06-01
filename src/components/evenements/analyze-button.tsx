"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Brain, Loader2 } from "lucide-react";
import { getUnanalyzedEventIds, triggerPipeline } from "@/lib/actions/agents";

const COOLDOWN_MS = 60_000;
const LS_KEY = "analyze_last_run";

export function AnalyzeButton() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<{ count: number; cost: string } | null>(null);
  const [cooldownLeft, setCooldownLeft] = useState<number>(() => {
    if (typeof window === "undefined") return 0;
    const last = parseInt(localStorage.getItem(LS_KEY) ?? "0");
    const remaining = Math.max(0, COOLDOWN_MS - (Date.now() - last));
    return Math.ceil(remaining / 1000);
  });
  const router = useRouter();

  // Lance le cooldown et le décompte
  function startCooldown() {
    localStorage.setItem(LS_KEY, Date.now().toString());
    let secs = COOLDOWN_MS / 1000;
    setCooldownLeft(secs);
    const interval = setInterval(() => {
      secs -= 1;
      if (secs <= 0) {
        setCooldownLeft(0);
        clearInterval(interval);
      } else {
        setCooldownLeft(secs);
      }
    }, 1000);
  }

  async function handleClick() {
    if (cooldownLeft > 0) return;

    setLoading(true);
    setMessage(null);
    setConfirming(null);

    try {
      const ids = await getUnanalyzedEventIds();
      if (ids.length === 0) {
        setMessage("Aucun événement à analyser");
        return;
      }

      const batch = ids.slice(0, 100);
      // Estimation : ~0,0005€ par événement (Haiku, ~300 tokens)
      const costEst = (batch.length * 0.0005).toFixed(2);
      setConfirming({ count: batch.length, cost: costEst });
    } catch (error) {
      console.error("[analyze] Erreur :", error);
      setMessage("Erreur lors de la préparation");
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirm() {
    if (!confirming) return;
    setLoading(true);
    setConfirming(null);
    setMessage(null);

    try {
      const ids = await getUnanalyzedEventIds();
      const batch = ids.slice(0, 100);
      await triggerPipeline(batch);
      setMessage(`${batch.length} événement(s) analysé(s)`);
      startCooldown();
      router.refresh();
    } catch (error) {
      console.error("[analyze] Erreur :", error);
      setMessage("Erreur lors de l'analyse");
    } finally {
      setLoading(false);
    }
  }

  function handleCancel() {
    setConfirming(null);
  }

  const isDisabled = loading || cooldownLeft > 0;

  if (confirming) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-amber-700 bg-amber-950 px-3 py-2 text-xs">
        <span className="text-amber-300">
          Analyser {confirming.count} événements ? (coût estimé : ~{confirming.cost}€)
        </span>
        <button
          onClick={handleConfirm}
          className="rounded bg-amber-600 px-2 py-0.5 text-white hover:bg-amber-500"
        >
          Confirmer
        </button>
        <button
          onClick={handleCancel}
          className="rounded border border-zinc-600 px-2 py-0.5 text-zinc-400 hover:text-zinc-200"
        >
          Annuler
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={handleClick}
        disabled={isDisabled}
        title={cooldownLeft > 0 ? `Disponible dans ${cooldownLeft}s` : undefined}
      >
        {loading ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Brain className="mr-2 h-4 w-4" />
        )}
        {loading
          ? "Chargement..."
          : cooldownLeft > 0
            ? `Analyse (${cooldownLeft}s)`
            : "Lancer l'analyse IA"}
      </Button>
      {message && (
        <span className="text-xs text-zinc-400">{message}</span>
      )}
    </div>
  );
}
