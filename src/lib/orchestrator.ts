/**
 * Orchestrateur — Exécution synchrone des agents (sans BullMQ).
 *
 * Remplace le dispatch BullMQ par des appels directs aux fonctions .core.ts.
 * Traçabilité conservée via la table AgentJob en DB.
 * Pipeline : ANALYSIS → GEOCODING (par batch de 5) → COSTS
 */

import { prisma } from "./prisma";
import { runAnalysis } from "./agents/analysis.core";
import { runGeocoding } from "./agents/geocoding.core";
import { runCosts } from "./agents/costs.core";
import { runEmail } from "./agents/email.core";
import type { JobTrigger } from "@/generated/prisma/client";

// ─── Types ────────────────────────────────────────────

interface DispatchOptions {
  triggeredBy?: JobTrigger;
  parentJobId?: number;
}

export interface AnalysisInput {
  eventIds: number[];
}

export interface GeocodingInput {
  eventIds: number[];
}

export interface CostsInput {
  eventIds: number[];
}

export interface EmailInput {
  prospectionId: number;
}

type AgentInput =
  | { agent: "ANALYSIS"; data: AnalysisInput }
  | { agent: "GEOCODING"; data: GeocodingInput }
  | { agent: "COSTS"; data: CostsInput }
  | { agent: "EMAIL"; data: EmailInput };

// ─── Constantes ──────────────────────────────────────

const GEOCODING_BATCH_SIZE = 5; // Max events par appel geocoding (timeout Vercel)

// ─── Exécution d'un agent ────────────────────────────

export async function executeAgent(
  input: AgentInput,
  options: DispatchOptions = {}
) {
  const { triggeredBy = "USER", parentJobId } = options;

  // 1. Créer le job en DB pour traçabilité
  const job = await prisma.agentJob.create({
    data: {
      agentName: input.agent,
      statut: "PENDING",
      inputData: input.data as object,
      triggeredBy,
      parentJobId,
    },
  });

  // 2. Marquer comme en cours
  await updateJobStatus(job.id, "RUNNING");

  try {
    // 3. Exécuter la logique métier
    let outputData: object;

    switch (input.agent) {
      case "ANALYSIS":
        outputData = await runAnalysis(input.data.eventIds);
        break;
      case "GEOCODING":
        outputData = await runGeocoding(input.data.eventIds);
        break;
      case "COSTS":
        outputData = await runCosts(input.data.eventIds);
        break;
      case "EMAIL":
        outputData = await runEmail(input.data.prospectionId);
        break;
    }

    // 4. Marquer comme terminé
    await updateJobStatus(job.id, "COMPLETED", { outputData });

    return { job, outputData };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await updateJobStatus(job.id, "FAILED", { errorMessage: message });
    throw error;
  }
}

// ─── Pipeline complet : ANALYSIS → GEOCODING → COSTS ─

export async function runPipeline(
  eventIds: number[],
  triggeredBy: JobTrigger = "USER"
) {
  // 1. Analyse IA
  const analysisResult = await executeAgent(
    { agent: "ANALYSIS", data: { eventIds } },
    { triggeredBy }
  );

  // 2. Géocodage par batch de 5 (contrainte timeout Vercel)
  let lastGeoJob = analysisResult.job;
  for (let i = 0; i < eventIds.length; i += GEOCODING_BATCH_SIZE) {
    const batch = eventIds.slice(i, i + GEOCODING_BATCH_SIZE);
    const geocodingResult = await executeAgent(
      { agent: "GEOCODING", data: { eventIds: batch } },
      { triggeredBy: "ORCHESTRATOR", parentJobId: lastGeoJob.id }
    );
    lastGeoJob = geocodingResult.job;
  }

  // 3. Calcul des coûts
  const costsResult = await executeAgent(
    { agent: "COSTS", data: { eventIds } },
    { triggeredBy: "ORCHESTRATOR", parentJobId: lastGeoJob.id }
  );

  return { analysisResult, costsResult };
}

// ─── Mise à jour du statut d'un job ───────────────────

export async function updateJobStatus(
  jobId: number,
  statut: "RUNNING" | "COMPLETED" | "FAILED",
  data?: { outputData?: object; errorMessage?: string }
) {
  return prisma.agentJob.update({
    where: { id: jobId },
    data: {
      statut,
      ...(statut === "RUNNING" && { startedAt: new Date() }),
      ...(statut === "COMPLETED" && { completedAt: new Date() }),
      ...(statut === "FAILED" && { completedAt: new Date() }),
      ...(data?.outputData && { outputData: data.outputData }),
      ...(data?.errorMessage && { errorMessage: data.errorMessage }),
    },
  });
}
