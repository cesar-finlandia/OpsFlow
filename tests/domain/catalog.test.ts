import { describe, it, expect } from "vitest";
import { loadCatalog, searchVariants, isLowStock } from "../../src/engine/domain/catalog.ts";
import type { Catalog } from "../../src/engine/types.ts";

describe("catalog", () => {
  const catalog = loadCatalog();
  const allVariants = catalog.products.flatMap((p) => p.variants);
  const variantCount = allVariants.length;

  it("empty query matches all variants", () => {
    const res = searchVariants(catalog, { query: "" });
    expect(res.total).toBe(variantCount);
    // with default limit 25, matches truncated unless variantCount <=25 (but 200 >25)
    expect(res.matches.length).toBe(Math.min(variantCount, 25));
    // without limit, using large limit we get all
    const resAll = searchVariants(catalog, { query: "", limit: 100 });
    expect(resAll.total).toBe(variantCount);
    expect(resAll.matches.length).toBe(Math.min(variantCount, 100));
    if (variantCount <= 100) expect(resAll.truncated).toBe(false);
  });

  it("whitespace-only query is trimmed to empty and matches all", () => {
    const res = searchVariants(catalog, { query: "   \t\n  " });
    expect(res.total).toBe(variantCount);
    expect(res.query_echo).toBe("   \t\n  ".slice(0, 200));
    // whitespace trimmed internally for terms
  });

  it("case-insensitive AND semantics", () => {
    // pick a known variant to test terms
    const sample = allVariants[0];
    const color = sample.options.color;
    const size = sample.options.size;
    // search by color lowercase vs uppercase should match same set
    const lower = searchVariants(catalog, { query: color.toLowerCase(), limit: 100 });
    const upper = searchVariants(catalog, { query: color.toUpperCase(), limit: 100 });
    expect(lower.total).toBe(upper.total);
    expect(lower.matches.map((m) => m.sku).sort()).toEqual(upper.matches.map((m) => m.sku).sort());
    // AND: two terms that individually match many but together match intersection
    const both = searchVariants(catalog, { query: `${color} ${size}`, limit: 100 });
    // every result must contain both terms in haystack
    expect(both.matches.length).toBeGreaterThan(0);
    // total should be <= each single term total
    const colorOnly = searchVariants(catalog, { query: color, limit: 100 });
    const sizeOnly = searchVariants(catalog, { query: size, limit: 100 });
    expect(both.total).toBeLessThanOrEqual(colorOnly.total);
    expect(both.total).toBeLessThanOrEqual(sizeOnly.total);
  });

  it("inStockOnly drops zero-stock", () => {
    const all = searchVariants(catalog, { query: "", limit: 100 });
    const inStock = searchVariants(catalog, { query: "", inStockOnly: true, limit: 100 });
    const zeroStockCount = allVariants.filter((v) => v.stock === 0).length;
    expect(zeroStockCount).toBeGreaterThan(0);
    expect(inStock.total).toBe(variantCount - zeroStockCount);
    expect(inStock.matches.every((m) => m.stock > 0)).toBe(true);
  });

  it("limit truncation + truncated flag", () => {
    const res = searchVariants(catalog, { query: "", limit: 5 });
    expect(res.matches.length).toBe(5);
    expect(res.truncated).toBe(true);
    expect(res.total).toBe(variantCount);
    const large = searchVariants(catalog, { query: "", limit: 200 });
    // capped at 100
    expect(large.matches.length).toBe(Math.min(variantCount, 100));
    expect(large.truncated).toBe(variantCount > 100);
  });

  it("query_echo truncation at 200", () => {
    const long = "a".repeat(500);
    const res = searchVariants(catalog, { query: long });
    expect(res.query_echo.length).toBe(200);
    expect(res.query_echo).toBe(long.slice(0, 200));
  });

  it("isLowStock boundary (stock===threshold is low)", () => {
    const atThreshold: any = { stock: 5, low_stock_threshold: 5 };
    const below: any = { stock: 4, low_stock_threshold: 5 };
    const above: any = { stock: 6, low_stock_threshold: 5 };
    expect(isLowStock(atThreshold)).toBe(true);
    expect(isLowStock(below)).toBe(true);
    expect(isLowStock(above)).toBe(false);
    // also test against real catalog variant where stock===threshold
    const eq = allVariants.find((v) => v.stock === v.low_stock_threshold);
    if (eq) expect(isLowStock(eq)).toBe(true);
  });

  it("determinism (same input yields same JSON)", () => {
    const input = { query: "blue", inStockOnly: false, limit: 10 };
    const a = searchVariants(catalog, input);
    const b = searchVariants(catalog, input);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    // also sort determinism: call twice with same catalog/input
    const c = searchVariants(catalog, { query: "" });
    const d = searchVariants(catalog, { query: "" });
    expect(JSON.stringify(c)).toBe(JSON.stringify(d));
  });

  it("never-throw for null/empty inputs", () => {
    expect(() => searchVariants(catalog, { query: "" } as any)).not.toThrow();
    expect(() => searchVariants(catalog, { query: null as any } as any)).not.toThrow();
    expect(() => searchVariants(catalog, { query: undefined as any } as any)).not.toThrow();
    expect(() => searchVariants({ products: [] } as unknown as Catalog, { query: "test" })).not.toThrow();
    expect(() => searchVariants(catalog, null as any)).not.toThrow();
    const r1 = searchVariants(catalog, { query: null as any } as any);
    expect(r1.query_echo).toBe("");
    const r2 = searchVariants({ products: [] } as any, { query: "" });
    expect(r2.matches).toEqual([]);
    expect(r2.total).toBe(0);
    expect(r2.truncated).toBe(false);
  });
});
