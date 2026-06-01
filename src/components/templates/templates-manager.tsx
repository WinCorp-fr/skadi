"use client";

import { useState, useTransition } from "react";
import { createTemplate, updateTemplate, deleteTemplate } from "@/lib/actions/prospection";
import { Plus, Edit2, Trash2, ChevronDown, ChevronUp } from "lucide-react";

interface Template {
  id: number;
  nom: string;
  sujetTemplate: string;
  corpsTemplate: string;
  variables: unknown;
  _count: { prospections: number };
}

interface TemplatesManagerProps {
  templates: Template[];
}

const VARIABLES_DISPONIBLES = [
  { variable: "{{nom_evenement}}", description: "Nom de l'événement" },
  { variable: "{{ville}}", description: "Ville" },
  { variable: "{{departement}}", description: "Département" },
  { variable: "{{date_debut}}", description: "Date de début" },
  { variable: "{{date_fin}}", description: "Date de fin" },
  { variable: "{{type}}", description: "Type d'événement" },
  { variable: "{{email_contact}}", description: "Email de l'organisateur" },
  { variable: "{{site_web}}", description: "Site web" },
  { variable: "{{score}}", description: "Score de pertinence" },
  { variable: "{{distance_km}}", description: "Distance en km" },
];

function TemplateForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: Partial<Template>;
  onSave: (data: { nom: string; sujetTemplate: string; corpsTemplate: string }) => Promise<void>;
  onCancel: () => void;
}) {
  const [nom, setNom] = useState(initial?.nom ?? "");
  const [sujet, setSujet] = useState(initial?.sujetTemplate ?? "");
  const [corps, setCorps] = useState(initial?.corpsTemplate ?? "");
  const [showVars, setShowVars] = useState(false);
  const [isPending, startTransition] = useTransition();

  function insertVariable(variable: string, field: "sujet" | "corps") {
    if (field === "sujet") setSujet((s) => s + variable);
    else setCorps((c) => c + variable);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      await onSave({ nom, sujetTemplate: sujet, corpsTemplate: corps });
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border border-amber-700/50 bg-zinc-900 p-4">
      <div>
        <label className="mb-1 block text-xs font-medium text-zinc-400">Nom du template</label>
        <input
          type="text"
          value={nom}
          onChange={(e) => setNom(e.target.value)}
          required
          placeholder="Ex: Prospection foire médiévale"
          className="w-full rounded border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-amber-500 focus:outline-none"
        />
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-zinc-400">Sujet de l&apos;email</label>
        <input
          type="text"
          value={sujet}
          onChange={(e) => setSujet(e.target.value)}
          required
          placeholder="Ex: Participation à {{nom_evenement}} — fromager artisanal"
          className="w-full rounded border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-amber-500 focus:outline-none"
        />
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-zinc-400">Corps de l&apos;email</label>
        <textarea
          value={corps}
          onChange={(e) => setCorps(e.target.value)}
          required
          rows={8}
          placeholder="Bonjour,&#10;&#10;Je suis fromager artisanal..."
          className="w-full rounded border border-zinc-700 bg-zinc-800 px-3 py-2 font-mono text-xs text-zinc-200 placeholder:text-zinc-600 focus:border-amber-500 focus:outline-none"
        />
      </div>

      {/* Variables disponibles */}
      <div className="rounded border border-zinc-800 bg-zinc-950/50">
        <button
          type="button"
          onClick={() => setShowVars((v) => !v)}
          className="flex w-full items-center justify-between px-3 py-2 text-xs text-zinc-500 hover:text-zinc-300"
        >
          Variables disponibles
          {showVars ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </button>
        {showVars && (
          <div className="border-t border-zinc-800 px-3 pb-3 pt-2">
            <div className="grid grid-cols-2 gap-2">
              {VARIABLES_DISPONIBLES.map(({ variable, description }) => (
                <div key={variable} className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[10px] text-amber-400">{variable}</span>
                  <span className="text-[10px] text-zinc-500">{description}</span>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => insertVariable(variable, "sujet")}
                      className="rounded px-1 py-0.5 text-[10px] text-zinc-600 hover:bg-zinc-800 hover:text-zinc-300"
                      title="Insérer dans le sujet"
                    >
                      S
                    </button>
                    <button
                      type="button"
                      onClick={() => insertVariable(variable, "corps")}
                      className="rounded px-1 py-0.5 text-[10px] text-zinc-600 hover:bg-zinc-800 hover:text-zinc-300"
                      title="Insérer dans le corps"
                    >
                      C
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded border border-zinc-700 px-4 py-1.5 text-xs text-zinc-400 hover:border-zinc-600 hover:text-zinc-200"
        >
          Annuler
        </button>
        <button
          type="submit"
          disabled={isPending}
          className="rounded bg-amber-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-amber-500 disabled:opacity-50"
        >
          {isPending ? "Sauvegarde..." : "Sauvegarder"}
        </button>
      </div>
    </form>
  );
}

export function TemplatesManager({ templates }: TemplatesManagerProps) {
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();

  async function handleCreate(data: { nom: string; sujetTemplate: string; corpsTemplate: string }) {
    await createTemplate({ ...data, variables: [] });
    setShowCreate(false);
  }

  async function handleUpdate(id: number, data: { nom: string; sujetTemplate: string; corpsTemplate: string }) {
    await updateTemplate(id, data);
    setEditingId(null);
  }

  function handleDelete(id: number, nom: string) {
    if (!confirm(`Supprimer le template "${nom}" ? Cette action est irréversible.`)) return;
    startTransition(async () => {
      await deleteTemplate(id);
    });
  }

  return (
    <div className="space-y-4">
      {/* Bouton créer */}
      {!showCreate && (
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 rounded-md border border-zinc-700 px-4 py-2 text-sm text-zinc-400 hover:border-zinc-600 hover:text-zinc-200"
        >
          <Plus className="h-4 w-4" />
          Nouveau template
        </button>
      )}

      {showCreate && (
        <TemplateForm
          onSave={handleCreate}
          onCancel={() => setShowCreate(false)}
        />
      )}

      {/* Liste des templates */}
      {templates.length === 0 && !showCreate ? (
        <div className="flex h-48 items-center justify-center rounded-lg border border-dashed border-zinc-800">
          <p className="text-sm text-zinc-500">Aucun template. Créez-en un pour commencer.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {templates.map((t) => (
            <div key={t.id}>
              {editingId === t.id ? (
                <TemplateForm
                  initial={t}
                  onSave={(data) => handleUpdate(t.id, data)}
                  onCancel={() => setEditingId(null)}
                />
              ) : (
                <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-zinc-200">{t.nom}</h3>
                      <p className="mt-0.5 text-xs text-zinc-500 truncate">{t.sujetTemplate}</p>
                      <p className="mt-1 text-xs text-zinc-600 line-clamp-2">{t.corpsTemplate}</p>
                      <p className="mt-1 text-xs text-zinc-600">
                        Utilisé dans {t._count.prospections} prospection(s)
                      </p>
                    </div>
                    <div className="ml-4 flex shrink-0 gap-2">
                      <button
                        onClick={() => setEditingId(t.id)}
                        className="rounded p-1.5 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"
                        title="Modifier"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(t.id, t.nom)}
                        disabled={isPending}
                        className="rounded p-1.5 text-zinc-500 hover:bg-zinc-800 hover:text-red-400"
                        title="Supprimer"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
