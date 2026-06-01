"use client";

import { useState } from "react";
import { updateEvenement } from "@/lib/actions/evenements";

interface PrixEmplacementInputProps {
  evenementId: number;
  initialValue: number | null;
}

export function PrixEmplacementInput({ evenementId, initialValue }: PrixEmplacementInputProps) {
  const [value, setValue] = useState(initialValue != null ? initialValue.toString() : "");
  const [saving, setSaving] = useState(false);

  async function handleBlur() {
    const trimmed = value.trim();
    const montant = trimmed === "" ? null : parseFloat(trimmed);
    if (montant === initialValue) return;
    if (montant !== null && isNaN(montant)) return;

    setSaving(true);
    await updateEvenement(evenementId, { prixEmplacement: montant });
    setSaving(false);
  }

  return (
    <div className="flex items-center gap-1 text-zinc-400">
      <input
        type="number"
        step="0.01"
        min="0"
        placeholder="—"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
        className="w-20 bg-transparent border-b border-zinc-600 text-right focus:border-amber-400 focus:outline-none font-mono text-sm"
        disabled={saving}
      />
      <span className="text-sm">€</span>
      {saving && <span className="text-xs text-zinc-500">…</span>}
    </div>
  );
}
