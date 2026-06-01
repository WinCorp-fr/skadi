"use client";

import { useState, useTransition } from "react";
import {
  createProspection,
  renderTemplate,
} from "@/lib/actions/prospection";

// ─── Types ────────────────────────────────────────────

interface Template {
  id: number;
  nom: string;
}

interface Evenement {
  id: number;
  nom: string;
  ville: string;
  emailContact: string | null;
}

interface EmailComposerProps {
  evenements: Evenement[];
  templates: Template[];
  onCreated?: () => void;
}

// ─── Composant ───────────────────────────────────────

export default function EmailComposer({
  evenements,
  templates,
  onCreated,
}: EmailComposerProps) {
  const [isPending, startTransition] = useTransition();
  const [evenementId, setEvenementId] = useState<number | "">("");
  const [templateId, setTemplateId] = useState<number | "">("");
  const [destinataire, setDestinataire] = useState("");
  const [sujet, setSujet] = useState("");
  const [corps, setCorps] = useState("");
  const [showPreview, setShowPreview] = useState(false);

  // Pré-remplir le destinataire quand on sélectionne un événement
  function handleEventChange(id: number) {
    setEvenementId(id);
    const event = evenements.find((e) => e.id === id);
    if (event?.emailContact) {
      setDestinataire(event.emailContact);
    }
  }

  // Appliquer un template
  function handleTemplateChange(id: number) {
    setTemplateId(id);
    if (!id || !evenementId) return;

    startTransition(async () => {
      try {
        const rendered = await renderTemplate(id, Number(evenementId));
        setSujet(rendered.sujet);
        setCorps(rendered.corps);
      } catch (e) {
        console.error("Erreur rendu template :", e);
      }
    });
  }

  // Créer le brouillon
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!evenementId || !destinataire || !sujet || !corps) return;

    startTransition(async () => {
      await createProspection({
        evenementId: Number(evenementId),
        templateId: templateId ? Number(templateId) : undefined,
        destinataire,
        sujet,
        corps,
      });
      // Reset
      setEvenementId("");
      setTemplateId("");
      setDestinataire("");
      setSujet("");
      setCorps("");
      setShowPreview(false);
      onCreated?.();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Événement cible */}
      <div>
        <label className="block text-sm font-medium text-zinc-300 mb-1">
          Événement
        </label>
        <select
          value={evenementId}
          onChange={(e) => handleEventChange(Number(e.target.value))}
          className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
          required
        >
          <option value="">Sélectionner un événement...</option>
          {evenements.map((ev) => (
            <option key={ev.id} value={ev.id}>
              {ev.nom} — {ev.ville}
            </option>
          ))}
        </select>
      </div>

      {/* Template */}
      <div>
        <label className="block text-sm font-medium text-zinc-300 mb-1">
          Template (optionnel)
        </label>
        <select
          value={templateId}
          onChange={(e) => handleTemplateChange(Number(e.target.value))}
          className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
        >
          <option value="">Email libre (pas de template)</option>
          {templates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.nom}
            </option>
          ))}
        </select>
      </div>

      {/* Destinataire */}
      <div>
        <label className="block text-sm font-medium text-zinc-300 mb-1">
          Destinataire
        </label>
        <input
          type="email"
          value={destinataire}
          onChange={(e) => setDestinataire(e.target.value)}
          placeholder="organisateur@exemple.fr"
          className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
          required
        />
      </div>

      {/* Sujet */}
      <div>
        <label className="block text-sm font-medium text-zinc-300 mb-1">
          Sujet
        </label>
        <input
          type="text"
          value={sujet}
          onChange={(e) => setSujet(e.target.value)}
          placeholder="Demande d'emplacement — Fromage de brebis artisanal"
          className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
          required
        />
      </div>

      {/* Corps */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-sm font-medium text-zinc-300">
            Corps de l&apos;email
          </label>
          <button
            type="button"
            onClick={() => setShowPreview(!showPreview)}
            className="text-xs text-zinc-400 hover:text-zinc-200"
          >
            {showPreview ? "Éditer" : "Prévisualiser"}
          </button>
        </div>
        {showPreview ? (
          <div className="rounded-md border border-zinc-700 bg-zinc-950 p-4 text-sm text-zinc-200 whitespace-pre-wrap min-h-[200px]">
            {corps || "Aucun contenu"}
          </div>
        ) : (
          <textarea
            value={corps}
            onChange={(e) => setCorps(e.target.value)}
            rows={10}
            placeholder="Bonjour,&#10;&#10;Je me permets de vous contacter..."
            className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 resize-y"
            required
          />
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button
          type="submit"
          disabled={isPending || !evenementId || !destinataire || !sujet || !corps}
          className="rounded-md bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-900
                     hover:bg-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isPending ? "Création..." : "Créer le brouillon"}
        </button>
      </div>
    </form>
  );
}
