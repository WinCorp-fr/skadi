"use client";

import { useState } from "react";
import { updateCoutDivers } from "@/lib/actions/evenements";

interface CoutDiversInputProps {
  evenementId: number;
  initialValue: number;
}

export function CoutDiversInput({ evenementId, initialValue }: CoutDiversInputProps) {
  const [value, setValue] = useState(initialValue.toString());
  const [saving, setSaving] = useState(false);

  async function handleBlur() {
    const montant = parseFloat(value) || 0;
    if (montant === initialValue) return;

    setSaving(true);
    await updateCoutDivers(evenementId, montant);
    setSaving(false);
  }

  return (
    <>
      <span>Divers :</span>
      <span className="font-mono">
        <input
          type="number"
          step="0.01"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
          className="w-16 bg-transparent border-b border-zinc-600 text-right focus:border-amber-400 focus:outline-none"
          disabled={saving}
        />
        €
      </span>
    </>
  );
}
