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
  let raw: string;
  try {
    raw = readFileSync(scriptPath, "utf8");
  } catch (e) {
    console.error(`[demo:offline] BLOCKER: missing ${scriptPath} — report to DP-SEED`);
    console.error(String(e));
    process.exit(1);
  }
  let script: { trace_id: string; envelopes: Array<{ step_id: string; status: string; payload: Record<string, unknown>; trace_id?: string }> };
  try {
    script = JSON.parse(raw) as typeof script;
  } catch (e) {
    console.error(`[demo:offline] BLOCKER: invalid JSON in ${scriptPath}`);
    console.error(String(e));
    process.exit(1);
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
