"use client";

import { useState } from "react";
import Link from "next/link";
import { Settings, ArrowRight } from "lucide-react";
import { updateParametres } from "@/lib/actions/parametres";

interface QuickParam {
  key: "prixCarburantLitre" | "consommationL100km" | "margeCiblePct";
  label: string;
  unit: string;
  step: string;
  min: string;
}

const PARAMS: QuickParam[] = [
  { key: "prixCarburantLitre", label: "Prix carburant", unit: "€/L", step: "0.01", min: "0" },
  { key: "consommationL100km", label: "Consommation", unit: "L/100", step: "0.1", min: "0" },
  { key: "margeCiblePct", label: "Marge cible", unit: "%", step: "1", min: "0" },
];

interface QuickParamsWidgetProps {
  initial: {
    prixCarburantLitre: number;
    consommationL100km: number;
    margeCiblePct: number;
  };
}

export function QuickParamsWidget({ initial }: QuickParamsWidgetProps) {
  const [values, setValues] = useState<Record<string, string>>({
    prixCarburantLitre: initial.prixCarburantLitre.toString(),
    consommationL100km: initial.consommationL100km.toString(),
    margeCiblePct: initial.margeCiblePct.toString(),
  });
  const [saving, setSaving] = useState<string | null>(null);

  async function handleBlur(key: QuickParam["key"], original: number) {
    const val = parseFloat(values[key]);
    if (isNaN(val) || val === original) return;

    setSaving(key);
    await updateParametres({ [key]: val });
    setSaving(null);
  }

  return (
    <div className="space-y-2">
      {PARAMS.map((p) => (
        <div key={p.key} className="flex items-center justify-between text-xs">
          <span className="text-zinc-400">{p.label}</span>
          <div className="flex items-center gap-1">
            <input
              type="number"
              step={p.step}
              min={p.min}
              value={values[p.key]}
              onChange={(e) => setValues((v) => ({ ...v, [p.key]: e.target.value }))}
              onBlur={() => handleBlur(p.key, initial[p.key])}
              onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
              disabled={saving === p.key}
              className="w-16 bg-transparent border-b border-zinc-700 text-right font-mono focus:border-amber-400 focus:outline-none text-zinc-200"
            />
            <span className="text-zinc-500 w-10">{p.unit}</span>
            {saving === p.key && <span className="text-zinc-600">…</span>}
          </div>
        </div>
      ))}
    </div>
  );
}

export function QuickParamsCard({ initial }: QuickParamsWidgetProps) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Settings className="h-4 w-4 text-zinc-500" />
          <h2 className="text-sm font-medium">Paramètres rapides</h2>
        </div>
        <Link
          href="/parametres"
          className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300"
        >
          Tous <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
      <QuickParamsWidget initial={initial} />
    </div>
  );
}
