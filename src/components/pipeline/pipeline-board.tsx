"use client";

import { useState, useTransition } from "react";
import { updateStatutPipeline } from "@/lib/actions/evenements";
import { statutPipelineOptions } from "@/lib/validations/evenement";
import type { StatutPipeline } from "@/generated/prisma/client";
import { MapPin, Star, Calendar, Euro } from "lucide-react";

// ─── Types ────────────────────────────────────────────

interface PipelineEvent {
  id: number;
  nom: string;
  ville: string;
  departement: string;
  type: string;
  dateDebut: Date;
  dateFin: Date;
  statutPipeline: StatutPipeline;
  scorePertinence: number | null;
  resumeIa: string | null;
  cout: {
    distanceKm: number | null;
    coutTotal: { toString(): string } | null;
    seuilRentabilite: { toString(): string } | null;
  } | null;
}

interface PipelineBoardProps {
  events: PipelineEvent[];
}

// Colonnes du pipeline (sans ARCHIVE pour le kanban)
const COLUMNS = statutPipelineOptions.filter((s) => s.value !== "ARCHIVE");

// ─── Composant carte événement ───────────────────────

function EventCard({ event }: { event: PipelineEvent }) {
  const score = event.scorePertinence;
  const distance = event.cout?.distanceKm;
  const coutTotal = event.cout?.coutTotal;

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", String(event.id));
        e.dataTransfer.effectAllowed = "move";
      }}
      className="cursor-grab rounded-md border border-zinc-800 bg-zinc-900/80 p-3 text-sm
                 transition-all hover:border-zinc-600 active:cursor-grabbing active:opacity-70"
    >
      <div className="font-medium text-zinc-100 leading-tight">{event.nom}</div>

      <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-zinc-400">
        <span className="flex items-center gap-1">
          <MapPin className="h-3 w-3" />
          {event.ville} ({event.departement})
        </span>
        <span className="flex items-center gap-1">
          <Calendar className="h-3 w-3" />
          {new Date(event.dateDebut).toLocaleDateString("fr-FR", {
            day: "numeric",
            month: "short",
          })}
        </span>
      </div>

      <div className="mt-2 flex items-center gap-2">
        {score !== null && (
          <span
            className={`flex items-center gap-0.5 rounded px-1.5 py-0.5 text-xs font-medium ${
              score >= 7
                ? "bg-emerald-900/60 text-emerald-300"
                : score >= 4
                  ? "bg-amber-900/60 text-amber-300"
                  : "bg-zinc-800 text-zinc-400"
            }`}
          >
            <Star className="h-3 w-3" />
            {score}/10
          </span>
        )}
        {distance !== null && distance !== undefined && (
          <span className="text-xs text-zinc-500">{Math.round(distance)} km</span>
        )}
        {coutTotal !== null && coutTotal !== undefined && Number(coutTotal) > 0 && (
          <span className="flex items-center gap-0.5 text-xs text-zinc-500">
            <Euro className="h-3 w-3" />
            {Number(coutTotal).toFixed(0)}€
          </span>
        )}
      </div>

      {event.resumeIa && (
        <p className="mt-1.5 text-xs text-zinc-500 line-clamp-2">{event.resumeIa}</p>
      )}
    </div>
  );
}

// ─── Composant colonne ───────────────────────────────

function PipelineColumn({
  statut,
  label,
  color,
  events,
  onDrop,
}: {
  statut: StatutPipeline;
  label: string;
  color: string;
  events: PipelineEvent[];
  onDrop: (eventId: number, newStatut: StatutPipeline) => void;
}) {
  const [isDragOver, setIsDragOver] = useState(false);

  return (
    <div
      className={`flex min-w-[220px] flex-1 flex-col rounded-lg border transition-colors ${
        isDragOver
          ? "border-zinc-500 bg-zinc-800/30"
          : "border-zinc-800 bg-zinc-900/50"
      }`}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        setIsDragOver(true);
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragOver(false);
        const eventId = parseInt(e.dataTransfer.getData("text/plain"), 10);
        if (!isNaN(eventId)) {
          onDrop(eventId, statut);
        }
      }}
    >
      {/* En-tête colonne */}
      <div className={`rounded-t-lg px-3 py-2 text-xs font-medium ${color}`}>
        {label}
        <span className="ml-2 rounded-full bg-black/20 px-1.5 py-0.5 text-[10px]">
          {events.length}
        </span>
      </div>

      {/* Cartes */}
      <div className="flex flex-col gap-2 p-2 min-h-[100px]">
        {events.map((event) => (
          <EventCard key={event.id} event={event} />
        ))}
        {events.length === 0 && (
          <div className="flex flex-1 items-center justify-center py-8 text-xs text-zinc-600">
            Glisser ici
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Board principal ─────────────────────────────────

export default function PipelineBoard({ events }: PipelineBoardProps) {
  const [isPending, startTransition] = useTransition();

  function handleDrop(eventId: number, newStatut: StatutPipeline) {
    // Vérifier que l'événement change bien de colonne
    const event = events.find((e) => e.id === eventId);
    if (!event || event.statutPipeline === newStatut) return;

    startTransition(async () => {
      await updateStatutPipeline(eventId, newStatut);
    });
  }

  return (
    <div className="relative">
      {isPending && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/20 rounded-lg">
          <span className="text-sm text-zinc-300 animate-pulse">Mise à jour...</span>
        </div>
      )}

      <div className="flex gap-3 overflow-x-auto pb-4">
        {COLUMNS.map((col) => (
          <PipelineColumn
            key={col.value}
            statut={col.value as StatutPipeline}
            label={col.label}
            color={col.color}
            events={events.filter((e) => e.statutPipeline === col.value)}
            onDrop={handleDrop}
          />
        ))}
      </div>
    </div>
  );
}
