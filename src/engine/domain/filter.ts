import type { Catalog, FilterVariantsInput, FilterVariantsOutput, Variant, VariantMatch } from "../types.ts";
import { loadConfig } from "../config.ts";
import { variantBySku, isLowStock } from "./catalog.ts";

// private to DP-DOM — do not import
function effectiveLimit(limit: number | undefined): number {
  let def = 25;
  try {
    def = loadConfig().tools.default_limit;
  } catch {}
  const raw = limit ?? def;
  const n = Number.isFinite(raw as number) ? Math.floor(raw as number) : def;
  return Math.max(1, Math.min(100, n));
}

export function filterVariants(c: Catalog, i: FilterVariantsInput, fromSkus?: string[]): FilterVariantsOutput {
  try {
    const fromResultSet = Array.isArray(fromSkus) && fromSkus.length > 0;
    const candidates: Variant[] = fromResultSet
      ? (fromSkus as string[]).map((sku) => variantBySku(c, sku)).filter((v): v is Variant => v !== null)
      : c.products.flatMap((p) => p.variants);
    const applied: string[] = [];
    let cur = candidates;
    if (typeof i.skuPrefix === "string" && i.skuPrefix.trim() !== "") {
      const pf = i.skuPrefix.slice(0, 32);
      applied.push(`sku starts with '${pf}'`);
      const low = pf.toLowerCase();
      cur = cur.filter((v) => v.sku.toLowerCase().startsWith(low));
    }
    if (i.options?.size !== undefined && i.options.size !== null && String(i.options.size).trim() !== "") {
      const sizeVal = String(i.options.size);
      applied.push(`size = ${sizeVal}`);
      const s = sizeVal.toLowerCase();
      cur = cur.filter((v) => v.options.size.toLowerCase() === s);
    }
    if (i.options?.color !== undefined && i.options.color !== null && String(i.options.color).trim() !== "") {
      const colorVal = String(i.options.color);
      applied.push(`color = ${colorVal}`);
      const cc = colorVal.toLowerCase();
      cur = cur.filter((v) => v.options.color.toLowerCase() === cc);
    }
    if (typeof i.maxPriceCents === "number" && Number.isFinite(i.maxPriceCents)) {
      applied.push(`price \u2264 $${(i.maxPriceCents / 100).toFixed(2)}`);
      cur = cur.filter((v) => v.price_cents <= i.maxPriceCents!);
    }
    if (typeof i.minStock === "number" && Number.isFinite(i.minStock)) {
      applied.push(`stock \u2265 ${i.minStock}`);
      cur = cur.filter((v) => v.stock >= i.minStock!);
    }
    if (typeof i.maxStock === "number" && Number.isFinite(i.maxStock)) {
      applied.push(`stock \u2264 ${i.maxStock}`);
      cur = cur.filter((v) => v.stock <= i.maxStock!);
    }
    cur.sort((a, b) => (Number(b.stock > 0) - Number(a.stock > 0)) || (a.price_cents - b.price_cents) || a.sku.localeCompare(b.sku));
    const total = cur.length;
    const lim = effectiveLimit(i.limit);
    const sliced = cur.slice(0, lim);
    const matches: VariantMatch[] = sliced.map((v) => ({
      sku: v.sku,
      title: v.title,
      options: { ...v.options },
      price_cents: v.price_cents,
      stock: v.stock,
      low_stock: isLowStock(v),
    }));
    return { matches, total, applied, from_result_set: fromResultSet };
  } catch {
    const fromResultSet = Array.isArray(fromSkus) && (fromSkus as string[]).length > 0;
    return { matches: [], total: 0, applied: [], from_result_set: fromResultSet };
  }
}
