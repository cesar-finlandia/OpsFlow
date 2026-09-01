#!/usr/bin/env node
// DP-DEV W3 eval harness - target src/agent/deterministic.ts#planDeterministic
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { pathToFileURL } from "node:url";

type Args = { target?: string; cases?: string; json?: boolean; output?: string };

function parseArgs(): Args {
  const a = process.argv.slice(2);
  const out: Args = {};
  for (let i = 0; i < a.length; i++) {
    const v = a[i]!;
    if (v === "--target" && a[i + 1]) out.target = a[++i];
    else if (v.startsWith("--target=")) out.target = v.split("=").slice(1).join("=");
    else if (v === "--cases" && a[i + 1]) out.cases = a[++i];
    else if (v.startsWith("--cases=")) out.cases = v.split("=").slice(1).join("=");
    else if (v === "--output" && a[i + 1]) out.output = a[++i];
    else if (v.startsWith("--output=")) out.output = v.split("=").slice(1).join("=");
    else if (v === "--json") out.json = true;
  }
  return out;
}

function deepEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function validateToolPlan(plan: any): { ok: boolean; reason?: string } {
  if (!plan || typeof plan !== "object") return { ok: false, reason: "plan not object" };
  if (typeof plan.goal !== "string") return { ok: false, reason: "missing goal" };
  if (!Array.isArray(plan.steps)) return { ok: false, reason: "missing steps" };
  if (typeof plan.planner !== "string") return { ok: false, reason: "missing planner" };
  if (typeof plan.degraded !== "boolean") return { ok: false, reason: "missing degraded" };
  if (typeof plan.created_at !== "string") return { ok: false, reason: "missing created_at" };
  for (let i = 0; i < plan.steps.length; i++) {
    const s = plan.steps[i];
    if (!s || typeof s.tool !== "string") return { ok: false, reason: `step ${i} missing tool` };
    if (!s.args || typeof s.args !== "object") return { ok: false, reason: `step ${i} missing args` };
    if (typeof s.rationale !== "string") return { ok: false, reason: `step ${i} missing rationale` };
  }
  return { ok: true };
}

