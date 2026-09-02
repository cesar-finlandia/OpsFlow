import type { Catalog, Variant, Product, SearchInventoryInput, SearchInventoryOutput, VariantMatch } from "../types.ts";
import { loadConfig } from "../config.ts";
// @ts-ignore — JSON import with NodeNext requires resolveJsonModule; Vite handles it without attribute
import rawCatalog from "../../../data/catalog.json";

let cachedCatalog: Catalog | null = null;

export function loadCatalog(): Catalog {
  if (cachedCatalog) return cachedCatalog;
  try {
    if (rawCatalog && typeof rawCatalog === "object" && Array.isArray((rawCatalog as Catalog).products)) {
      cachedCatalog = rawCatalog as unknown as Catalog;
      return cachedCatalog;
    }
    throw new Error("invalid catalog import");
  } catch {
    const fallback: Catalog = { version: "1.0.0", generated_at: new Date().toISOString(), synthetic: true, products: [] };
    cachedCatalog = fallback;
    return cachedCatalog;
  }
}

export function isLowStock(v: Variant): boolean {
  return v.stock <= v.low_stock_threshold;
}

export function variantBySku(c: Catalog, sku: string): Variant | null {
  try {
    for (const p of c.products) for (const v of p.variants) if (v.sku === sku) return v;
    return null;
  } catch {
    return null;
  }
}

// private to DP-DOM — do not import
export function buildHaystack(product: Product, variant: Variant): string {
  return [product.title, product.brand, product.category, variant.title, variant.sku, variant.options.size, variant.options.color].join(" ").toLowerCase();
}

// private to DP-DOM — do not import
export function parseQuery(q: string): string[] {
  const truncated = q.slice(0, 200);
  const lower = truncated.toLowerCase().trim();
  if (lower === "" || lower === "*" || lower === "all") return [];
  return lower.split(/\s+/).filter(Boolean);
}

// private to DP-DOM — do not import
export function effectiveLimit(limit: number | undefined, defaultLimit?: number): number {
  let def = defaultLimit;
  if (def === undefined) {
    try {
      def = loadConfig().tools.default_limit;
    } catch {
      def = 25;
    }
  }
  const raw = limit ?? def;
  const n = Number.isFinite(raw as number) ? Math.floor(raw as number) : (def as number);
  return Math.max(1, Math.min(100, n));
}

export function searchVariants(c: Catalog, i: SearchInventoryInput): SearchInventoryOutput {
  try {
    const query_echo = (i.query ?? "").slice(0, 200);
    const terms = parseQuery(query_echo);
    const survivors: Array<{ product: Product; variant: Variant }> = [];
    for (const product of c.products ?? []) {
      for (const variant of product.variants ?? []) {
        const haystack = buildHaystack(product, variant);
        let matches = true;
        if (terms.length > 0) {
          for (const term of terms) {
            if (!haystack.includes(term)) { matches = false; break; }
          }
        }
        if (!matches) continue;
        if (i.inStockOnly === true && variant.stock === 0) continue;
        survivors.push({ product, variant });
      }
    }
    survivors.sort((a, b) => {
      const aIn = a.variant.stock > 0 ? 1 : 0;
      const bIn = b.variant.stock > 0 ? 1 : 0;
      if (bIn !== aIn) return bIn - aIn;
      if (a.variant.price_cents !== b.variant.price_cents) return a.variant.price_cents - b.variant.price_cents;
      return a.variant.sku.localeCompare(b.variant.sku);
    });
    const total = survivors.length;
    const lim = effectiveLimit(i.limit);
    const sliced = survivors.slice(0, lim);
    const matches: VariantMatch[] = sliced.map(({ variant: v }) => ({
      sku: v.sku,
      title: v.title,
      options: { ...v.options },
      price_cents: v.price_cents,
      stock: v.stock,
      low_stock: isLowStock(v),
    }));
    const truncated = total > matches.length;
    return { matches, total, truncated, query_echo };
  } catch {
    const query_echo = (i?.query ?? "").slice(0, 200);
    return { matches: [], total: 0, truncated: false, query_echo };
  }
}
