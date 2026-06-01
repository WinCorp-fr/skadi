/**
 * Analyse Agent — Logique métier pure (sans BullMQ).
 *
 * Catégorisation IA par Claude Haiku (batch de 15).
 * Pour chaque batch d'événements sans scoring, envoie à Claude Haiku
 * pour obtenir : type, score_pertinence (1-10), tags, résumé.
 *
 * Coût estimé : ~0.005€ par batch de 15 événements.
 */

import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";
import { instrumenterAppelSkadi } from "@/lib/llm-usage-sink";

// ─── Types ────────────────────────────────────────────

interface EventForAnalysis {
  id: number;
  nom: string;
  description: string | null;
  ville: string;
  departement: string;
  region: string | null;
  siteWeb: string | null;
}

interface AnalysisResult {
  id: number;
  type: string;
  score_pertinence: number;
  tags: string[];
  resume: string;
}

// ─── Constantes ──────────────────────────────────────

const BATCH_SIZE = 15;

// Prompt système pour Claude Haiku
const SYSTEM_PROMPT = `Tu es un assistant qui évalue la pertinence d'événements (foires, marchés, salons) pour un vendeur de fromage de brebis artisanal basé dans le Loiret (45).

Pour chaque événement, donne :
- type : un parmi FOIRE_MEDIEVALE, MARCHE, FOIRE_ARTISANALE, SALON, BROCANTE, AUTRE
- score_pertinence : de 1 à 10 (10 = parfait pour un fromager artisanal)
  - 8-10 : marchés alimentaires, foires artisanales, événements terroir/gastronomie
  - 5-7 : foires médiévales avec artisans, marchés de Noël, salons agriculture
  - 3-4 : brocantes, vide-greniers (peu de débouchés alimentaires)
  - 1-2 : événements sans rapport (tech, mode, immobilier)
- tags : liste de tags pertinents (max 5), exemples : "fromage accepté", "produits régionaux", "gastronomie", "artisanat", "terroir", "médiéval", "marché de Noël"
- resume : 1 phrase résumant l'intérêt pour un fromager

Réponds UNIQUEMENT en JSON strict, un tableau d'objets. Exemple :
[{"id": 1, "type": "MARCHE", "score_pertinence": 8, "tags": ["fromage accepté", "terroir"], "resume": "Marché hebdomadaire alimentaire idéal pour vente directe."}]`;

// ─── Appel Claude Haiku ──────────────────────────────

async function analyzeBatch(
  anthropic: Anthropic,
  events: EventForAnalysis[]
): Promise<AnalysisResult[]> {
  // Formater les événements pour le prompt
  const eventsText = events
    .map(
      (e) =>
        `ID: ${e.id} | Nom: ${e.nom} | Ville: ${e.ville} (${e.departement}) | Région: ${e.region || "?"} | Description: ${e.description || "Pas de description"} | Site: ${e.siteWeb || "?"}`
    )
    .join("\n");

  const tStart = Date.now();
  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 2000,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Analyse ces ${events.length} événements :\n\n${eventsText}`,
      },
    ],
  });

  // Phase 0.2.5 — sink llm_usage best-effort non-bloquant
  await instrumenterAppelSkadi({
    callSite: "analysis-core/analyzeBatch",
    model: "claude-haiku-4-5-20251001",
    usage: response.usage,
    latencyMs: Date.now() - tStart,
    metadata: { batch_size: events.length },
  });

  // Extraire le JSON de la réponse
  const text =
    response.content[0].type === "text" ? response.content[0].text : "";

  // Chercher le JSON dans la réponse (peut être entouré de markdown)
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    throw new Error(
      `[analysis] Pas de JSON trouvé dans la réponse Claude : ${text.substring(0, 200)}`
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch (error) {
    throw new Error(
      `[analysis] JSON invalide dans la réponse Claude : ${(error as Error).message}. Texte : ${text.substring(0, 200)}`
    );
  }

  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error(
      `[analysis] Réponse Claude vide ou pas un tableau (${typeof parsed})`
    );
  }

  const results = parsed as AnalysisResult[];

  // Valider et nettoyer les résultats
  return results
    .filter((r) => events.some((e) => e.id === r.id))
    .map((r) => ({
      id: r.id,
      type: validateType(r.type),
      score_pertinence: Math.max(1, Math.min(10, Math.round(r.score_pertinence))),
      tags: Array.isArray(r.tags) ? r.tags.slice(0, 5) : [],
      resume: typeof r.resume === "string" ? r.resume.slice(0, 300) : "",
    }));
}

const VALID_TYPES = new Set([
  "FOIRE_MEDIEVALE",
  "MARCHE",
  "FOIRE_ARTISANALE",
  "SALON",
  "BROCANTE",
  "AUTRE",
]);

function validateType(type: string): string {
  return VALID_TYPES.has(type) ? type : "AUTRE";
}

// ─── Fonction principale ──────────────────────────────

export async function runAnalysis(eventIds: number[]) {
  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });

  // Récupérer les événements à analyser (seulement ceux pas encore analysés)
  const events = await prisma.evenement.findMany({
    where: {
      id: { in: eventIds },
      scorePertinence: null,
    },
    select: {
      id: true,
      nom: true,
      description: true,
      ville: true,
      departement: true,
      region: true,
      siteWeb: true,
    },
  });

  if (events.length === 0) {
    return { analyzed: 0, avgScore: 0, message: "Aucun événement à analyser" };
  }

  // Traiter par batch de 15
  let totalAnalyzed = 0;
  let totalScore = 0;

  for (let i = 0; i < events.length; i += BATCH_SIZE) {
    const batch = events.slice(i, i + BATCH_SIZE);
    const results = await analyzeBatch(anthropic, batch);

    // Mettre à jour chaque événement en DB
    for (const result of results) {
      await prisma.evenement.update({
        where: { id: result.id },
        data: {
          type: result.type as never,
          scorePertinence: result.score_pertinence,
          tagsIa: result.tags,
          resumeIa: result.resume,
        },
      });
      totalAnalyzed++;
      totalScore += result.score_pertinence;
    }
  }

  const avgScore = totalAnalyzed > 0 ? Math.round((totalScore / totalAnalyzed) * 10) / 10 : 0;

  return { analyzed: totalAnalyzed, avgScore };
}
