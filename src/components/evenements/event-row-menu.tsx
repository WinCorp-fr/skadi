"use client";

import { useState, useTransition } from "react";
import { MoreHorizontal, Archive, Trash2 } from "lucide-react";
import { archiveEvenement, deleteEvenement } from "@/lib/actions/evenements";

interface EventRowMenuProps {
  evenementId: number;
  evenementNom: string;
}

export function EventRowMenu({ evenementId, evenementNom }: EventRowMenuProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleArchive() {
    setOpen(false);
    startTransition(async () => {
      await archiveEvenement(evenementId);
    });
  }

  function handleDelete() {
    setOpen(false);
    if (!confirm(`Supprimer définitivement "${evenementNom}" ? Cette action est irréversible.`)) return;
    startTransition(async () => {
      await deleteEvenement(evenementId);
    });
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        disabled={isPending}
        className="rounded p-1 text-zinc-600 hover:bg-zinc-800 hover:text-zinc-300 disabled:opacity-40"
        title="Actions"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>

      {open && (
        <>
          {/* Overlay pour fermer */}
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-20 mt-1 w-44 rounded-md border border-zinc-700 bg-zinc-900 shadow-lg">
            <button
              onClick={handleArchive}
              className="flex w-full items-center gap-2 px-3 py-2 text-xs text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
            >
              <Archive className="h-3.5 w-3.5" />
              Archiver
            </button>
            <button
              onClick={handleDelete}
              className="flex w-full items-center gap-2 px-3 py-2 text-xs text-red-400 hover:bg-zinc-800 hover:text-red-300"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Supprimer définitivement
            </button>
          </div>
        </>
      )}
    </div>
  );
}
