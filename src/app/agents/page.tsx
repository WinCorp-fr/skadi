import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Bot,
  Search,
  Brain,
  MapPin,
  Calculator,
  Mail,
} from "lucide-react";
import { getAgentStats, getRecentJobs } from "@/lib/actions/agents";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { AgentActions } from "@/components/agents/agent-actions";

export const dynamic = "force-dynamic";

const agentMeta = [
  {
    name: "SCRAPING" as const,
    label: "Scraping Agent",
    description: "Scrape les sites de foires et marchés",
    icon: Search,
    runtime: "Python (CLI local)",
  },
  {
    name: "ANALYSIS" as const,
    label: "Analyse Agent",
    description: "Catégorise et score la pertinence (IA)",
    icon: Brain,
    runtime: "TS + Claude Haiku",
  },
  {
    name: "GEOCODING" as const,
    label: "Géocodage Agent",
    description: "Résout adresses et calcule distances",
    icon: MapPin,
    runtime: "TypeScript",
  },
  {
    name: "COSTS" as const,
    label: "Coûts Agent",
    description: "Calcule coûts et seuil de rentabilité",
    icon: Calculator,
    runtime: "TypeScript",
  },
  {
    name: "EMAIL" as const,
    label: "Email Agent",
    description: "Envoie les emails de prospection",
    icon: Mail,
    runtime: "TypeScript",
  },
];

const statutColors: Record<string, string> = {
  PENDING: "bg-zinc-700 text-zinc-300",
  RUNNING: "bg-blue-900 text-blue-300",
  COMPLETED: "bg-emerald-900 text-emerald-300",
  FAILED: "bg-red-900 text-red-300",
};

export default async function AgentsPage() {
  let agentStats: Awaited<ReturnType<typeof getAgentStats>> = [];
  let recentJobs: Awaited<ReturnType<typeof getRecentJobs>> = [];
  try {
    [agentStats, recentJobs] = await Promise.all([
      getAgentStats(),
      getRecentJobs(),
    ]);
  } catch (error) {
    console.error("[agents] Erreur chargement données :", error);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Agents</h1>
        <p className="text-sm text-zinc-400">
          Statut des agents et historique des exécutions
        </p>
      </div>

      {/* Actions rapides */}
      <AgentActions />

      {/* Agents grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {agentMeta.map((agent) => {
          const stats = agentStats.find((s) => s.name === agent.name);

          return (
            <Card key={agent.name} className="border-zinc-800 bg-zinc-900 p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="rounded-md bg-zinc-800 p-2">
                    <agent.icon className="h-4 w-4 text-zinc-300" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{agent.label}</p>
                    <p className="text-xs text-zinc-500">{agent.description}</p>
                  </div>
                </div>
              </div>

              <div className="mt-3 flex items-center gap-2 text-xs text-zinc-600">
                <Bot className="h-3 w-3" />
                <span>{agent.runtime}</span>
              </div>

              {stats && (
                <div className="mt-3 grid grid-cols-4 gap-1 text-center">
                  <div>
                    <p className="text-xs font-mono text-zinc-300">
                      {stats.pending}
                    </p>
                    <p className="text-[10px] text-zinc-500">attente</p>
                  </div>
                  <div>
                    <p
                      className={`text-xs font-mono ${stats.running > 0 ? "text-blue-400" : "text-zinc-300"}`}
                    >
                      {stats.running}
                    </p>
                    <p className="text-[10px] text-zinc-500">actif</p>
                  </div>
                  <div>
                    <p className="text-xs font-mono text-emerald-400">
                      {stats.completed}
                    </p>
                    <p className="text-[10px] text-zinc-500">ok</p>
                  </div>
                  <div>
                    <p
                      className={`text-xs font-mono ${stats.failed > 0 ? "text-red-400" : "text-zinc-300"}`}
                    >
                      {stats.failed}
                    </p>
                    <p className="text-[10px] text-zinc-500">erreur</p>
                  </div>
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {/* Historique des jobs */}
      <div>
        <h2 className="mb-3 text-sm font-medium text-zinc-300">
          Historique des exécutions
        </h2>
        {recentJobs.length === 0 ? (
          <div className="flex h-32 items-center justify-center rounded-lg border border-dashed border-zinc-800">
            <p className="text-xs text-zinc-500">
              Aucune exécution enregistrée
            </p>
          </div>
        ) : (
          <div className="rounded-lg border border-zinc-800">
            <div className="divide-y divide-zinc-800">
              {recentJobs.map((job) => (
                <div
                  key={job.id}
                  className="flex items-center justify-between px-4 py-2"
                >
                  <div className="flex items-center gap-3">
                    <Badge
                      className={`text-[10px] border-0 ${statutColors[job.statut] ?? "bg-zinc-700"}`}
                    >
                      {job.statut}
                    </Badge>
                    <span className="text-sm text-zinc-300">
                      {job.agentName}
                    </span>
                    <span className="text-xs text-zinc-500">
                      {job.triggeredBy === "ORCHESTRATOR"
                        ? "auto"
                        : job.triggeredBy === "CRON"
                          ? "cron"
                          : "manuel"}
                    </span>
                  </div>
                  <span className="text-xs text-zinc-500">
                    {format(new Date(job.createdAt), "dd/MM HH:mm", {
                      locale: fr,
                    })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
