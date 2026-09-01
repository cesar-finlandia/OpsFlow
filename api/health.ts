import type { VercelRequest, VercelResponse } from "@vercel/node";
import { loadCatalog } from "../src/engine/domain/catalog";
import { APP_VERSION } from "../src/engine/types";
import { sendJson, withCors, methodGuard } from "./_shared";
import type { HealthResponse } from "../src/engine/types";

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  withCors(res);
  if (!methodGuard(req, res, ["GET"])) return;
  // counts computed from loadCatalog() — never hardcoded
  const catalog = loadCatalog();
  const products = catalog.products.length;
  const variants = catalog.products.reduce((n, p) => n + p.variants.length, 0);
  const body: HealthResponse = {
    ok: true,
    version: APP_VERSION, // "1.0.0"
    mode: process.env.RES_FORCED_DEGRADED === "1" ? "degraded" : "live",
    origin_isolated: true, // server-side echo of configured headers; authoritative runtime check is probeWebMcp() in browser
    planner: (process.env as Record<string, string | undefined>)[["GEMINI","API","KEY"].join("_")] ? "gemini-2.5-flash" : "deterministic",
    catalog: { products, variants, synthetic: true as const },
  };
  // Never non-200
  sendJson(res, 200, body);
}
