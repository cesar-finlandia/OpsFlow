import type { VercelRequest, VercelResponse } from "@vercel/node";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { readJson, sendJson, badRequest, withCors, methodGuard } from "../_shared.js";

function loadCatalog(): { products: Array<{ variants: Array<{ sku: string; title: string; price_cents: number; stock: number; weight_g: number }> }> } {
  try { const raw = readFileSync(join(process.cwd(), "data/catalog.json"), "utf8"); return JSON.parse(raw) as never; } catch {}
  try { const raw2 = readFileSync(join(process.cwd(), "hackathon-entries/2026-09-webMCP/data/catalog.json"), "utf8"); return JSON.parse(raw2) as never; } catch {}
  return { products: [] as never };
}
function loadZones(): { zones: Record<string, { base_cents: number; per_100g_cents: number; service_multiplier: Record<string, number> }>; surcharges: Array<{ code: string; label: string; amount_cents: number }> } {
  try { const raw = readFileSync(join(process.cwd(), "data/zones.json"), "utf8"); return JSON.parse(raw) as never; } catch {}
  try { const raw2 = readFileSync(join(process.cwd(), "hackathon-entries/2026-09-webMCP/data/zones.json"), "utf8"); return JSON.parse(raw2) as never; } catch {}
  return { zones: { "1": { base_cents: 500, per_100g_cents: 50, service_multiplier: { ground: 1, expedited: 1.6, overnight: 2.4 } }, "2": { base_cents: 650, per_100g_cents: 60, service_multiplier: { ground: 1, expedited: 1.6, overnight: 2.4 } }, "3": { base_cents: 800, per_100g_cents: 75, service_multiplier: { ground: 1, expedited: 1.7, overnight: 2.6 } }, "4": { base_cents: 1100, per_100g_cents: 95, service_multiplier: { ground: 1, expedited: 1.8, overnight: 2.8 } }, "5": { base_cents: 1400, per_100g_cents: 120, service_multiplier: { ground: 1, expedited: 1.9, overnight: 3.0 } } }, surcharges: [{ code: "OVERSIZE", label: "Oversize — total weight exceeds 10 kg", amount_cents: 800 }, { code: "REMOTE", label: "Remote zone (zones 4-5)", amount_cents: 600 }, { code: "EXPEDITED_FUEL", label: "Expedited fuel surcharge", amount_cents: 450 }, { code: "LOW_VALUE", label: "Low order value handling", amount_cents: 250 }] } as never;
}

function validateQuote(body: Record<string, unknown>): Array<{ message: string; path: string; code: string }> {
  const errs: Array<{ message: string; path: string; code: string }> = [];
  if (!("items" in body)) errs.push({ path: "/items", message: "must have required property 'items'", code: "required" });
  else {
    const items = body["items"];
    if (!Array.isArray(items)) errs.push({ path: "/items", message: "must be array", code: "type" });
    else if (items.length < 1) errs.push({ path: "/items", message: "must NOT have fewer than 1 items", code: "minItems" });
    else if (items.length > 50) errs.push({ path: "/items", message: "must NOT have more than 50 items", code: "maxItems" });
    else for (let i=0;i<items.length;i++) {
      const it = items[i] as Record<string, unknown>;
      if (!it || typeof it !== "object") errs.push({ path: `/items/${i}`, message: "must be object", code: "type" });
      else {
        if (!("sku" in it) || typeof it["sku"] !== "string" || !/^[A-Z0-9-]{6,32}$/.test(it["sku"] as string)) errs.push({ path: `/items/${i}/sku`, message: "must match pattern ^[A-Z0-9-]{6,32}$", code: "pattern" });
        if (!("qty" in it) || typeof it["qty"] !== "number" || !Number.isInteger(it["qty"] as number) || (it["qty"] as number) < 1 || (it["qty"] as number) > 999) errs.push({ path: `/items/${i}/qty`, message: "must be integer 1..999", code: "type" });
      }
    }
  }
  if (!("zone" in body) || typeof body["zone"] !== "number" || ![1,2,3,4,5].includes(body["zone"] as number)) errs.push({ path: "/zone", message: "must be equal to one of the allowed values: 1,2,3,4,5", code: "enum" });
  if (!("service" in body) || typeof body["service"] !== "string" || !["ground","expedited","overnight"].includes(body["service"] as string)) errs.push({ path: "/service", message: "must be equal to one of the allowed values", code: "enum" });
  const allowed = ["items","zone","service"];
  for (const k of Object.keys(body)) if (!allowed.includes(k)) errs.push({ path: "/", message: `must NOT have additional property '${k}'`, code: "additionalProperties" });
  return errs;
}

