import { prisma } from "@/lib/prisma";
import { format, startOfToday, startOfMonth, endOfMonth, addMonths, subMonths, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { CalendarDays, MapPin, List, Grid } from "lucide-react";
import Link from "next/link";
import {
  typeEvenementOptions,
  statutPipelineOptions,
} from "@/lib/validations/evenement";
import { CalendarGrid } from "@/components/calendrier/calendar-grid";
import { occurrencesInRange } from "@/lib/recurrence";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: {
    mois?: string;   // YYYY-MM
    vue?: string;    // "grille" | "liste"
  };
}

export default async function CalendrierPage({ searchParams }: PageProps) {
  // Déterminer le mois affiché
  const today = startOfToday();
  const moisParam = searchParams.mois;
  const moisDate = moisParam
    ? parseISO(moisParam + "-01")
    : startOfMonth(today);

  const vue = searchParams.vue ?? "liste";

  // Pour la vue grille : charger le mois en cours
  // Pour la vue liste : charger tous les événements futurs
  const whereBase = {
    statutPipeline: { not: "ARCHIVE" as const },
    dateFin: { gte: today },
  };

  let evenements: {
    id: number;
    nom: string;
    type: string;
    ville: string;
    departement: string;
    dateDebut: Date;
    dateFin: Date;
    statutPipeline: string;
    scorePertinence: number | null;
    recurrence: string;
  }[] = [];

  try {
    if (vue === "grille") {
      // Pour la grille, charger le mois +/- quelques jours (pour la grille qui déborde)
      const start = startOfMonth(moisDate);
      const end = endOfMonth(moisDate);
      evenements = await prisma.evenement.findMany({
        where: {
          ...whereBase,
          OR: [
            { dateDebut: { gte: start, lte: end } },
            { dateFin: { gte: start, lte: end } },
            { dateDebut: { lte: start }, dateFin: { gte: end } },
          ],
        },
        select: {
          id: true, nom: true, type: true, ville: true, departement: true,
          dateDebut: true, dateFin: true, statutPipeline: true, scorePertinence: true, recurrence: true,
        },
        orderBy: { dateDebut: "asc" },
      });
    } else {
      evenements = await prisma.evenement.findMany({
        where: whereBase,
        select: {
          id: true, nom: true, type: true, ville: true, departement: true,
          dateDebut: true, dateFin: true, statutPipeline: true, scorePertinence: true, recurrence: true,
        },
        orderBy: { dateDebut: "asc" },
      });
    }
  } catch (error) {
    console.error("[calendrier] Erreur chargement :", error);
  }

  // Navigation mois
  const prevMois = format(subMonths(moisDate, 1), "yyyy-MM");
  const nextMois = format(addMonths(moisDate, 1), "yyyy-MM");
  const prevHref = `/calendrier?vue=grille&mois=${prevMois}`;
  const nextHref = `/calendrier?vue=grille&mois=${nextMois}`;

  // Grouper par mois pour vue liste
  const grouped = new Map<string, typeof evenements>();
  for (const evt of evenements) {
    const key = format(new Date(evt.dateDebut), "yyyy-MM");
    const existing = grouped.get(key) ?? [];
    existing.push(evt);
    grouped.set(key, existing);
  }
  const months = Array.from(grouped.entries()).sort(([a], [b]) => a.localeCompare(b));

  // Préparer les événements pour la grille (avec couleur de statut)
  // Pour les récurrents, générer une occurrence par jour pertinent du mois
  const rangeStart = startOfMonth(moisDate);
  const rangeEnd = endOfMonth(moisDate);

  const calEvents: {
    id: number; nom: string; type: string;
    dateDebut: Date; dateFin: Date; statutPipeline: string; statutColor: string;
  }[] = [];

  for (const evt of evenements) {
    const statutInfo = statutPipelineOptions.find((o) => o.value === evt.statutPipeline) ?? { color: "bg-zinc-700" };
    const base = { id: evt.id, nom: evt.nom, type: evt.type, statutPipeline: evt.statutPipeline, statutColor: statutInfo.color };

    if (evt.recurrence === "HEBDOMADAIRE" || evt.recurrence === "MENSUEL") {
      const occurrences = occurrencesInRange(evt.recurrence, evt.dateDebut, evt.dateFin, rangeStart, rangeEnd);
      for (const occ of occurrences) {
        calEvents.push({ ...base, dateDebut: occ, dateFin: occ });
      }
    } else {
      calEvents.push({ ...base, dateDebut: evt.dateDebut, dateFin: evt.dateFin });
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Calendrier</h1>
          <p className="text-sm text-zinc-400">
            Vue chronologique des événements à venir
          </p>
        </div>

        {/* Toggle vue */}
        <div className="flex gap-1 rounded-md border border-zinc-800 p-1">
          <Link
            href="/calendrier?vue=liste"
            className={`flex items-center gap-1.5 rounded px-3 py-1.5 text-xs transition-colors ${
              vue === "liste"
                ? "bg-zinc-700 text-zinc-200"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            <List className="h-3.5 w-3.5" />
            Liste
          </Link>
          <Link
            href={`/calendrier?vue=grille&mois=${format(moisDate, "yyyy-MM")}`}
            className={`flex items-center gap-1.5 rounded px-3 py-1.5 text-xs transition-colors ${
              vue === "grille"
                ? "bg-zinc-700 text-zinc-200"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            <Grid className="h-3.5 w-3.5" />
            Grille
          </Link>
        </div>
      </div>

      {evenements.length === 0 && vue !== "grille" ? (
        <div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-zinc-800">
          <div className="text-center">
            <CalendarDays className="mx-auto h-8 w-8 text-zinc-600" />
            <p className="mt-2 text-sm text-zinc-500">Aucun événement à afficher</p>
            <p className="text-xs text-zinc-600">
              Ajoutez des événements manuellement ou lancez un scraping
            </p>
          </div>
        </div>
      ) : vue === "grille" ? (
        <CalendarGrid
          mois={moisDate}
          events={calEvents}
          prevHref={prevHref}
          nextHref={nextHref}
        />
      ) : (
        <div className="space-y-8">
          {months.map(([monthKey, events]) => {
            const monthDate = new Date(monthKey + "-01");
            const monthLabel = format(monthDate, "MMMM yyyy", { locale: fr });

            return (
              <div key={monthKey}>
                <h2 className="mb-3 text-lg font-medium capitalize text-zinc-200">
                  {monthLabel}
                  <span className="ml-2 text-sm font-normal text-zinc-500">
                    ({events.length} événement{events.length > 1 ? "s" : ""})
                  </span>
                </h2>
                <div className="space-y-2">
                  {events.map((evt) => {
                    const typeLabel =
                      typeEvenementOptions.find((o) => o.value === evt.type)?.label ?? evt.type;
                    const statutInfo = statutPipelineOptions.find(
                      (o) => o.value === evt.statutPipeline
                    ) ?? { label: evt.statutPipeline, color: "bg-zinc-700" };

                    const dateStr =
                      evt.dateDebut.getTime() === evt.dateFin.getTime()
                        ? format(new Date(evt.dateDebut), "dd MMM", { locale: fr })
                        : `${format(new Date(evt.dateDebut), "dd", { locale: fr })}–${format(new Date(evt.dateFin), "dd MMM", { locale: fr })}`;

                    return (
                      <Link
                        key={evt.id}
                        href={`/evenements/${evt.id}`}
                        className="flex items-center gap-4 rounded-lg border border-zinc-800 bg-zinc-900/50 p-3 transition-colors hover:border-zinc-700 hover:bg-zinc-900"
                      >
                        <div className="w-20 shrink-0 text-center">
                          <span className="text-sm font-mono text-zinc-300">{dateStr}</span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-zinc-200">{evt.nom}</p>
                          <div className="flex items-center gap-2 text-xs text-zinc-500">
                            <MapPin className="h-3 w-3" />
                            {evt.ville} ({evt.departement})
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <Badge variant="outline" className="text-[10px]">{typeLabel}</Badge>
                          <Badge className={`${statutInfo.color} text-[10px] text-zinc-200 border-0`}>
                            {statutInfo.label}
                          </Badge>
                          {evt.scorePertinence != null && (
                            <span className={`text-xs font-mono ${
                              evt.scorePertinence >= 7 ? "text-emerald-400"
                                : evt.scorePertinence >= 4 ? "text-amber-400"
                                : "text-zinc-500"
                            }`}>
                              {evt.scorePertinence}/10
                            </span>
                          )}
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
