/**
 * POST /api/agents/trigger — Déclencher un agent depuis le dashboard.
 *
 * Body JSON :
 *   { agent: "ANALYSIS" | "GEOCODING" | "COSTS", input: {...} }
 *
 * Exécution synchrone — retourne le résultat complet.
 * SCRAPING exclu (reste en CLI Python local).
 * EMAIL exclu (déclenché via /prospection uniquement).
 */

import { NextResponse } from "next/server";
import { executeAgent } from "@/lib/orchestrator";
import type { AgentName } from "@/generated/prisma/client";

// ─── Agents autorisés via cette route ────────────────

const ALLOWED_AGENTS = new Set<AgentName>([
  "ANALYSIS",
  "GEOCODING",
  "COSTS",
]);

// ─── Handler POST ────────────────────────────────────

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Validation de base
    if (!body.agent || typeof body.agent !== "string") {
      return NextResponse.json(
        { error: "Champ 'agent' requis (ANALYSIS, GEOCODING, COSTS)" },
        { status: 400 }
      );
    }

    const agentName = body.agent.toUpperCase() as AgentName;

    if (!ALLOWED_AGENTS.has(agentName)) {
      return NextResponse.json(
        { error: `Agent '${body.agent}' non autorisé. Agents : ANALYSIS, GEOCODING, COSTS` },
        { status: 400 }
      );
    }

    const input = body.input || {};

    // Validation : eventIds requis
    if (!input.eventIds || !Array.isArray(input.eventIds) || input.eventIds.length === 0) {
      return NextResponse.json(
        { error: `${agentName} requiert input.eventIds (array non vide d'IDs)` },
        { status: 400 }
      );
    }

    if (input.eventIds.length > 100) {
      return NextResponse.json(
        { error: `Maximum 100 eventIds par requête (reçu : ${input.eventIds.length})` },
        { status: 400 }
      );
    }

    // Exécution synchrone
    const result = await executeAgent(
      { agent: agentName, data: input } as Parameters<typeof executeAgent>[0],
      { triggeredBy: "USER" }
    );

    return NextResponse.json({
      jobId: result.job.id,
      agent: agentName,
      status: "completed",
      output: result.outputData,
    });
  } catch (error) {
    console.error("[trigger] Erreur :", error);
    const message = error instanceof Error ? error.message : "Erreur interne";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
