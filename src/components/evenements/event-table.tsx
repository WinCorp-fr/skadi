"use client";

import Link from "next/link";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  typeEvenementOptions,
  statutPipelineOptions,
} from "@/lib/validations/evenement";
import type { Evenement, CoutEvenement } from "@/generated/prisma/client";
import { MapPin, ExternalLink, ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import { EventRowMenu } from "@/components/evenements/event-row-menu";
import { nextOccurrence } from "@/lib/recurrence";

interface EventTableProps {
  evenements: (Evenement & { cout: CoutEvenement | null })[];
  sort?: string;
  order?: "asc" | "desc";
  searchParams?: Record<string, string | undefined>;
}

function SortableHeader({
  label,
  field,
  currentSort,
  currentOrder,
  searchParams,
}: {
  label: string;
  field: string;
  currentSort?: string;
  currentOrder?: "asc" | "desc";
  searchParams?: Record<string, string | undefined>;
}) {
  const isActive = currentSort === field;
  const nextOrder = isActive && currentOrder === "desc" ? "asc" : "desc";
  const params = new URLSearchParams();
  if (searchParams) {
    for (const [k, v] of Object.entries(searchParams)) {
      if (v && k !== "sort" && k !== "order" && k !== "page") params.set(k, v);
    }
  }
  params.set("sort", field);
  params.set("order", nextOrder);

  return (
    <a href={`/evenements?${params.toString()}`} className="flex items-center gap-1 hover:text-zinc-200">
      {label}
      {isActive ? (
        currentOrder === "desc" ? <ArrowDown className="h-3 w-3" /> : <ArrowUp className="h-3 w-3" />
      ) : (
        <ArrowUpDown className="h-3 w-3 opacity-40" />
      )}
    </a>
  );
}

function getTypeLabel(type: string) {
  return typeEvenementOptions.find((o) => o.value === type)?.label ?? type;
}

function getStatutInfo(statut: string) {
  return (
    statutPipelineOptions.find((o) => o.value === statut) ?? {
      label: statut,
      color: "bg-zinc-700",
    }
  );
}

export function EventTable({ evenements, sort, order, searchParams }: EventTableProps) {
  if (evenements.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-zinc-800">
        <p className="text-sm text-zinc-500">Aucun événement trouvé</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-zinc-800">
      <Table>
        <TableHeader>
          <TableRow className="border-zinc-800 hover:bg-transparent">
            <TableHead className="text-zinc-400">Nom</TableHead>
            <TableHead className="text-zinc-400">Type</TableHead>
            <TableHead className="text-zinc-400">Lieu</TableHead>
            <TableHead className="text-zinc-400">
              <SortableHeader label="Dates" field="date" currentSort={sort} currentOrder={order} searchParams={searchParams} />
            </TableHead>
            <TableHead className="text-zinc-400">
              <SortableHeader label="Distance" field="distance" currentSort={sort} currentOrder={order} searchParams={searchParams} />
            </TableHead>
            <TableHead className="text-zinc-400">Trajet AR</TableHead>
            <TableHead className="text-zinc-400">
              <SortableHeader label="Score" field="score" currentSort={sort} currentOrder={order} searchParams={searchParams} />
            </TableHead>
            <TableHead className="text-zinc-400">Seuil rent.</TableHead>
            <TableHead className="text-zinc-400">Statut</TableHead>
            <TableHead className="w-8" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {evenements.map((evt) => {
            const statutInfo = getStatutInfo(evt.statutPipeline);
            return (
              <TableRow
                key={evt.id}
                className="border-zinc-800 hover:bg-zinc-900"
              >
                <TableCell>
                  <Link
                    href={`/evenements/${evt.id}`}
                    className="font-medium text-zinc-200 hover:text-white hover:underline"
                  >
                    {evt.nom}
                  </Link>
                  {evt.siteWeb && (
                    <a
                      href={evt.siteWeb}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-1 inline-block text-zinc-500 hover:text-zinc-300"
                    >
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-xs text-zinc-400">
                    {getTypeLabel(evt.type)}
                  </Badge>
                </TableCell>
                <TableCell>
                  <span className="flex items-center gap-1 text-sm text-zinc-400">
                    <MapPin className="h-3 w-3" />
                    {evt.ville} ({evt.departement})
                  </span>
                </TableCell>
                <TableCell className="text-sm text-zinc-400">
                  {(evt.recurrence === "HEBDOMADAIRE" || evt.recurrence === "MENSUEL") ? (
                    (() => {
                      const next = nextOccurrence(evt.recurrence, new Date(evt.dateDebut), new Date(evt.dateFin));
                      return next ? (
                        <span>
                          <span className="text-xs text-zinc-500 mr-1">Prochain :</span>
                          {format(next, "dd MMM yyyy", { locale: fr })}
                          <span className="ml-1 text-xs text-zinc-600">
                            ({evt.recurrence === "HEBDOMADAIRE" ? "hebdo" : "mensuel"})
                          </span>
                        </span>
                      ) : <span className="text-zinc-600">Terminé</span>;
                    })()
                  ) : (
                    <>
                      {format(new Date(evt.dateDebut), "dd MMM yyyy", { locale: fr })}
                      {evt.dateDebut.getTime() !== evt.dateFin.getTime() && (
                        <>
                          {" → "}
                          {format(new Date(evt.dateFin), "dd MMM yyyy", { locale: fr })}
                        </>
                      )}
                    </>
                  )}
                </TableCell>
                <TableCell className="font-mono text-sm text-zinc-400">
                  {evt.cout?.distanceKm
                    ? `${Math.round(evt.cout.distanceKm)} km`
                    : "—"}
                </TableCell>
                <TableCell className="font-mono text-sm text-zinc-400">
                  {evt.cout?.dureeTrajetMin
                    ? `${Math.floor(evt.cout.dureeTrajetMin * 2 / 60)}h${String(Math.round((evt.cout.dureeTrajetMin * 2) % 60)).padStart(2, "0")}`
                    : "—"}
                </TableCell>
                <TableCell>
                  {evt.scorePertinence ? (
                    <span
                      className={`font-mono text-sm ${
                        evt.scorePertinence >= 7
                          ? "text-emerald-400"
                          : evt.scorePertinence >= 4
                            ? "text-amber-400"
                            : "text-zinc-500"
                      }`}
                    >
                      {evt.scorePertinence}/10
                    </span>
                  ) : (
                    <span className="text-xs text-zinc-600">—</span>
                  )}
                </TableCell>
                <TableCell className="font-mono text-sm">
                  {evt.cout?.seuilRentabilite != null ? (
                    <span className="text-amber-400">
                      {Math.round(Number(evt.cout.seuilRentabilite))}€
                    </span>
                  ) : (
                    <span className="text-zinc-600">—</span>
                  )}
                </TableCell>
                <TableCell>
                  <Badge
                    className={`${statutInfo.color} text-xs text-zinc-200 border-0`}
                  >
                    {statutInfo.label}
                  </Badge>
                </TableCell>
                <TableCell className="text-right pr-2">
                  <EventRowMenu evenementId={evt.id} evenementNom={evt.nom} />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
