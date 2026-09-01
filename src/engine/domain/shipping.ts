import type { Catalog, ShippingQuote, CalculateShippingInput, Surcharge, ServiceLevel, ShippingZone } from "../types.ts";
import { variantBySku } from "./catalog.ts";
// @ts-ignore — JSON import with NodeNext requires resolveJsonModule; Vite handles it without attribute
import rawZones from "../../../data/zones.json";
// ZoneTable + loadZones + quoteShipping — DP-DOM §5.3

export interface ZoneTable {
  version: string;
  synthetic: true;
  zones: Record<"1"|"2"|"3"|"4"|"5", { base_cents: number; per_100g_cents: number; service_multiplier: Record<ServiceLevel, number> }>;
  surcharges: Surcharge[];
}

const DEFAULT_ZONES: ZoneTable = {
  version: "1.0.0",
  synthetic: true,
  zones: {
    "1": { base_cents: 500, per_100g_cents: 50, service_multiplier: { ground: 1, expedited: 1.6, overnight: 2.4 } },
    "2": { base_cents: 650, per_100g_cents: 60, service_multiplier: { ground: 1, expedited: 1.6, overnight: 2.4 } },
    "3": { base_cents: 800, per_100g_cents: 75, service_multiplier: { ground: 1, expedited: 1.7, overnight: 2.6 } },
    "4": { base_cents: 1100, per_100g_cents: 95, service_multiplier: { ground: 1, expedited: 1.8, overnight: 2.8 } },
    "5": { base_cents: 1400, per_100g_cents: 120, service_multiplier: { ground: 1, expedited: 1.9, overnight: 3.0 } },
  },
  surcharges: [
    { code: "OVERSIZE", label: "Oversize — total weight exceeds 10 kg", amount_cents: 800 },
    { code: "REMOTE", label: "Remote zone (zones 4-5)", amount_cents: 600 },
    { code: "EXPEDITED_FUEL", label: "Expedited fuel surcharge", amount_cents: 450 },
    { code: "LOW_VALUE", label: "Low order value handling", amount_cents: 250 },
  ],
};

let cachedZones: ZoneTable | null = null;

export function loadZones(): ZoneTable {
  if (cachedZones) return cachedZones;
  try {
    if (rawZones && typeof rawZones === "object" && (rawZones as ZoneTable).zones && Array.isArray((rawZones as ZoneTable).surcharges)) {
      const rz = rawZones as unknown as ZoneTable;
      // validate zones keys 1-5 present, fallback to defaults if shape invalid
      const hasAllZones = ["1","2","3","4","5"].every(k => (rz.zones as Record<string, unknown>)[k] !== undefined);
      if (hasAllZones && typeof rz.version === "string" && rz.synthetic === true) {
        cachedZones = rz;
        return cachedZones;
      }
    }
    throw new Error("invalid zones import");
  } catch {
    cachedZones = DEFAULT_ZONES;
    return cachedZones;
  }
}

export function quoteShipping(c: Catalog, z: ZoneTable, i: CalculateShippingInput): ShippingQuote {
  try {
    let total_weight_g = 0;
    let subtotal_cents = 0;
    const excluded: Array<{ sku: string; reason: string }> = [];
    const surcharges: Surcharge[] = [];
    const explain: string[] = [];
    const validItems: Array<{ sku: string; qty: number }> = [];

    const items = (i && Array.isArray((i as CalculateShippingInput).items)) ? (i as CalculateShippingInput).items : [];

    for (const item of items) {
      const sku = (item as { sku?: unknown })?.sku as string;
      const qty = (item as { qty?: unknown })?.qty as number;
      const v = variantBySku(c, sku);
      if (!v) {
        excluded.push({ sku: String(sku ?? ""), reason: "unknown sku" });
        continue;
      }
      if (!Number.isInteger(qty) || qty < 1 || qty > 999) {
        excluded.push({ sku: String(sku), reason: "invalid quantity" });
        continue;
      }
      if (qty > v.stock) {
        excluded.push({ sku: String(sku), reason: `insufficient stock (have ${v.stock})` });
        continue;
      }
      total_weight_g += v.weight_g * qty;
      subtotal_cents += v.price_cents * qty;
      validItems.push({ sku: String(sku), qty });
    }

    if (validItems.length === 0) {
      return {
        zone: i.zone,
        service: i.service,
        items: [],
        total_weight_g: 0,
        subtotal_cents: 0,
        base_rate_cents: 0,
        surcharges: [],
        total_cents: 0,
        explain: ["No items to rate."],
        excluded,
      };
    }

    const zoneKey = String(i.zone) as keyof ZoneTable["zones"];
    const zoneEntry = (z.zones as Record<string, { base_cents: number; per_100g_cents: number; service_multiplier: Record<ServiceLevel, number> }>)[zoneKey] ?? z.zones["1"];

    let base_rate_cents = zoneEntry.base_cents + Math.ceil(total_weight_g / 100) * zoneEntry.per_100g_cents;
    const mult = zoneEntry.service_multiplier[i.service] ?? 1;
    base_rate_cents = Math.round(base_rate_cents * mult);

    explain.push(`Zone ${i.zone} base $${(zoneEntry.base_cents / 100).toFixed(2)} + ${Math.ceil(total_weight_g / 100)}x$${(zoneEntry.per_100g_cents / 100).toFixed(2)} per 100g`);
    if (i.service !== "ground") {
      explain.push(`Service ${i.service} x${mult} -> $${(base_rate_cents / 100).toFixed(2)}`);
    }

    for (const s of z.surcharges) {
      let hit = false;
      if (s.code === "OVERSIZE") hit = total_weight_g > 10000;
      else if (s.code === "REMOTE") hit = i.zone >= 4;
      else if (s.code === "EXPEDITED_FUEL") hit = i.service !== "ground";
      else if (s.code === "LOW_VALUE") hit = subtotal_cents < 2000;
      else hit = true;
      if (hit) {
        surcharges.push({ ...s });
        explain.push(`${s.code} ${s.label} +$${(s.amount_cents / 100).toFixed(2)}`);
      }
    }

    const total_cents = base_rate_cents + surcharges.reduce((a, b) => a + b.amount_cents, 0);
    explain.push(`Total $${(total_cents / 100).toFixed(2)} for ${total_weight_g}g`);

    return {
      zone: i.zone,
      service: i.service,
      items: validItems,
      total_weight_g,
      subtotal_cents,
      base_rate_cents,
      surcharges,
      total_cents,
      explain: explain.slice(0, 12),
      excluded,
    };
  } catch {
    // Never throw — return zero quote fallback
    try {
      return {
        zone: (i as CalculateShippingInput)?.zone ?? 1 as ShippingZone,
        service: (i as CalculateShippingInput)?.service ?? "ground" as ServiceLevel,
        items: [],
        total_weight_g: 0,
        subtotal_cents: 0,
        base_rate_cents: 0,
        surcharges: [],
        total_cents: 0,
        explain: ["No items to rate."],
        excluded: [],
      };
    } catch {
      return {
        zone: 1,
        service: "ground",
        items: [],
        total_weight_g: 0,
        subtotal_cents: 0,
        base_rate_cents: 0,
        surcharges: [],
        total_cents: 0,
        explain: ["No items to rate."],
        excluded: [],
      };
    }
  }
}
