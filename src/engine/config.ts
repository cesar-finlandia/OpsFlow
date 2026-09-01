// DP-CORE W2 — config loader
// @ts-ignore — JSON import with NodeNext requires resolveJsonModule; Vite handles it without attribute
import raw from "../../config/engine.json";

export interface EngineConfig {
  version: string;
  app: { name: string; theme: string; trace_prefix: string };
  planner: { provider: string; model: string; max_output_tokens: number; temperature: number; fallback: string };
  tools: { max_text_chars: number; max_result_chars: number; max_items: number; default_limit: number; network_timeout_ms: number };
  holds: { default_ttl_minutes: number; min_ttl_minutes: number; max_ttl_minutes: number };
  resilience: { timeout_ms: number; retries: number; backoff: { policy: string; base_ms: number; factor: number; max_ms: number; jitter: boolean }; fallback_chain: { order: string[] } };
  context: { max_tokens: number; reserve_output: number };
  cost: { store_path: string; budget_path: string };
}

let cached: EngineConfig | null = null;

function readEnv(key: string): string | undefined {
  try {
    if (typeof process !== "undefined" && process.env && key in process.env) {
      const v = (process.env as Record<string, string | undefined>)[key];
      if (v !== undefined) return v;
    }
  } catch {}
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const meta: any = (import.meta as any);
    if (meta && meta.env && key in meta.env) return meta.env[key] as string | undefined;
  } catch {}
  return undefined;
}

function configOverrides(): Partial<EngineConfig> {
  const out: Record<string, unknown> = {};
  const t = readEnv("RES_TIMEOUT_MS");
  if (t !== undefined && t !== "") {
    const n = Number(t);
    if (!Number.isNaN(n)) out["resilience"] = { ...(out["resilience"] as object ?? {}), timeout_ms: n };
  }
  const r = readEnv("RES_RETRIES");
  if (r !== undefined && r !== "") {
    const n = Number(r);
    if (!Number.isNaN(n)) out["resilience"] = { ...(out["resilience"] as object ?? {}), retries: n };
  }
  const d = readEnv("RES_FORCED_DEGRADED");
  if (d !== undefined && d !== "") {
    (out as Record<string, unknown>)["__forced_degraded"] = d === "1";
  }
  const p = readEnv("OPSFLOW_PLANNER");
  if (p !== undefined && p !== "") {
    out["planner"] = { ...(out["planner"] as object ?? {}), fallback: p };
  }
  return out as Partial<EngineConfig>;
}

export function loadConfig(): EngineConfig {
  if (cached) return cached;
  if (!raw) throw new Error("config/engine.json is missing — fatal at startup");
  const cfg: EngineConfig = JSON.parse(JSON.stringify(raw)) as EngineConfig;
  const ov = configOverrides() as Record<string, unknown>;
  if (ov["resilience"] && typeof ov["resilience"] === "object") {
    cfg.resilience = { ...cfg.resilience, ...(ov["resilience"] as Partial<EngineConfig["resilience"]>) } as EngineConfig["resilience"];
  }
  if (ov["planner"] && typeof ov["planner"] === "object") {
    cfg.planner = { ...cfg.planner, ...(ov["planner"] as object) } as EngineConfig["planner"];
  }
  cached = cfg;
  return cached;
}
