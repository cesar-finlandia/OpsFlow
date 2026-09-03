// DP-SRV row 17 — typed apiClient with 900ms local fallback
import { loadConfig } from "./config.ts";
import { loadCatalog } from "./domain/catalog.ts";
import { loadZones } from "./domain/shipping.ts";
import { searchVariants } from "./domain/catalog.ts";
import { filterVariants } from "./domain/filter.ts";
import { quoteShipping } from "./domain/shipping.ts";
import { planDeterministic } from "../agent/deterministic.ts";
import type {
  HealthResponse,
  SearchInventoryInput,
  SearchInventoryOutput,
  FilterVariantsInput,
  FilterVariantsOutput,
  CalculateShippingInput,
  CalculateShippingOutput,
  ToolOutcome,
  ToolPlan,
} from "./types.ts";

export function apiBase(): string {
  try {
    const v = (import.meta as unknown as { env?: Record<string, string> }).env?.["VITE_API_BASE"];
    return v ?? "";
  } catch {
    return "";
  }
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: c.signal });
  } finally {
    clearTimeout(t);
  }
}

async function fallbackSearch(input: SearchInventoryInput): Promise<ToolOutcome<SearchInventoryOutput>> {
  try {
    const c = loadCatalog();
    const data = searchVariants(c, input);
    return { ok: true, data, degraded: true };
  } catch (e: unknown) {
    return { ok: false, error: { code: "DEGRADED", message: String(e) } };
  }
}

export const apiClient = {
  async health(): Promise<HealthResponse> {
    const url = `${apiBase()}/api/health`;
    try {
      const r = await fetchWithTimeout(url, { method: "GET" }, loadConfig().tools.network_timeout_ms);
      if (r.ok) return (await r.json()) as HealthResponse;
    } catch {}
    try {
      const catalog = loadCatalog();
      return {
        ok: false,
        version: "1.0.0",
        mode: "degraded",
        origin_isolated: false,
        planner: "deterministic",
        catalog: { products: catalog.products.length, variants: catalog.products.reduce((n, p) => n + p.variants.length, 0), synthetic: true as const },
      };
    } catch {
      return {
        ok: false,
        version: "1.0.0",
        mode: "degraded",
        origin_isolated: false,
        planner: "deterministic",
        catalog: { products: 0, variants: 0, synthetic: true as const },
      };
    }
  },

  async search(input: SearchInventoryInput): Promise<ToolOutcome<SearchInventoryOutput>> {
    const timeout = loadConfig().tools.network_timeout_ms;
    const url = `${apiBase()}/api/inventory/search`;
    try {
      const r = await fetchWithTimeout(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) }, timeout);
      if (r.ok) {
        const j = (await r.json()) as ToolOutcome<SearchInventoryOutput>;
        if (j && typeof j === "object") return j;
      }
    } catch {}
    return fallbackSearch(input);
  },

  async filter(input: FilterVariantsInput, fromSkus?: string[]): Promise<ToolOutcome<FilterVariantsOutput>> {
    const timeout = loadConfig().tools.network_timeout_ms;
    const url = `${apiBase()}/api/inventory/filter`;
    try {
      const r = await fetchWithTimeout(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...input, skus: fromSkus }) }, timeout);
      if (r.ok) return (await r.json()) as ToolOutcome<FilterVariantsOutput>;
    } catch {}
    try {
      const c = loadCatalog();
      const data = filterVariants(c, input, fromSkus);
      return { ok: true, data, degraded: true };
    } catch (e: unknown) {
      return { ok: false, error: { code: "DEGRADED", message: String(e) } };
    }
  },

  async quote(input: CalculateShippingInput): Promise<ToolOutcome<CalculateShippingOutput>> {
    const timeout = loadConfig().tools.network_timeout_ms;
    const url = `${apiBase()}/api/shipping/quote`;
    try {
      const r = await fetchWithTimeout(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) }, timeout);
      if (r.ok) return (await r.json()) as ToolOutcome<CalculateShippingOutput>;
    } catch {}
    try {
      const c = loadCatalog();
      const z = loadZones();
      const data = quoteShipping(c, z, input);
      return { ok: true, data, degraded: true };
    } catch (e: unknown) {
      return { ok: false, error: { code: "DEGRADED", message: String(e) } };
    }
  },

  async plan(goal: string, ctx?: { skus?: string[] }): Promise<ToolPlan> {
    // Planner needs longer than tools.network_timeout_ms (900ms): gemini-3.5-flash-lite takes 1-3s live.
    // Using the short timeout marked every live Gemini plan as degraded:true, which stuck the replay banner on.
    let timeout = 15000;
    try { timeout = loadConfig().resilience.timeout_ms ?? 15000; } catch {}
    if (timeout < 12000) timeout = 12000;
    const url = `${apiBase()}/api/agent/plan`;
    try {
      const r = await fetchWithTimeout(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ goal: goal.slice(0, 400), context: ctx }) }, timeout);
      if (r.ok) return (await r.json()) as ToolPlan;
    } catch {}
    try {
      return { ...planDeterministic(goal.slice(0, 400), loadCatalog()), degraded: true };
    } catch (e: unknown) {
      return { goal: goal.slice(0, 400), steps: [], planner: "deterministic", degraded: true, created_at: new Date().toISOString() };
    }
  },
};
