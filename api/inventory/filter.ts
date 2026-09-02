import type { VercelRequest, VercelResponse } from "@vercel/node";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { readJson, sendJson, badRequest, withCors, methodGuard } from "../_shared.js";

function loadCatalog(): { products: Array<{ variants: Array<{ sku: string; title: string; options: { size: string; color: string }; price_cents: number; stock: number; low_stock_threshold: number }> }> } {
  try { const raw = readFileSync(join(process.cwd(), "data/catalog.json"), "utf8"); return JSON.parse(raw) as never; } catch {}
  try { const raw2 = readFileSync(join(process.cwd(), "hackathon-entries/2026-09-webMCP/data/catalog.json"), "utf8"); return JSON.parse(raw2) as never; } catch {}
  return { products: [] as never };
}

function validateFilter(body: Record<string, unknown>): Array<{ message: string; path: string; code: string }> {
  const errs: Array<{ message: string; path: string; code: string }> = [];
  const allowed = ["skuPrefix","options","maxPriceCents","minStock","maxStock","limit"];
  for (const k of Object.keys(body)) if (!allowed.includes(k)) errs.push({ path: "/", message: `must NOT have additional property '${k}'`, code: "additionalProperties" });
  if ("skuPrefix" in body) {
    const v = body["skuPrefix"];
    if (typeof v !== "string" || v.length < 1 || v.length > 32 || !/^[A-Z0-9-]{1,32}$/.test(v)) errs.push({ path: "/skuPrefix", message: "must match pattern ^[A-Z0-9-]{1,32}$", code: "pattern" });
  }
  if ("options" in body) {
    const o = body["options"] as Record<string, unknown>;
    if (typeof o !== "object" || o === null || Array.isArray(o)) errs.push({ path: "/options", message: "must be object", code: "type" });
    else {
      for (const k of Object.keys(o)) if (!["size","color"].includes(k)) errs.push({ path: "/options", message: `must NOT have additional property '${k}'`, code: "additionalProperties" });
      if ("size" in o && (typeof o["size"] !== "string" || (o["size"] as string).length < 1)) errs.push({ path: "/options/size", message: "must be string min 1", code: "minLength" });
      if ("color" in o && (typeof o["color"] !== "string" || (o["color"] as string).length < 1)) errs.push({ path: "/options/color", message: "must be string min 1", code: "minLength" });
    }
  }
  for (const k of ["maxPriceCents","minStock","maxStock","limit"] as const) if (k in body) {
    const v = body[k];
    if (typeof v !== "number" || !Number.isInteger(v as number) || (v as number) < 0) errs.push({ path: `/${k}`, message: "must be integer >=0", code: "type" });
  }
  if ("limit" in body) {
    const l = body["limit"] as number;
    if (l < 1 || l > 50) errs.push({ path: "/limit", message: "must be 1..50", code: "maximum" });
  }
  return errs;
}

function isLowStock(v: { stock: number; low_stock_threshold: number }): boolean { return v.stock <= v.low_stock_threshold; }
function variantBySku(catalog: ReturnType<typeof loadCatalog>, sku: string): { sku: string; title: string; options: { size: string; color: string }; price_cents: number; stock: number; low_stock_threshold: number } | null {
  for (const p of catalog.products) for (const v of p.variants) if (v.sku === sku) return v;
  return null;
}
function effectiveLimit(limit: number | undefined): number { const raw = limit ?? 25; const n = Number.isFinite(raw as number) ? Math.floor(raw as number) : 25; return Math.max(1, Math.min(100, n)); }

function filterVariants(catalog: ReturnType<typeof loadCatalog>, input: Record<string, unknown>, fromSkus?: string[]): { matches: unknown[]; total: number; applied: string[]; from_result_set: boolean } {
  const fromResultSet = Array.isArray(fromSkus) && fromSkus.length > 0;
  const candidates = fromResultSet ? (fromSkus as string[]).map(sku => variantBySku(catalog, sku)).filter((v): v is NonNullable<typeof v> => v !== null) : catalog.products.flatMap(p => p.variants);
  const applied: string[] = [];
  let cur = candidates;
  if (typeof input["skuPrefix"] === "string" && (input["skuPrefix"] as string).trim() !== "") {
    const pf = (input["skuPrefix"] as string).slice(0,32);
    applied.push(`sku starts with '${pf}'`);
    const low = pf.toLowerCase();
    cur = cur.filter(v => v.sku.toLowerCase().startsWith(low));
  }
  if ((input["options"] as Record<string, unknown>)?.["size"]) {
    const s = String((input["options"] as Record<string, string>)["size"]).toLowerCase();
    applied.push(`size = ${s}`);
    cur = cur.filter(v => v.options.size.toLowerCase() === s);
  }
  if ((input["options"] as Record<string, unknown>)?.["color"]) {
    const c = String((input["options"] as Record<string, string>)["color"]).toLowerCase();
    applied.push(`color = ${c}`);
    cur = cur.filter(v => v.options.color.toLowerCase() === c);
  }
  if (typeof input["maxPriceCents"] === "number") { applied.push(`price ≤ $${((input["maxPriceCents"] as number)/100).toFixed(2)}`); cur = cur.filter(v => v.price_cents <= (input["maxPriceCents"] as number)); }
  if (typeof input["minStock"] === "number") { applied.push(`stock ≥ ${input["minStock"]}`); cur = cur.filter(v => v.stock >= (input["minStock"] as number)); }
  if (typeof input["maxStock"] === "number") { applied.push(`stock ≤ ${input["maxStock"]}`); cur = cur.filter(v => v.stock <= (input["maxStock"] as number)); }
  cur.sort((a,b) => (Number(b.stock>0)-Number(a.stock>0)) || (a.price_cents-b.price_cents) || a.sku.localeCompare(b.sku));
  const total = cur.length;
  const lim = effectiveLimit(input["limit"] as number | undefined);
  const sliced = cur.slice(0, lim);
  const matches = sliced.map(v => ({ sku: v.sku, title: v.title, options: { ...v.options }, price_cents: v.price_cents, stock: v.stock, low_stock: isLowStock(v) }));
  return { matches, total, applied, from_result_set: fromResultSet };
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  withCors(res);
  if (!methodGuard(req, res, ["POST"])) return;
  try {
    const body = readJson(req) as Record<string, unknown> & { skus?: string[] };
    const { skus: skusRaw, ...filterInput } = body;
    const errors = validateFilter(filterInput);
    if (skusRaw !== undefined && (!Array.isArray(skusRaw) || skusRaw.some(s => typeof s !== "string"))) {
      badRequest(res, "skus must be an array of strings", { errors: [{ path: "/skus", message: "must be array of string", code: "type" }] } as never);
      return;
    }
    if (errors.length > 0) { badRequest(res, (errors[0]!.message ?? "INVALID_INPUT"), { errors } as never); return; }
    const catalog = loadCatalog();
    const output = filterVariants(catalog, filterInput as Record<string, unknown>, skusRaw as string[] | undefined);
    sendJson(res, 200, { ok: true, data: output });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("32 KB") || msg.includes("invalid JSON") || (err as never as { code?: string })?.code === "INVALID_INPUT") { badRequest(res, msg); return; }
    sendJson(res, 500, { ok: false, error: { code: "DEGRADED", message: msg } });
  }
}