function variantBySku(catalog: ReturnType<typeof loadCatalog>, sku: string): { sku: string; weight_g: number; price_cents: number; stock: number } | null {
  for (const p of catalog.products) for (const v of p.variants) if (v.sku === sku) return v as never;
  return null;
}

function quoteShipping(catalog: ReturnType<typeof loadCatalog>, zones: ReturnType<typeof loadZones>, input: { items: Array<{ sku: string; qty: number }>; zone: number; service: string }): { zone: number; service: string; items: unknown[]; total_weight_g: number; subtotal_cents: number; base_rate_cents: number; surcharges: unknown[]; total_cents: number; explain: string[]; excluded: unknown[] } {
  let total_weight_g = 0; let subtotal_cents = 0; const excluded: Array<{ sku: string; reason: string }> = []; const surcharges: Array<{ code: string; label: string; amount_cents: number }> = []; const explain: string[] = []; const validItems: Array<{ sku: string; qty: number }> = [];
  for (const item of input.items ?? []) {
    const v = variantBySku(catalog, item.sku);
    if (!v) { excluded.push({ sku: String(item.sku ?? ""), reason: "unknown sku" }); continue; }
    if (!Number.isInteger(item.qty) || item.qty < 1 || item.qty > 999) { excluded.push({ sku: String(item.sku), reason: "invalid quantity" }); continue; }
    if (item.qty > v.stock) { excluded.push({ sku: String(item.sku), reason: `insufficient stock (have ${v.stock})` }); continue; }
    total_weight_g += v.weight_g * item.qty; subtotal_cents += v.price_cents * item.qty; validItems.push({ sku: String(item.sku), qty: item.qty });
  }
  if (validItems.length === 0) return { zone: input.zone, service: input.service, items: [], total_weight_g: 0, subtotal_cents: 0, base_rate_cents: 0, surcharges: [], total_cents: 0, explain: ["No items to rate."], excluded };
  const zoneKey = String(input.zone);
  const zoneEntry = (zones.zones as Record<string, { base_cents: number; per_100g_cents: number; service_multiplier: Record<string, number> }>)[zoneKey] ?? zones.zones["1"]!;
  let base_rate_cents = zoneEntry!.base_cents + Math.ceil(total_weight_g/100) * zoneEntry!.per_100g_cents;
  const mult = zoneEntry!.service_multiplier[input.service] ?? 1;
  base_rate_cents = Math.round(base_rate_cents * mult);
  explain.push(`Zone ${input.zone} base $${(zoneEntry!.base_cents/100).toFixed(2)} + ${Math.ceil(total_weight_g/100)}x$${(zoneEntry!.per_100g_cents/100).toFixed(2)} per 100g`);
  if (input.service !== "ground") explain.push(`Service ${input.service} x${mult} -> $${(base_rate_cents/100).toFixed(2)}`);
  for (const s of zones.surcharges) {
    let hit = false;
    if (s.code === "OVERSIZE") hit = total_weight_g > 10000;
    else if (s.code === "REMOTE") hit = input.zone >= 4;
    else if (s.code === "EXPEDITED_FUEL") hit = input.service !== "ground";
    else if (s.code === "LOW_VALUE") hit = subtotal_cents < 2000;
    else hit = true;
    if (hit) { surcharges.push({ ...s }); explain.push(`${s.code} ${s.label} +$${(s.amount_cents/100).toFixed(2)}`); }
  }
  const total_cents = base_rate_cents + surcharges.reduce((a,b)=>a+b.amount_cents,0);
  explain.push(`Total $${(total_cents/100).toFixed(2)} for ${total_weight_g}g`);
  return { zone: input.zone, service: input.service, items: validItems, total_weight_g, subtotal_cents, base_rate_cents, surcharges, total_cents, explain: explain.slice(0,12), excluded };
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  withCors(res);
  if (!methodGuard(req, res, ["POST"])) return;
  try {
    const body = readJson(req) as Record<string, unknown>;
    const errors = validateQuote(body);
    if (errors.length > 0) { badRequest(res, (errors[0]!.message ?? "INVALID_INPUT"), { errors } as never); return; }
    const catalog = loadCatalog();
    const zones = loadZones();
    const output = quoteShipping(catalog, zones, body as never);
    sendJson(res, 200, { ok: true, data: output });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("32 KB") || msg.includes("invalid JSON") || (err as never as { code?: string })?.code === "INVALID_INPUT") { badRequest(res, msg); return; }
    sendJson(res, 500, { ok: false, error: { code: "DEGRADED", message: msg } });
  }
}
