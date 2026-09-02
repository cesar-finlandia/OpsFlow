import type { VercelRequest, VercelResponse } from "@vercel/node";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { readJson, sendJson, badRequest, withCors, methodGuard } from "../_shared.js";

function loadCatalog(): { products: Array<{ title: string; brand: string; category: string; variants: Array<{ sku: string; title: string; options: { size: string; color: string }; price_cents: number; stock: number; weight_g: number; low_stock_threshold: number }> }>; synthetic: true } {
  try {
    const raw = readFileSync(join(process.cwd(), "data/catalog.json"), "utf8");
    return JSON.parse(raw) as never;
  } catch {}
  try {
    const raw2 = readFileSync(join(process.cwd(), "hackathon-entries/2026-09-webMCP/data/catalog.json"), "utf8");
    return JSON.parse(raw2) as never;
  } catch {}
  return { products: [] as never, synthetic: true } as never;
}

function validateSearch(body: Record<string, unknown>): Array<{ message: string; path: string; code: string }> {
  const errs: Array<{ message: string; path: string; code: string }> = [];
  if (!("query" in body)) errs.push({ path: "/query", message: "must have required property 'query'", code: "required" });
  else {
    const q = body["query"];
    if (typeof q !== "string") errs.push({ path: "/query", message: "must be string", code: "type" });
    else if (q.length > 200) errs.push({ path: "/query", message: "must NOT have more than 200 characters", code: "maxLength" });
  }
  if ("inStockOnly" in body && typeof body["inStockOnly"] !== "boolean") errs.push({ path: "/inStockOnly", message: "must be boolean", code: "type" });
  if ("limit" in body) {
    const l = body["limit"];
    if (typeof l !== "number" || !Number.isInteger(l) || l < 1 || l > 50) errs.push({ path: "/limit", message: "must be integer 1..50", code: "type" });
  }
  if (Object.keys(body).some(k => !["query","inStockOnly","limit"].includes(k))) {
    const extra = Object.keys(body).find(k => !["query","inStockOnly","limit"].includes(k))!;
    errs.push({ path: "/", message: `must NOT have additional property '${extra}'`, code: "additionalProperties" });
  }
  return errs;
}

function isLowStock(v: { stock: number; low_stock_threshold: number }): boolean { return v.stock <= v.low_stock_threshold; }

function searchVariants(catalog: ReturnType<typeof loadCatalog>, input: { query: string; inStockOnly?: boolean; limit?: number }): { matches: unknown[]; total: number; truncated: boolean; query_echo: string } {
  const query_echo = (input.query ?? "").slice(0, 200);
  const lower = query_echo.toLowerCase().trim();
  const terms = lower === "" || lower === "*" || lower === "all" ? [] : lower.split(/\s+/).filter(Boolean);
  const survivors: Array<{ product: { title: string; brand: string; category: string }; variant: { sku: string; title: string; options: { size: string; color: string }; price_cents: number; stock: number; low_stock_threshold: number } }> = [];
  for (const product of catalog.products ?? []) {
    for (const variant of product.variants ?? []) {
      const haystack = [product.title, product.brand, product.category, variant.title, variant.sku, variant.options.size, variant.options.color].join(" ").toLowerCase();
      let matches = true;
      if (terms.length > 0) for (const t of terms) if (!haystack.includes(t)) { matches = false; break; }
      if (!matches) continue;
      if (input.inStockOnly === true && variant.stock === 0) continue;
      survivors.push({ product, variant });
    }
  }
  survivors.sort((a,b) => {
    const aIn = a.variant.stock>0?1:0; const bIn = b.variant.stock>0?1:0;
    if (bIn!==aIn) return bIn-aIn;
    if (a.variant.price_cents!==b.variant.price_cents) return a.variant.price_cents-b.variant.price_cents;
    return a.variant.sku.localeCompare(b.variant.sku);
  });
  const total = survivors.length;
  const lim = Math.max(1, Math.min(100, Math.floor(input.limit ?? 25) || 25));
  const sliced = survivors.slice(0, lim);
  const matches = sliced.map(({ variant: v }) => ({ sku: v.sku, title: v.title, options: { ...v.options }, price_cents: v.price_cents, stock: v.stock, low_stock: isLowStock(v) }));
  return { matches, total, truncated: total > matches.length, query_echo };
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  withCors(res);
  if (!methodGuard(req, res, ["POST"])) return;
  try {
    const body = readJson(req) as Record<string, unknown>;
    const errors = validateSearch(body);
    if (errors.length > 0) {
      badRequest(res, (errors[0]!.message ?? "INVALID_INPUT"), { errors } as never);
      return;
    }
    const catalog = loadCatalog();
    const output = searchVariants(catalog, body as never);
    sendJson(res, 200, { ok: true, data: output });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("32 KB") || msg.includes("invalid JSON") || (err as never as { code?: string })?.code === "INVALID_INPUT") {
      badRequest(res, msg);
      return;
    }
    sendJson(res, 500, { ok: false, error: { code: "DEGRADED", message: msg } });
  }
}
