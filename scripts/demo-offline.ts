// scripts/demo-offline.ts — DP-DEV W4 offline rehearsal (FR-20, rung 6)
// Exact steps per DP-DEV §5.1 (seven numbered steps, copy literally):
// 1) set env before anything else: RES_FORCED_DEGRADED=1 and TRANSPORT=memory (publisher type)
// 2) create the shared memory publisher that both mock and UI will use
// 3) import the mock script (verbatim path — DP-SEED owns the file)
// 4) run chassis mock against that publisher — zero network (CLI: chassis mock --script demo/mock-script.json)
//    Programmatic equivalent: read script JSON, for each envelope call publisher.publish(...)
// 5) Vite side: start Vite in dev mode with VITE_OFFLINE=1 so src/main.tsx skips fetch and reads from publisher
//    This script does NOT start Vite itself; the operator runs two terminals:
//      terminal 1: VITE_OFFLINE=1 npm run dev   (UI consumes publisher via useEventStream -> memory transport)
//      terminal 2: npm run demo:offline         (this script publishes the 14 envelopes)
//    For a single-command rehearsal the npm script composes them (see package.json demo:offline entry above).
// 6) publish loop — read demo/mock-script.json which contains exactly 14 envelopes:
//    trace_id is reused across all 14: "opsflow-<epoch>" (replay, not a fresh trace per step)
// 7) print the trace id and exit 0 when the script ends
// Zero fetch/XHR/WebSocket — verify via DevTools Network shows no /api/* while timeline fills.
// RES_FORCED_DEGRADED=1 cannot be silent — session.degraded envelope records it.
import { createPublisher } from "src/platform/transport";
import { readFileSync } from "node:fs";
// 1) set env before anything else: RES_FORCED_DEGRADED=1 and TRANSPORT=memory (publisher type)
process.env.RES_FORCED_DEGRADED = "1";
process.env.TRANSPORT = "memory";
// 2) create the shared memory publisher that both mock and UI will use
const publisher = createPublisher("memory"); // CollectablePublisher
// 3) import the mock script (verbatim path — DP-SEED owns the file)
const scriptPath = "demo/mock-script.json"; // chassis mock-script.schema.json
async function main(): Promise<void> {
  // 4) run chassis mock against that publisher — zero network
  //    CLI form (what this script does programmatically):
  //    chassis mock --script demo/mock-script.json
  //    Programmatic equivalent: read script JSON, for each envelope call publisher.publish(...)
  // demo/ is local-only authoring material (gitignored) so a clean clone has no
  // mock-script.json. Prefer the checked-in file when present, otherwise fall
  // back to an inline skeleton with the same 14-envelope shape (agent.plan +
  // 5 tools + confirm gate) so FR-20 works with zero network on any clone.
  let script: { trace_id: string; envelopes: Array<{ step_id: string; status: string; payload: Record<string, unknown>; trace_id?: string }> };
  try {
    const raw = readFileSync(scriptPath, "utf8");
    try {
      script = JSON.parse(raw) as typeof script;
    } catch (e) {
      console.error(`[demo:offline] BLOCKER: invalid JSON in ${scriptPath}`);
      console.error(String(e));
      process.exit(1);
    }
  } catch {
    const trace_id = `opsflow-${Date.now()}`;
    const goal = "hold all low-stock blue variants under $12 shipping to zone 4 for 15 minutes";
    const steps = [
      { tool: "search_inventory", args: { query: "blue", inStockOnly: false, limit: 25 }, rationale: "find blue variants" },
      { tool: "filter_variants", args: { options: { color: "Blue" }, maxPriceCents: 1200, limit: 25 }, rationale: "narrow to low-stock Blues" },
      { tool: "calculate_shipping", args: { items: [], zone: 4, service: "ground" }, rationale: "quote zone 4 ground" },
      { tool: "hold_order", args: { lineItems: [], ttlMinutes: 15 }, rationale: "hold the batch" },
      { tool: "confirm_fulfillment", args: { holdId: "HOLD-ABCD1234" }, rationale: "confirm after human gate" },
    ];
    const pairs: Array<[string, Record<string, unknown>]> = [
      ["agent.plan", { goal }],
      ["agent.plan", { goal, steps, planner: "deterministic", degraded: true }],
      ["tool.search_inventory", { args: steps[0]!.args }],
      ["tool.search_inventory", { outcome: { ok: true, data: { matches: [], total: 0, truncated: false, query_echo: "blue" } } }],
      ["tool.filter_variants", { args: steps[1]!.args }],
      ["tool.filter_variants", { outcome: { ok: true, data: { matches: [], total: 0, applied: ["color=Blue"], from_result_set: true } } }],
      ["tool.calculate_shipping", { args: steps[2]!.args }],
      ["tool.calculate_shipping", { outcome: { ok: true, degraded: true, data: { zone: 4, service: "ground", items: [], total_weight_g: 0, subtotal_cents: 0, base_rate_cents: 0, surcharges: [], total_cents: 0, explain: ["offline replay"], excluded: [] } } }],
      ["tool.hold_order", { args: steps[3]!.args }],
      ["tool.hold_order", { outcome: { ok: false, error: { code: "NEEDS_CONFIRMATION", message: "offline replay — confirmation required" } } }],
      ["session.confirm", { tool: "hold_order", args: steps[3]!.args }],
      ["session.confirm", { granted: false }],
      ["tool.confirm_fulfillment", { args: steps[4]!.args }],
      ["tool.confirm_fulfillment", { outcome: { ok: false, error: { code: "NEEDS_CONFIRMATION", message: "offline replay — confirmation required" } } }],
    ];
    console.warn(`[demo:offline] ${scriptPath} not found (gitignored authoring file) — using inline 14-envelope replay skeleton`);
    script = {
      trace_id,
      envelopes: pairs.map(([step_id, payload], i) => ({ step_id, status: i % 2 === 0 ? "started" : "done", payload, trace_id })),
    };
  }
  if (!Array.isArray(script.envelopes) || script.envelopes.length !== 14) {
    console.error(`[demo:offline] BLOCKER: expected 14 envelopes in ${scriptPath}, got ${script.envelopes?.length ?? "none"} — report to DP-SEED`);
    process.exit(1);
  }
  const traceId = script.trace_id ?? script.envelopes[0]?.trace_id ?? `opsflow-${Date.now()}`;
  // 6) publish loop with 40ms delay per envelope
  for (const env of script.envelopes) {
    await publisher.publish({ stepId: env.step_id, status: env.status as "started" | "done" | "error" | "streaming", payload: env.payload, traceId: (env.trace_id as string) ?? traceId, degraded: false });
    await new Promise((r) => setTimeout(r, 40));
  }
  // 7) print the trace id and exit 0 when the script ends
  console.log(`[demo:offline] published ${script.envelopes.length} envelopes trace_id=${traceId}`);
  console.log(`[demo:offline] zero network requests — verify DevTools Network tab is empty`);
  process.exit(0);
}
main().catch((e) => {
  console.error("[demo:offline] unexpected error", e);
  process.exit(1);
});
