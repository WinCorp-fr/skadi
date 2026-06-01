"use client";

import { useState } from "react";
import { updateEvenement } from "@/lib/actions/evenements";
import { Globe, Check, Pencil, Loader2 } from "lucide-react";

interface SiteOfficielEditorProps {
  evenementId: number;
  siteOfficiel: string | null;
  siteWeb: string | null; // Source scraper (pour affichage)
}

export function SiteOfficielEditor({
  evenementId,
  siteOfficiel,
  siteWeb,
}: SiteOfficielEditorProps) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(siteOfficiel ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    setSaving(true);
    await updateEvenement(evenementId, {
      siteOfficiel: value || null,
    } as Parameters<typeof updateEvenement>[1]);
    setSaving(false);
    setSaved(true);
    setEditing(false);
    setTimeout(() => setSaved(false), 3000);
  }

  return (
    <div className="space-y-2">
      {/* Site officiel (éditable) */}
      <div className="flex items-center gap-2 text-zinc-400">
        <Globe className="h-4 w-4 text-zinc-500" />
        {editing ? (
          <div className="flex flex-1 items-center gap-2">
            <input
              type="url"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="https://site-officiel-de-la-foire.fr"
              className="flex-1 rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-sm text-zinc-200"
              autoFocus
            />
            <button
              onClick={handleSave}
              disabled={saving}
              className="rounded bg-emerald-700 px-2 py-1 text-xs text-white hover:bg-emerald-600"
            >
              {saving ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Check className="h-3 w-3" />
              )}
            </button>
            <button
              onClick={() => {
                setEditing(false);
                setValue(siteOfficiel ?? "");
              }}
              className="text-xs text-zinc-500 hover:text-zinc-300"
            >
              Annuler
            </button>
          </div>
        ) : (
          <div className="flex flex-1 items-center gap-2">
            {siteOfficiel ? (
              <a
                href={siteOfficiel}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm hover:text-zinc-200 hover:underline"
              >
                {siteOfficiel}
              </a>
            ) : (
              <span className="text-xs text-zinc-600 italic">
                Pas de site officiel connu
              </span>
            )}
            <button
              onClick={() => setEditing(true)}
              className="rounded p-1 text-zinc-600 hover:bg-zinc-800 hover:text-zinc-300"
              title="Modifier le site officiel"
            >
              <Pencil className="h-3 w-3" />
            </button>
            {saved && (
              <span className="text-xs text-emerald-400">Enregistré</span>
            )}
          </div>
        )}
      </div>

      {/* Source scraper (lecture seule, petit texte) */}
      {siteWeb && (
        <div className="ml-6 text-[10px] text-zinc-600">
          Source :{" "}
          <a
            href={siteWeb}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-zinc-400"
          >
            {siteWeb.length > 60 ? siteWeb.slice(0, 60) + "..." : siteWeb}
          </a>
        </div>
      )}
    </div>
  );
}
