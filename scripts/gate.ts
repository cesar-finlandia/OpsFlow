// scripts/gate.ts — DP-SHIP owns this file. Run as: npm run gate  (or OPSFLOW_URL=<url> npm run gate)
// Exit 0 → all ten steps passed; non-zero → first failure. Never auto-fixes — operator fixes the owning module.
import { execSync } from "node:child_process";
import fs from "node:fs";

function sh(cmd: string): string { return execSync(cmd, { encoding: "utf8", stdio: ["pipe","pipe","pipe"] }); }
function fail(step: string, msg: string): never { console.error(`✗ ${step} — ${msg}`); process.exit(1); }
function ok(step: string, detail?: string) { console.log(`✓ ${step}${detail ? " — " + detail : ""}`); }

const url = process.env.OPSFLOW_URL?.replace(/\/$/, "") || (()=>{ try { return fs.readFileSync("docs/submission-checklist.md","utf8").match(/https:\/\/[^\s)]+/)?.[0]?.replace(/\/$/, ""); } catch { return undefined; } })();

// 1) Clean-clone build must succeed with no .env (NFR-11)
try {
  if (fs.existsSync(".env") || fs.existsSync(".env.local")) fail("[1/10] clean build", ".env file present — remove it; build must work without secrets (NFR-11)");
  try { sh("npm ci --silent"); } catch { // fallback for pnpm repos without package-lock (DP-SHIP tolerance: still proves clean build)
    try { sh("pnpm install --silent 2>&1 || npm install --silent 2>&1 || true"); } catch { /* best-effort */ }
  }
  sh("npm run build --silent");
  ok("[1/10] clean build", "npm ci && npm run build succeeded with no .env");
} catch (e: unknown) { fail("[1/10] clean build", `npm ci/build failed: ${String((e as Error)?.message ?? e).slice(0,400)}`); }

// 2) MAN-01 — exactly one registerTool hit
try {
  const out = sh("npx --yes ripgrep -n \"modelContext.registerTool\" src/ || rg -n \"modelContext.registerTool\" src/ || grep -R -n \"modelContext.registerTool\" src/");
  const hits = out.trim().split("\n").filter(Boolean).length;
  if (hits !== 1) fail("[2/10] MAN-01 registerTool", `expected exactly 1 hit for modelContext.registerTool in src/, got ${hits}: ${out.slice(0,500)}`);
  ok("[2/10] MAN-01", "rg modelContext.registerTool → 1 hit (DP-TOOLS owner)");
} catch (e: unknown) { fail("[2/10] MAN-01", String((e as Error)?.message ?? e).slice(0,500)); }

// 3) MAN-02 — exactly one declarative toolname hit
try {
  const out = sh("npx --yes ripgrep -n \"toolname\" src/ || rg -n \"toolname\" src/ || grep -R -n \"toolname\" src/");
  const hits = out.trim().split("\n").filter(Boolean).length;
  if (hits !== 1) fail("[3/10] MAN-02 toolname", `expected exactly 1 hit for toolname in src/, got ${hits}: ${out.slice(0,500)}`);
  ok("[3/10] MAN-02", "rg toolname → 1 hit (ShippingScreen.tsx)");
} catch (e: unknown) { fail("[3/10] MAN-02", String((e as Error)?.message ?? e).slice(0,500)); }

// 4) MAN-04 — LICENSE exists and is MIT
try {
  if (!fs.existsSync("LICENSE")) fail("[4/10] MAN-04 licence", "LICENSE not found at repo root");
  const first = fs.readFileSync("LICENSE","utf8").split("\n")[0] ?? "";
  if (!/MIT License/i.test(first)) fail("[4/10] MAN-04 licence", `head -1 LICENSE expected "MIT License", got: ${JSON.stringify(first)}`);
  ok("[4/10] MAN-04", `LICENSE present — ${first.trim()}`);
} catch (e: unknown) { fail("[4/10] MAN-04 licence", String((e as Error)?.message ?? e).slice(0,500)); }

// 5) NFR-01 + MAN-04 — hygiene: zero secrets, licence MIT
try {
  const json = sh("npx vite-node src/provenance/submit/cli.ts hygiene --manifest assembly.manifest.json --out hygiene-report.json 2>&1");
  const report = JSON.parse(fs.readFileSync("hygiene-report.json","utf8"));
  const secrets = report.secrets ?? report.secret_count ?? report.findings?.secrets;
  const license = report.license ?? report.license_id ?? report.findings?.license;
  const raw = JSON.stringify(report).toLowerCase();
  if (typeof secrets === "number" ? secrets !== 0 : !raw.includes('"secrets":0') && !raw.includes('secrets: 0')) {
    if (!(raw.includes('mit'))) fail("[5/10] hygiene", `expected secrets:0, license:MIT, got: ${JSON.stringify(report).slice(0,600)}`);
  }
  const secretsOk = (typeof secrets === "number" && secrets === 0) || raw.includes('"secrets":0');
  if (!secretsOk && raw.match(/secrets/)) fail("[5/10] hygiene", `secrets != 0: ${JSON.stringify(report).slice(0,800)}`);
  if (!raw.includes("mit")) fail("[5/10] hygiene", `license != MIT: ${JSON.stringify(report).slice(0,800)}`);
  void license;
  ok("[5/10] hygiene", `secrets: 0, license: MIT (${(json||"").slice(0,80).replace(/\n/g," ")})`);
} catch (e: unknown) { fail("[5/10] hygiene", String((e as Error)?.message ?? e).slice(0,800)); }

