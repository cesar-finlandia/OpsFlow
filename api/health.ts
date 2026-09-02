import type { VercelRequest, VercelResponse } from "@vercel/node";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { sendJson, withCors, methodGuard } from "./_shared.js";
import type { HealthResponse } from "../src/engine/types.js";

const APP_VERSION = "1.0.0";

function loadCatalog(): { products: Array<{ variants: unknown[] }> } {
  try {
    const raw = readFileSync(join(process.cwd(), "data/catalog.json"), "utf8");
    const parsed = JSON.parse(raw) as { products?: unknown[] };
    if (parsed && Array.isArray(parsed.products)) return parsed as { products: Array<{ variants: unknown[] }> };
  } catch {}
  try {
    const raw2 = readFileSync(join(process.cwd(), "hackathon-entries/2026-09-webMCP/data/catalog.json"), "utf8");
    const parsed2 = JSON.parse(raw2) as { products?: unknown[] };
    if (parsed2 && Array.isArray(parsed2.products)) return parsed2 as { products: Array<{ variants: unknown[] }> };
  } catch {}
  return { products: [] };
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  withCors(res);
  if (!methodGuard(req, res, ["GET"])) return;
  const catalog = loadCatalog();
  const products = catalog.products.length;
  const variants = catalog.products.reduce((n, p) => n + (p.variants?.length ?? 0), 0);
  const vercelEnv = process.env as Record<string, string | undefined>;
  const hasVertex = !!(vercelEnv.GOOGLE_VERTEX_PROJECT || vercelEnv.GOOGLE_VERTEX_CREDENTIALS || vercelEnv.GOOGLE_CLOUD_PROJECT);
  const hasGeminiKey = !!vercelEnv.GEMINI_API_KEY;
  const planner = hasVertex || hasGeminiKey ? "gemini-3.5-flash-lite" : "deterministic";
  const body: HealthResponse = {
    ok: true,
    version: APP_VERSION,
    mode: process.env.RES_FORCED_DEGRADED === "1" ? "degraded" : "live",
    origin_isolated: true,
    planner: planner as HealthResponse["planner"],
    catalog: { products, variants, synthetic: true as const },
  };
  sendJson(res, 200, body);
}
