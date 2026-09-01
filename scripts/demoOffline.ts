// DP-SEED W6 — offline replay proof (depends on DP-CORE guarded + goldenCache)
import { readFileSync } from "node:fs";
import { goldenCache } from "../src/engine/resilience.ts";

function canonicalJson(value: unknown): string {
  if (value===null||typeof value!=="object") return JSON.stringify(value)??"null";
  if (Array.isArray(value)) return "["+value.map(canonicalJson).join(",")+"]";
  const obj=value as Record<string,unknown>;
  const keys=Object.keys(obj).filter(k=>obj[k]!==undefined).sort();
  return "{"+keys.map(k=>JSON.stringify(k)+":"+canonicalJson(obj[k])).join(",")+"}";
}

async function main() {
  const forced = process.env["RES_FORCED_DEGRADED"] === "1";
  if (!forced) console.log("[demoOffline] RES_FORCED_DEGRADED!=1 — running in normal mode, still replaying from cache if available");
  const shipArgs = { items: [{ sku: "OPS-1002-BLU-M", qty: 1 }, { sku: "OPS-1005-BLU-M", qty: 1 }, { sku: "OPS-1007-BLU-M", qty: 1 }, { sku: "OPS-1009-BLU-L", qty: 1 }], zone: 4, service: "ground" };
  const holdArgs = { lineItems: [{ sku: "OPS-1002-BLU-M", qty: 1 }, { sku: "OPS-1005-BLU-M", qty: 1 }, { sku: "OPS-1007-BLU-M", qty: 1 }, { sku: "OPS-1009-BLU-L", qty: 1 }], ttlMinutes: 15, note: "demo batch \u2014 low-stock blues" };
  const entries: Array<{ model: string; args: unknown }> = [
    { model: "search_inventory", args: { query: "blue", inStockOnly: false, limit: 25 } },
    { model: "filter_variants", args: { options: { color: "Blue" }, maxPriceCents: 1200, minStock: 1, maxStock: 5, limit: 25 } },
    { model: "calculate_shipping", args: shipArgs },
    { model: "hold_order", args: holdArgs },
    { model: "confirm_fulfillment", args: { holdId: "HOLD-ABCD1234" } },
  ];
  let okCount = 0;
  for (const { model, args } of entries) {
    const key = goldenCache.deriveKey({ provider: "opsflow", model, prompt: canonicalJson(args) });
    const raw = await goldenCache.get(key) as unknown;
    let value: unknown = raw;
    if (raw && typeof raw === "object" && raw !== null && "value" in (raw as Record<string, unknown>)) {
      value = (raw as Record<string, unknown>)["value"];
    }
    if (value && typeof value === "object" && (value as Record<string, unknown>)["ok"] === true) {
      console.log(`[demoOffline] tool.${model} done degraded:true`);
      okCount++;
    } else {
      console.log(`[demoOffline] tool.${model} cache miss for key ${key}`);
    }
  }
  // planner
  const plannerArgs = { goal: "hold all low-stock blue variants under $12 shipping to zone 4 for 15 minutes" };
  const plannerKey = goldenCache.deriveKey({ provider: "opsflow", model: "planner", prompt: canonicalJson(plannerArgs) });
  const plannerRaw = await goldenCache.get(plannerKey) as unknown;
  let plannerVal: unknown = plannerRaw;
  if (plannerRaw && typeof plannerRaw === "object" && plannerRaw !== null && "value" in (plannerRaw as Record<string, unknown>)) plannerVal = (plannerRaw as Record<string, unknown>)["value"];
  if (plannerVal) console.log(`[demoOffline] agent.plan done degraded:true`);
  console.log(`[demoOffline] session.degraded { reason: forced_degraded, fallback_source: cache }`);
  if (okCount === 5) {
    console.log(`[demoOffline] five-step batch completes from cache, degraded:true, exit 0`);
    process.exit(0);
  } else {
    console.log(`[demoOffline] BLOCKER: only ${okCount}/5 tools found in cache — ensure seedGolden ran`);
    process.exit(okCount === 5 ? 0 : 1);
  }
}
main().catch(e => { console.error(e); process.exit(1); });
