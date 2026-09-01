import { withResilience, isDegradedResult, createGoldenCache } from "src/resilience";
import type { GoldenCache, ResilienceConfig, DegradedResult } from "src/resilience";
import { loadConfig } from "./config";
import { emitToolEvent } from "./envelopes";

export { isDegradedResult } from "src/resilience";

export const goldenCache: GoldenCache = createGoldenCache();

function readForcedDegraded(): boolean {
  try {
    if (typeof process !== "undefined" && process.env?.["RES_FORCED_DEGRADED"] === "1") return true;
  } catch {}
  try {
    const meta = (import.meta as unknown as Record<string, unknown>)["env"];
    if (meta && (meta as Record<string, unknown>)["RES_FORCED_DEGRADED"] === "1") return true;
    const env = (import.meta as unknown as Record<string, unknown>)["env"] as Record<string, unknown> | undefined;
    if (env?.["RES_FORCED_DEGRADED"] === "1") return true;
  } catch {}
  try {
    const v = (import.meta as unknown as { env?: Record<string, string> }).env?.["RES_FORCED_DEGRADED"];
    if (v === "1") return true;
  } catch {}
  return false;
}

function canonicalJson(value: unknown): string {
  if (value === null) return "null";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return JSON.stringify(value) as string;
  }
  if (Array.isArray(value)) {
    return "[" + value.map(canonicalJson).join(",") + "]";
  }
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj).filter((k) => obj[k] !== undefined).sort();
    const parts: string[] = [];
    for (const k of keys) parts.push(JSON.stringify(k) + ":" + canonicalJson(obj[k]));
    return "{" + parts.join(",") + "}";
  }
  return "null";
}

export function deriveKey(model: string, input: unknown): string {
  return goldenCache.deriveKey({ provider: "opsflow", model, prompt: canonicalJson(input) });
}

export async function guarded<T>(
  fn: () => Promise<T>,
  opts?: { cacheKey?: string; timeoutMs?: number }
): Promise<T | DegradedResult<T>> {
  const cfg = loadConfig();
  if (readForcedDegraded()) {
    const degraded: DegradedResult<T> = {
      degraded: true,
      reason: "forced_degraded",
      fallback_source: "cache",
      original_error: null,
      data: undefined as unknown as T,
      timestamp: new Date().toISOString(),
      version: "1.0.0",
    };
    try {
      const key = opts?.cacheKey ?? deriveKey("guarded", fn.toString());
      const cachedRaw = (await goldenCache.get(key)) as unknown | null;
      let cached: T | null = null;
      if (cachedRaw != null) {
        // Unwrap DP-SEED wrapper {key,value,meta} if present, else use raw
        if (typeof cachedRaw === "object" && cachedRaw !== null && "value" in (cachedRaw as Record<string, unknown>) && "meta" in (cachedRaw as Record<string, unknown>)) {
          cached = (cachedRaw as Record<string, unknown>)["value"] as T;
        } else {
          cached = cachedRaw as T;
        }
      }
      if (cached != null) (degraded as { data: unknown }).data = cached;
    } catch {}
    try {
      await emitToolEvent("session.degraded", "done", { reason: "forced_degraded", fallback_source: "cache" });
    } catch {}
    return degraded;
  }
  const rc: ResilienceConfig = {
    timeout_ms: opts?.timeoutMs ?? cfg.resilience.timeout_ms,
    retries: cfg.resilience.retries,
    backoff: {
      policy: cfg.resilience.backoff.policy as ResilienceConfig["backoff"]["policy"],
      base_ms: cfg.resilience.backoff.base_ms,
      factor: cfg.resilience.backoff.factor,
      max_ms: cfg.resilience.backoff.max_ms,
      jitter: cfg.resilience.backoff.jitter,
    },
    fallback_chain: { order: [...cfg.resilience.fallback_chain.order] as ResilienceConfig["fallback_chain"]["order"] },
    forced_degraded: false,
  };
  const wrapped = withResilience(fn, rc, { cache: goldenCache } as unknown as Parameters<typeof withResilience>[2]);
  const result = await (wrapped as () => Promise<T | DegradedResult<T>>)();
  if (isDegradedResult(result)) {
    const r = result as DegradedResult<T>;
    try {
      await emitToolEvent("session.degraded", "done", {
        reason: (r as unknown as Record<string, unknown>)["reason"] ?? "unknown",
        fallback_source: (r as unknown as Record<string, unknown>)["fallback_source"] ?? "none",
      });
    } catch {}
  }
  return result;
}