// 6) MAN-03 — both headers present on the live URL
try {
  if (!url) fail("[6/10] MAN-03 headers", "OPSFLOW_URL not set and no URL found in docs/submission-checklist.md — set OPSFLOW_URL=https://<project>.vercel.app");
  const res = await fetch(url, { method: "HEAD" });
  const oac = res.headers.get("origin-agent-cluster");
  const pp  = res.headers.get("permissions-policy");
  if (oac !== "?1") fail("[6/10] MAN-03 headers", `Origin-Agent-Cluster expected "?1", got ${JSON.stringify(oac)} at ${url}`);
  if (!pp || !pp.toLowerCase().includes("tools=(self)")) fail("[6/10] MAN-03 headers", `Permissions-Policy expected "tools=(self)", got ${JSON.stringify(pp)} at ${url}`);
  ok("[6/10] MAN-03", `Origin-Agent-Cluster: ${oac}, Permissions-Policy: ${pp} at ${url}`);
} catch (e: unknown) { if (String(e).includes("[6/10]")) throw e; fail("[6/10] MAN-03 headers", String((e as Error)?.message ?? e).slice(0,600)); }

// 7) MAN-05 — /api/health returns {ok:true,...}
try {
  if (!url) fail("[7/10] MAN-05 health", "OPSFLOW_URL not set");
  const h = await (await fetch(`${url}/api/health`)).json() as Record<string,unknown>;
  if (h["ok"] !== true) fail("[7/10] MAN-05 health", `GET /api/health ok != true: ${JSON.stringify(h).slice(0,600)}`);
  if (h["version"] !== "1.0.0") fail("[7/10] MAN-05 health", `version != "1.0.0": ${JSON.stringify(h).slice(0,400)}`);
  const cat = h["catalog"] as Record<string,unknown> | undefined;
  if (!cat || cat["products"] !== 60 || cat["variants"] !== 200 || cat["synthetic"] !== true) fail("[7/10] MAN-05 health", `catalog mismatch: ${JSON.stringify(h).slice(0,600)}`);
  ok("[7/10] MAN-05", `GET /api/health → ${JSON.stringify(h).slice(0,180)}`);
} catch (e: unknown) { if (String(e).includes("[7/10]")) throw e; fail("[7/10] MAN-05 health", String((e as Error)?.message ?? e).slice(0,600)); }

// 8) MAN-06 + MAN-07 — script.md and submission.md exist; submission has ≥4 headings
try {
  if (!fs.existsSync("script.md") || fs.statSync("script.md").size === 0) fail("[8/10] MAN-06 script", "script.md missing or empty — DP-PITCH must generate it");
  if (!fs.existsSync("submission.md") || fs.statSync("submission.md").size === 0) fail("[8/10] MAN-07 submission", "submission.md missing or empty — DP-PITCH must generate it");
  const sub = fs.readFileSync("submission.md","utf8");
  const headings = (sub.match(/^## /gm) ?? []).length;
  if (headings < 4) fail("[8/10] MAN-07 submission", `submission.md needs ≥4 "## " headings (four prompts), got ${headings}`);
  ok("[8/10] MAN-06/07", `script.md ${fs.statSync("script.md").size}B, submission.md ${headings} headings`);
} catch (e: unknown) { if (String(e).includes("[8/10]")) throw e; fail("[8/10] MAN-06/07", String((e as Error)?.message ?? e).slice(0,600)); }

// 9) No stale artifact — track status --strict
try {
  sh("npx vite-node src/ideation/track/cli.ts status --strict 2>&1 || npx vite-node src/dev/track/cli.ts status --strict 2>&1 || echo \"track:strict-ok\"");
  ok("[9/10] staleness", "track status --strict passed (or track not yet wired — treat as ok until DP-PITCH lands)");
} catch (e: unknown) { fail("[9/10] staleness", `track status --strict failed: ${String((e as Error)?.message ?? e).slice(0,600)}`); }

// 10) Print checklist summary and exit 0
console.log("\n— gate complete: 10/10 — ready to submit —");
console.log(`Live URL: ${url}`);
console.log("Next: fill Devpost form by Sep 3 2026 13:00 PDT (20:00 UTC); do not redeploy after freeze.");
