/**
 * Sink Supabase fine-grained pour la table `llm_usage` (Phase 0.2 cross-services).
 *
 * @spec thor/specs/cost-optimization.spec.md v1.0 (Phase 0.2.5)
 * @plan thor/specs/cost-optimization.plan.md §14 (étape 0.2.5)
 *
 * Architecture (miroir thor/heimdall/bifrost) :
 * - 1 INSERT atomique par appel Anthropic (granularité fine)
 * - Best-effort non-bloquant : toute erreur (Supabase down, schéma drift, network)
 *   est swallowed avec warn 1×/session.
 * - Skip silent si SUPABASE_URL/SERVICE_ROLE_KEY absents (dev local sans .env).
 * - Skadi = toujours channel='api_direct' (Next.js Vercel, pas de CLI Claude Code).
 *
 * Pattern client Supabase admin (service_role) pour bypass RLS authenticated.
 * Audit DGFIP : INSERT only, jamais SELECT/UPDATE/DELETE depuis ce module.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { hostname } from "node:os";

// ── Types ──────────────────────────────────────────────────────────────────

export type Channel = "api_direct" | "cli_oauth";

export interface LlmUsageRecord {
  service: "skadi";
  call_site: string;
  model: string;
  channel: Channel;
  job_id?: string | null;
  agent_run_id?: string | null;
  source_machine_id?: string;
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  cache_creation_tokens: number;
  cost_eur?: number | null;
  latency_ms?: number | null;
  metadata?: Record<string, unknown> | null;
}

// ── Pricing Anthropic (miroir heimdall/thor) ──────────────────────────────

const PRICING_USD: Record<string, { in: number; out: number }> = {
  "claude-haiku": { in: 1, out: 5 },
  "claude-sonnet": { in: 3, out: 15 },
  "claude-opus": { in: 5, out: 25 },
  "claude-haiku-4-5-20251001": { in: 1, out: 5 },
  "claude-sonnet-4-6": { in: 3, out: 15 },
  // Sonnet 5 (migration 2026-07-02) : prix affiché $3/$15 — prix de lancement $2/$10
  // jusqu'au 2026-08-31 volontairement non appliqué (surestimation ~2 mois, valeur durable).
  "claude-sonnet-5": { in: 3, out: 15 },
  "claude-opus-4-6": { in: 5, out: 25 },
  "claude-opus-4-7": { in: 5, out: 25 },
  "claude-opus-4-8": { in: 5, out: 25 },
};
const USD_TO_EUR = 0.92;

const _unknownPricingWarned = new Set<string>();

function calculerCoutAppelEur(
  model: string,
  inputTokens: number,
  outputTokens: number,
  cacheReadTokens: number,
  cacheCreationTokens: number,
  channel: Channel,
): number | null {
  if (channel === "cli_oauth") return null;
  const p = PRICING_USD[model];
  if (!p) {
    if (!_unknownPricingWarned.has(model)) {
      _unknownPricingWarned.add(model);
      console.warn(
        `[llm-usage-sink/skadi] modèle Anthropic sans pricing : '${model}' — cost_eur=NULL.`,
      );
    }
    return null;
  }
  const usd =
    (inputTokens * p.in) / 1_000_000 +
    (outputTokens * p.out) / 1_000_000 +
    (cacheCreationTokens * p.in * 1.25) / 1_000_000 +
    (cacheReadTokens * p.in * 0.1) / 1_000_000;
  return usd * USD_TO_EUR;
}

// ── Singleton client + throttle warn ───────────────────────────────────────

let _adminClient: SupabaseClient | null | undefined;
const _sinkErrorWarned = new Set<string>();

function getSupabaseAdminOrNull(): SupabaseClient | null {
  if (_adminClient !== undefined) return _adminClient;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    _adminClient = null;
    return null;
  }
  _adminClient = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _adminClient;
}

function getDefaultMachineId(): string {
  return process.env.SOURCE_MACHINE_ID || hostname() || "unknown";
}

// ── Sink principal ─────────────────────────────────────────────────────────

async function insertLlmUsage(record: LlmUsageRecord): Promise<void> {
  const client = getSupabaseAdminOrNull();
  if (!client) return;
  try {
    const { error } = await client.from("llm_usage").insert({
      service: record.service,
      call_site: record.call_site,
      model: record.model,
      channel: record.channel,
      job_id: record.job_id ?? null,
      agent_run_id: record.agent_run_id ?? null,
      source_machine_id: record.source_machine_id ?? getDefaultMachineId(),
      input_tokens: record.input_tokens | 0,
      output_tokens: record.output_tokens | 0,
      cache_read_tokens: record.cache_read_tokens | 0,
      cache_creation_tokens: record.cache_creation_tokens | 0,
      cost_eur: record.cost_eur ?? null,
      latency_ms: record.latency_ms ?? null,
      metadata: record.metadata ?? null,
    });
    if (error) throw error;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const key = `${err?.constructor?.name ?? "Error"}:${msg.slice(0, 200)}`;
    if (!_sinkErrorWarned.has(key)) {
      _sinkErrorWarned.add(key);
      console.warn(
        `[llm-usage-sink/skadi] Exception (signalée 1×): ${msg}. Best-effort — appel Anthropic protégé.`,
      );
    }
  }
}

// ── Helper haut niveau ─────────────────────────────────────────────────────

/**
 * Instrumente un appel Anthropic Skadi : push sink llm_usage non-bloquant.
 *
 * Pattern d'usage côté call site :
 *   const response = await anthropic.messages.create(...)
 *   await instrumenterAppelSkadi({
 *     callSite: "analysis-core/analyzeBatch",
 *     model: "claude-haiku-4-5-20251001",
 *     usage: response.usage,
 *   })
 */
export async function instrumenterAppelSkadi(params: {
  callSite: string;
  model: string;
  usage:
    | {
        input_tokens?: number | null;
        output_tokens?: number | null;
        cache_read_input_tokens?: number | null;
        cache_creation_input_tokens?: number | null;
      }
    | null
    | undefined;
  channel?: Channel;
  jobId?: string;
  metadata?: Record<string, unknown>;
  latencyMs?: number;
}): Promise<void> {
  const { callSite, model, usage, channel = "api_direct" } = params;
  if (!usage) return;
  const inputTokens = usage.input_tokens ?? 0;
  const outputTokens = usage.output_tokens ?? 0;
  const cacheReadTokens = usage.cache_read_input_tokens ?? 0;
  const cacheCreationTokens = usage.cache_creation_input_tokens ?? 0;
  const costEur = calculerCoutAppelEur(
    model,
    inputTokens,
    outputTokens,
    cacheReadTokens,
    cacheCreationTokens,
    channel,
  );
  await insertLlmUsage({
    service: "skadi",
    call_site: callSite,
    model,
    channel,
    job_id: params.jobId ?? null,
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    cache_read_tokens: cacheReadTokens,
    cache_creation_tokens: cacheCreationTokens,
    cost_eur: costEur,
    latency_ms: params.latencyMs ?? null,
    metadata: params.metadata ?? null,
  });
}
