#!/usr/bin/env node
// DP-DEV W2 doctor - derived from assembly.manifest.json, GEMINI_API_KEY warn not fail
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";

type Check = { id: string; status: "pass" | "warn" | "fail"; message: string };

function parseArgs() {
  const a = process.argv.slice(2);
  let manifest = "assembly.manifest.json";
  let json = false;
  let output: string | null = null;
  for (let i = 0; i < a.length; i++) {
    const v = a[i]!;
    if (v === "--manifest" && a[i + 1]) manifest = a[++i]!;
    else if (v.startsWith("--manifest=")) manifest = v.split("=").slice(1).join("=");
    else if (v === "--json") json = true;
    else if (v === "--output" && a[i + 1]) output = a[++i]!;
    else if (v.startsWith("--output=")) output = v.split("=").slice(1).join("=");
  }
  return { manifest, json, output };
}

async function main() {
  const { manifest, json, output } = parseArgs();
  const checks: Check[] = [];
  let manifestData: any = null;
  try {
    const raw = readFileSync(resolve(manifest), "utf-8");
    manifestData = JSON.parse(raw);
  } catch (e) {
    checks.push({ id: "manifest", status: "fail", message: `cannot read manifest ${manifest}: ${String(e)}` });
  }

  if (manifestData && Array.isArray(manifestData.components)) {
    for (const comp of manifestData.components) {
      if (comp.included) {
        checks.push({ id: comp.id, status: "pass", message: `component ${comp.id} included — ok` });
      }
    }
  }

  // GEMINI_API_KEY must be warn not fail when absent
  const hasGemini = !!process.env.GEMINI_API_KEY;
  if (hasGemini) {
    checks.push({ id: "gemini-key", status: "pass", message: "GEMINI_API_KEY present" });
  } else {
    checks.push({ id: "gemini-key", status: "warn", message: "GEMINI_API_KEY absent — deterministic planner will be used" });
  }

  const ok = checks.every((c) => c.status !== "fail");
  const report = { ok, checks };

  if (output) {
    mkdirSync(dirname(resolve(output)), { recursive: true });
    writeFileSync(resolve(output), JSON.stringify(report, null, 2) + "\n", "utf-8");
  }

  if (json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    for (const c of checks) console.log(`${c.status} ${c.id}: ${c.message}`);
    console.log(`doctor ${ok ? "ok" : "fail"}: ${checks.length} checks`);
  }

  process.exit(ok ? 0 : 1);
}

main();

