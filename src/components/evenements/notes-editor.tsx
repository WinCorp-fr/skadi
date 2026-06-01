"use client";

import { useState } from "react";
import { updateEvenement } from "@/lib/actions/evenements";

interface NotesEditorProps {
  evenementId: number;
  initialValue: string | null;
}

export function NotesEditor({ evenementId, initialValue }: NotesEditorProps) {
  const [value, setValue] = useState(initialValue ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleBlur() {
    const trimmed = value.trim();
    const current = (initialValue ?? "").trim();
    if (trimmed === current) return;

    setSaving(true);
    await updateEvenement(evenementId, { notes: trimmed || null });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="space-y-1">
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={handleBlur}
        rows={4}
        placeholder="Notes libres sur ce marché, contact, historique..."
        className="w-full rounded border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-400 placeholder:text-zinc-600 focus:border-amber-400 focus:outline-none resize-none"
        disabled={saving}
      />
      {saving && <p className="text-xs text-zinc-500">Sauvegarde...</p>}
      {saved && <p className="text-xs text-emerald-500">✓ Sauvegardé</p>}
    </div>
  );
}
