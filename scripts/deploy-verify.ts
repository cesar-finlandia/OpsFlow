// scripts/deploy-verify.ts — DP-SHIP W3 deploy verification
import type { HealthResponse } from "../src/engine/types.js";
import { APP_VERSION } from "../src/engine/types.js";

const rawArgs = process.argv.slice(2);
const urlArg = rawArgs[rawArgs.length - 1];
const url = (urlArg && !urlArg.startsWith("-") ? urlArg : "").replace(/\/$/, "");

function fail(check: string, message: string, extra: Record<string, unknown> = {}): never {
  const out = JSON.stringify({ ok: false, check, error: message, ...extra });
  console.error(out);
  process.exit(1);
}

if (!url || !/^https?:\/\//.test(url)) {
  fail("usage", `Usage: npx vite-node scripts/deploy-verify.ts -- https://<url> — got ${JSON.stringify(urlArg)}`);
}

async function main(): Promise<void> {
  // (a) header check — HEAD then fallback to GET
  let headers: Headers | null = null;
  let headerError: string | null = null;
  for (const method of ["HEAD", "GET"] as const) {
    try {
      const res = await fetch(url, { method });
      headers = res.headers;
      headerError = null;
      break;
    } catch (e) {
      headerError = String((e as Error)?.message ?? e);
      if (method === "GET") fail("headers", `fetch ${method} ${url} failed: ${headerError}`);
    }
  }
  if (!headers) fail("headers", headerError ?? "no headers");
  const originAgentCluster = headers!.get("origin-agent-cluster");
  const permissionsPolicy = headers!.get("permissions-policy");
  if (originAgentCluster !== "?1") {
    fail("headers", `Origin-Agent-Cluster expected "?1", got ${JSON.stringify(originAgentCluster)}`, {
      headers: { originAgentCluster, permissionsPolicy },
    });
  }
  if (!permissionsPolicy || !permissionsPolicy.toLowerCase().includes("tools=(self)")) {
    fail("headers", `Permissions-Policy expected "tools=(self)", got ${JSON.stringify(permissionsPolicy)}`, {
      headers: { originAgentCluster, permissionsPolicy },
    });
  }

  // (b) health check — retry once after 5s on transient failure
  let health: HealthResponse | null = null;
  let healthRaw: string = "";
  let lastErr: string | null = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(`${url}/api/health`);
      healthRaw = await res.text();
      const json = JSON.parse(healthRaw) as HealthResponse;
      health = json;
      lastErr = null;
      break;
    } catch (e) {
      lastErr = String((e as Error)?.message ?? e);
      if (attempt === 0) await new Promise((r) => setTimeout(r, 5000));
    }
  }
  if (!health) fail("health", `GET ${url}/api/health failed: ${lastErr ?? "unknown"}`, { raw: healthRaw.slice(0, 500) });
  const h = health as unknown as Record<string, unknown>;
  if (h["ok"] !== true) fail("health", `ok !== true: ${healthRaw.slice(0, 600)}`);
  if (h["version"] !== APP_VERSION) fail("health", `version expected "${APP_VERSION}", got ${JSON.stringify(h["version"])}`);
  if (h["version"] !== "1.0.0") fail("health", `version !== "1.0.0": ${JSON.stringify(h["version"])}`);
  if ((h as HealthResponse).origin_isolated !== true) fail("health", `origin_isolated !== true: ${healthRaw.slice(0, 600)}`);
  const catalog = (h["catalog"] as Record<string, unknown> | undefined);
  if (!catalog || catalog["products"] !== 60 || catalog["variants"] !== 200 || catalog["synthetic"] !== true) {
    fail("health", `catalog mismatch expected {products:60,variants:200,synthetic:true}, got ${JSON.stringify(catalog)}`);
  }
  const mode = (h["mode"] as string) ?? "live";
  const originIsolated = (h as HealthResponse).origin_isolated;
  const planner = (h as HealthResponse).planner;
  const version = (h as HealthResponse).version;
  const out = {
    ok: true as const,
    version,
    mode,
    origin_isolated: originIsolated,
    originIsolated,
    planner,
    catalog: catalog as { products: number; variants: number; synthetic: true },
    headers: { originAgentCluster, permissionsPolicy },
  };
  // Primary shape matches handout verify: ok,version,origin_isolated,catalog plus headers block
  console.log(JSON.stringify(out));
}
main().catch((e) => fail("unhandled", String((e as Error)?.message ?? e)));