async function main() {
  const args = parseArgs();
  const target = args.target ?? "src/agent/deterministic.ts#planDeterministic";
  const casesPath = args.cases ?? "tests/eval/plan-cases.json";

  let raw: string;
  try {
    raw = readFileSync(resolve(casesPath), "utf-8");
  } catch (e) {
    console.error(JSON.stringify({ error: `cannot read cases file: ${casesPath}`, detail: String(e) }));
    process.exit(1);
  }
  let data: any;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    console.error(JSON.stringify({ error: "invalid JSON in cases file", detail: String(e) }));
    process.exit(1);
  }

  const cases: any[] = data.cases ?? [];
  const targetStr: string = data.target ?? target;
  const [filePart, exportName] = targetStr.split("#");
  const effFile = filePart ?? target.split("#")[0]!;
  const effExport = exportName ?? target.split("#")[1] ?? "planDeterministic";

  let fn: any;
  try {
    const abs = resolve(effFile!);
    const mod = await import(pathToFileURL(abs).href);
    fn = mod[effExport!];
    if (!fn) fn = mod.default?.[effExport!] ?? mod.default;
    if (typeof fn !== "function") throw new Error(`export ${effExport!} not found or not a function in ${effFile}`);
  } catch (e) {
    console.error(JSON.stringify({ error: `failed to load target ${targetStr}`, detail: String(e) }));
    process.exit(1);
  }

  // load catalog via DP-DOM loadCatalog if available, else fallback to file
  let catalog: any = null;
  let catalogLoadedVia: string = "none";
  try {
    const catMod = await import(pathToFileURL(resolve("src/engine/domain/catalog.ts")).href);
    if (catMod.loadCatalog) { catalog = catMod.loadCatalog(); catalogLoadedVia = "loadCatalog"; }
  } catch {}
  if (!catalog) {
    try { catalog = JSON.parse(readFileSync(resolve("data/catalog.json"), "utf-8")); catalogLoadedVia = "data/catalog.json"; } catch {}
  }

  let passed = 0;
  let failed = 0;
  const results: any[] = [];
  const reportCases: any[] = [];

  for (const c of cases) {
    const id = c.id ?? "(unknown)";
    // Detect case schema: DP-DEV new format has input as string and expected_regex
    const isNewFormat = typeof c.input === "string" && (c.expected_regex !== undefined || c.expected_schema !== undefined);
    try {
      let actual: any;
      let goal: string;
      let effCatalog = catalog;
      if (isNewFormat) {
        goal = c.input as string;
        actual = await fn(goal, effCatalog);
      } else {
        // legacy DP-AGENT format: input { goal, catalog }
        const input = c.input ?? {};
        let cat = input.catalog;
        if (typeof cat === "string" && cat.startsWith("$ref:")) {
          cat = JSON.parse(readFileSync(resolve(cat.slice(5).trim()), "utf-8"));
        } else if (cat && typeof cat === "object" && (cat as any).$ref) {
          cat = JSON.parse(readFileSync(resolve((cat as any).$ref), "utf-8"));
        }
        effCatalog = cat ?? catalog;
        goal = input.goal ?? "";
        actual = await fn(goal, effCatalog);
      }

      const toolSequence = (actual?.steps ?? []).map((s: any) => s.tool).join(",");
      let ok = true;
      let reason = "";

      if (isNewFormat) {
        // Validate ToolPlan schema
        const v = validateToolPlan(actual);
        if (!v.ok) { ok = false; reason = `ToolPlan schema fail: ${v.reason}`; }
        // Regex check
        if (ok && c.expected_regex) {
          const re = new RegExp(c.expected_regex);
          if (!re.test(toolSequence)) { ok = false; reason = `regex fail: expected ${c.expected_regex} got '${toolSequence}'`; }
        }
        // assert_no_tool
        if (ok && c.assert_no_tool) {
          const tools = (actual.steps ?? []).map((s: any) => s.tool);
          if (tools.includes(c.assert_no_tool)) { ok = false; reason = `assert_no_tool fail: found ${c.assert_no_tool} in ${toolSequence}`; }
        }
        // expected_schema check (always ToolPlan)
        if (ok && c.expected_schema && c.expected_schema !== "ToolPlan") { ok = false; reason = `expected_schema mismatch` }
      } else {
        const expect = c.expect ?? {};
        if (expect.steps) {
          const expectedSteps: any[] = expect.steps;
          const actualSteps: any[] = actual?.steps ?? [];
          if (expectedSteps.length !== actualSteps.length) {
            ok = false; reason = `steps length mismatch: expected ${expectedSteps.length}, got ${actualSteps.length} (${toolSequence})`;
          } else {
            for (let i = 0; i < expectedSteps.length; i++) {
              const es = expectedSteps[i]; const as = actualSteps[i];
              if (es.tool && as.tool !== es.tool) { ok = false; reason = `step ${i} tool mismatch: expected ${es.tool}, got ${as.tool}`; break; }
              if (es.args) {
                for (const k of Object.keys(es.args)) {
                  if (!deepEqual((es.args as any)[k], (as.args as any)[k])) { ok = false; reason = `step ${i} arg '${k}' mismatch: expected ${JSON.stringify((es.args as any)[k])}, got ${JSON.stringify((as.args as any)[k])}`; break; }
                }
                if (!ok) break;
              }
            }
          }
        }
        if (ok && expect.planner && actual.planner !== expect.planner) { ok = false; reason = `planner mismatch` }
      }

      if (ok) { passed++; results.push({ id, passed: true }); reportCases.push({ id, ok: true, toolSequence }); }
      else { failed++; results.push({ id, passed: false, error: reason, actual }); reportCases.push({ id, ok: false, toolSequence, error: reason }); }
    } catch (e) { failed++; results.push({ id, passed: false, error: String(e) }); reportCases.push({ id, ok: false, toolSequence: "", error: String(e) }); }
  }

  const out = { target: targetStr, total: cases.length, passed, failed, results, cases: reportCases };
  // Also shape { passed, failed, cases: [{id, ok, toolSequence}]} for DP-DEV report
  const report = { passed, failed, cases: reportCases };
  // handle --output
  const outputPath = (args as any).output ?? (process.argv.includes("--output") ? (()=>{const idx=process.argv.indexOf("--output"); return process.argv[idx+1]})() : undefined);
  // fallback parse output from raw argv if not via parseArgs
  let effOutput = (args as any).output;
  if (!effOutput) {
    const idx = process.argv.indexOf("--output");
    if (idx !== -1 && process.argv[idx+1]) effOutput = process.argv[idx+1];
  }
  if (effOutput) {
    try { mkdirSync(dirname(resolve(effOutput)), { recursive: true }); writeFileSync(resolve(effOutput), JSON.stringify(report, null, 2), "utf-8"); } catch (e) { console.error(JSON.stringify({ error: `failed to write output ${effOutput}`, detail: String(e) })); }
  } else {
    // default DP-DEV path
    try { mkdirSync(dirname(resolve("reports/eval/eval-report.json")), { recursive: true }); writeFileSync(resolve("reports/eval/eval-report.json"), JSON.stringify(report, null, 2), "utf-8"); } catch {}
  }

  if (args.json) {
    console.log(JSON.stringify(out, null, 2));
  } else {
    console.log(`Eval ${targetStr}: ${passed}/${cases.length} passed, ${failed} failed`);
    for (const r of results) console.log(` - ${r.id}: ${r.passed ? "PASS" : "FAIL"}${r.error ? " - " + r.error : ""}`);
  }
  process.exit(failed > 0 ? 1 : 0);
}

main();
