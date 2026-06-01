/**
 * POST /api/prospection/send — Envoyer un email de prospection validé.
 *
 * Body JSON : { prospectionId: number }
 *
 * Exécution synchrone — retourne le résultat de l'envoi.
 * RÈGLE MÉTIER : Emails JAMAIS envoyés sans validation manuelle (statut PRET).
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { executeAgent } from "@/lib/orchestrator";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (!body.prospectionId || typeof body.prospectionId !== "number") {
      return NextResponse.json(
        { error: "Champ 'prospectionId' requis (number)" },
        { status: 400 }
      );
    }

    // Vérifier que la prospection existe et est prête
    const prospection = await prisma.prospection.findUnique({
      where: { id: body.prospectionId },
    });

    if (!prospection) {
      return NextResponse.json(
        { error: `Prospection #${body.prospectionId} introuvable` },
        { status: 404 }
      );
    }

    if (prospection.statut !== "PRET") {
      return NextResponse.json(
        {
          error: `La prospection doit être au statut PRET pour être envoyée (statut actuel: ${prospection.statut})`,
        },
        { status: 400 }
      );
    }

    // Exécution synchrone
    const result = await executeAgent(
      { agent: "EMAIL", data: { prospectionId: body.prospectionId } },
      { triggeredBy: "USER" }
    );

    return NextResponse.json({
      jobId: result.job.id,
      agent: "EMAIL",
      status: "completed",
      output: result.outputData,
    });
  } catch (error) {
    console.error("[send] Erreur :", error);
    const message = error instanceof Error ? error.message : "Erreur interne";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
