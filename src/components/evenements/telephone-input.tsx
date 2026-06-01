"use client";

import { useState } from "react";
import { updateEvenement } from "@/lib/actions/evenements";

interface TelephoneInputProps {
  evenementId: number;
  initialValue: string | null;
}

export function TelephoneInput({ evenementId, initialValue }: TelephoneInputProps) {
  const [value, setValue] = useState(initialValue ?? "");
  const [saving, setSaving] = useState(false);

  async function handleBlur() {
    const trimmed = value.trim();
    const current = initialValue ?? "";
    if (trimmed === current) return;

    setSaving(true);
    await updateEvenement(evenementId, { telephone: trimmed || null });
    setSaving(false);
  }

  return (
    <div className="flex items-center gap-1 flex-1">
      <input
        type="tel"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
        placeholder="Téléphone de l'organisateur..."
        className="flex-1 bg-transparent border-b border-zinc-700 text-sm text-zinc-400 placeholder:text-zinc-600 focus:border-amber-400 focus:outline-none"
        disabled={saving}
      />
      {saving && <span className="text-xs text-zinc-600">…</span>}
    </div>
  );
}
