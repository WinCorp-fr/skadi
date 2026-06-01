"use server";

import { prisma } from "@/lib/prisma";
import { executeAgent, runPipeline } from "@/lib/orchestrator";
import { revalidatePath } from "next/cache";

// ─── Statut des agents (depuis la DB, pas BullMQ) ────

export async function getAgentStats() {
  const stats = await prisma.agentJob.groupBy({
    by: ["agentName", "statut"],
    _count: true,
  });

  // Transformer en format { agent: { PENDING, RUNNING, COMPLETED, FAILED } }
  const agents = ["SCRAPING", "ANALYSIS", "GEOCODING", "COSTS", "EMAIL"] as const;
  return agents.map((name) => {
    const agentStats = stats.filter((s) => s.agentName === name);
    return {
      name,
      pending: agentStats.find((s) => s.statut === "PENDING")?._count ?? 0,
      running: agentStats.find((s) => s.statut === "RUNNING")?._count ?? 0,
      completed: agentStats.find((s) => s.statut === "COMPLETED")?._count ?? 0,
      failed: agentStats.find((s) => s.statut === "FAILED")?._count ?? 0,
    };
  });
}

// ─── Historique des jobs en DB ─────────────────────────

export async function getRecentJobs(limit = 20) {
  return prisma.agentJob.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

// ─── Déclenchement des agents ─────────────────────────

export async function triggerAnalysis(eventIds: number[]) {
  const result = await executeAgent(
    { agent: "ANALYSIS", data: { eventIds } }
  );
  revalidatePath("/agents");
  revalidatePath("/evenements");
  return result;
}

export async function triggerGeocoding(eventIds: number[]) {
  const result = await executeAgent(
    { agent: "GEOCODING", data: { eventIds } }
  );
  revalidatePath("/agents");
  revalidatePath("/evenements");
  return result;
}

export async function triggerCosts(eventIds: number[]) {
  const result = await executeAgent(
    { agent: "COSTS", data: { eventIds } }
  );
  revalidatePath("/agents");
  revalidatePath("/evenements");
  return result;
}

export async function triggerPipeline(eventIds: number[]) {
  const result = await runPipeline(eventIds);
  revalidatePath("/agents");
  revalidatePath("/evenements");
  revalidatePath("/pipeline");
  return result;
}

export async function triggerEmail(prospectionId: number) {
  const result = await executeAgent(
    { agent: "EMAIL", data: { prospectionId } }
  );
  revalidatePath("/agents");
  revalidatePath("/prospection");
  return result;
}

// ─── Récupérer les événements non analysés ────────────

export async function getUnanalyzedEventIds() {
  const events = await prisma.evenement.findMany({
    where: { scorePertinence: null },
    select: { id: true },
    orderBy: { createdAt: "desc" },
  });
  return events.map((e) => e.id);
}
