import { Card } from "@/components/ui/card";
import {
  CalendarDays,
  Columns3,
  Mail,
  Bot,
  Search,
  ArrowRight,
  Star,
  MapPin,
  Clock,
} from "lucide-react";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getStats } from "@/lib/actions/evenements";
import { getRecentJobs } from "@/lib/actions/agents";
import { getParametres } from "@/lib/actions/parametres";
import { QuickParamsCard } from "@/components/dashboard/quick-params-widget";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { startOfToday } from "date-fns";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  let stats = { total: 0, pipeline: 0, prospections: 0, confirmes: 0 };
  let recentJobs: Awaited<ReturnType<typeof getRecentJobs>> = [];
  let topEvents: { id: number; nom: string; ville: string; scorePertinence: number | null; cout: { distanceKm: number | null } | null }[] = [];
  let nextEvents: { id: number; nom: string; ville: string; dateDebut: Date; type: string }[] = [];
  let params: { prixCarburantLitre: unknown; consommationL100km: unknown; margeCiblePct: unknown } | null = null;

  try {
    [stats, recentJobs, topEvents, nextEvents, params] = await Promise.all([
      getStats(),
      getRecentJobs(5),
      prisma.evenement.findMany({
        where: { statutPipeline: { not: "ARCHIVE" }, scorePertinence: { gte: 8 } },
        select: { id: true, nom: true, ville: true, scorePertinence: true, cout: { select: { distanceKm: true } } },
        orderBy: [{ scorePertinence: "desc" }, { dateDebut: "asc" }],
        take: 5,
      }),
      prisma.evenement.findMany({
        where: { statutPipeline: { in: ["INTERESSE", "PROSPECTION", "RESERVE", "CONFIRME"] }, dateFin: { gte: startOfToday() } },
        select: { id: true, nom: true, ville: true, dateDebut: true, type: true },
        orderBy: { dateDebut: "asc" },
        take: 5,
      }),
      getParametres(),
    ]);
  } catch (error) {
    console.error("[home] Erreur chargement stats :", error);
  }

  const cards = [
    {
      label: "Événements découverts",
      value: stats.total,
      icon: Search,
      color: "text-blue-400",
      href: "/evenements",
    },
    {
      label: "En pipeline",
      value: stats.pipeline,
      icon: Columns3,
      color: "text-amber-400",
      href: "/pipeline",
    },
    {
      label: "Prospections envoyées",
      value: stats.prospections,
      icon: Mail,
      color: "text-emerald-400",
      href: "/prospection",
    },
    {
      label: "Événements confirmés",
      value: stats.confirmes,
      icon: CalendarDays,
      color: "text-violet-400",
      href: "/calendrier",
    },
  ];

  const statutColors: Record<string, string> = {
    PENDING: "text-zinc-400",
    RUNNING: "text-blue-400",
    COMPLETED: "text-emerald-400",
    FAILED: "text-red-400",
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Tableau de bord
        </h1>
        <p className="text-sm text-zinc-400">
          Vue d&apos;ensemble de l&apos;activité foires et marchés
        </p>
      </div>

      {/* Stats — cliquables */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((stat) => (
          <Link key={stat.label} href={stat.href}>
            <Card className="border-zinc-800 bg-zinc-900 p-4 transition-colors hover:border-zinc-700 hover:bg-zinc-800/50">
              <div className="flex items-center gap-3">
                <stat.icon className={`h-5 w-5 ${stat.color}`} />
                <div>
                  <p className="text-2xl font-semibold font-mono">{stat.value}</p>
                  <p className="text-xs text-zinc-400">{stat.label}</p>
                </div>
              </div>
            </Card>
          </Link>
        ))}
      </div>

      {/* Sections résumé — 2 ou 4 colonnes */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Top événements (meilleurs scores) */}
        <Card className="border-zinc-800 bg-zinc-900 p-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Star className="h-4 w-4 text-amber-400" />
              <h2 className="text-sm font-medium">Top événements</h2>
            </div>
            <Link
              href="/evenements?score=8"
              className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300"
            >
              Voir tout <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          {topEvents.length === 0 ? (
            <p className="text-xs text-zinc-500">
              Lancez l&apos;analyse IA pour voir les meilleurs événements.
            </p>
          ) : (
            <div className="space-y-2">
              {topEvents.map((evt) => (
                <Link
                  key={evt.id}
                  href={`/evenements/${evt.id}`}
                  className="flex items-center justify-between rounded px-1 py-1 text-xs hover:bg-zinc-800"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-zinc-200">{evt.nom}</p>
                    <p className="flex items-center gap-1 text-zinc-500">
                      <MapPin className="h-2.5 w-2.5" />
                      {evt.ville}
                      {evt.cout?.distanceKm && (
                        <span className="ml-1 text-zinc-600">
                          {Math.round(evt.cout.distanceKm)} km
                        </span>
                      )}
                    </p>
                  </div>
                  <span className="ml-2 shrink-0 font-mono text-emerald-400">
                    {evt.scorePertinence}/10
                  </span>
                </Link>
              ))}
            </div>
          )}
        </Card>

        {/* Prochains événements en pipeline */}
        <Card className="border-zinc-800 bg-zinc-900 p-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-blue-400" />
              <h2 className="text-sm font-medium">À venir</h2>
            </div>
            <Link
              href="/pipeline"
              className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300"
            >
              Pipeline <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          {nextEvents.length === 0 ? (
            <p className="text-xs text-zinc-500">
              Aucun événement en pipeline. Glissez des événements dans le pipeline pour commencer.
            </p>
          ) : (
            <div className="space-y-2">
              {nextEvents.map((evt) => (
                <Link
                  key={evt.id}
                  href={`/evenements/${evt.id}`}
                  className="flex items-center justify-between rounded px-1 py-1 text-xs hover:bg-zinc-800"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-zinc-200">{evt.nom}</p>
                    <p className="text-zinc-500">{evt.ville}</p>
                  </div>
                  <span className="ml-2 shrink-0 text-zinc-400">
                    {format(new Date(evt.dateDebut), "dd MMM", { locale: fr })}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </Card>

        {/* Paramètres rapides */}
        {params && (
          <QuickParamsCard initial={{
            prixCarburantLitre: Number(params.prixCarburantLitre),
            consommationL100km: Number(params.consommationL100km),
            margeCiblePct: Number(params.margeCiblePct),
          }} />
        )}

        {/* Agents — derniers jobs */}
        <Card className="border-zinc-800 bg-zinc-900 p-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bot className="h-4 w-4 text-zinc-400" />
              <h2 className="text-sm font-medium">Agents</h2>
            </div>
            <Link
              href="/agents"
              className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300"
            >
              Voir tout <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          {recentJobs.length === 0 ? (
            <p className="text-xs text-zinc-500">
              Aucune exécution. Lancez une analyse pour commencer.
            </p>
          ) : (
            <div className="space-y-1.5">
              {recentJobs.map((job) => (
                <div
                  key={job.id}
                  className="flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-2">
                    <span className={statutColors[job.statut] ?? "text-zinc-400"}>
                      {job.statut === "COMPLETED" ? "✓" : job.statut === "FAILED" ? "✗" : "●"}
                    </span>
                    <span className="text-zinc-300">{job.agentName}</span>
                  </div>
                  <span className="text-zinc-600">
                    {format(new Date(job.createdAt), "dd/MM HH:mm", { locale: fr })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
