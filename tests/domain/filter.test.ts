import { describe, it, expect } from "vitest";
import { loadCatalog, isLowStock } from "../../src/engine/domain/catalog.ts";
import { filterVariants } from "../../src/engine/domain/filter.ts";

describe("filter", () => {
  const catalog = loadCatalog();
  const allVariants = catalog.products.flatMap((p) => p.variants);

  it("no fromSkus => from_result_set false and scans all variants", () => {
    const res = filterVariants(catalog, {});
    expect(res.from_result_set).toBe(false);
    expect(res.total).toBe(allVariants.length);
  });

  it("with fromSkus => only those SKUs and from_result_set true", () => {
    const two = allVariants.slice(0, 2).map((v) => v.sku);
    const res = filterVariants(catalog, {}, two);
    expect(res.from_result_set).toBe(true);
    expect(res.total).toBe(2);
    const skus = res.matches.map((m) => m.sku);
    expect(skus).toEqual(expect.arrayContaining(two));
    expect(res.matches.length).toBe(2);
  });

  it("empty [] as no constraint behaves like undefined (all variants)", () => {
    const resUndefined = filterVariants(catalog, {});
    const resEmpty = filterVariants(catalog, {}, []);
    expect(resEmpty.from_result_set).toBe(false);
    expect(resEmpty.total).toBe(resUndefined.total);
  });

  it("skuPrefix filter isolation", () => {
    const prefix = allVariants[0].sku.slice(0, 6); // e.g. OPS-10
    const res = filterVariants(catalog, { skuPrefix: prefix });
    expect(res.applied[0]).toContain("sku starts with");
    expect(res.matches.every((m) => m.sku.toLowerCase().startsWith(prefix.toLowerCase()))).toBe(true);
    expect(res.total).toBeGreaterThan(0);
  });

  it("size filter isolation (case-insensitive)", () => {
    const size = allVariants.find((v) => v.options.size)?.options.size ?? "M";
    const res = filterVariants(catalog, { options: { size } });
    expect(res.applied).toEqual(expect.arrayContaining([`size = ${size}`]));
    expect(res.matches.every((m) => m.options.size.toLowerCase() === size.toLowerCase())).toBe(true);
    // case-insensitive check
    const upper = filterVariants(catalog, { options: { size: size.toUpperCase() } });
    expect(upper.total).toBe(res.total);
  });

  it("color filter isolation", () => {
    const color = allVariants.find((v) => v.options.color)?.options.color ?? "Black";
    const res = filterVariants(catalog, { options: { color } });
    expect(res.applied).toEqual(expect.arrayContaining([`color = ${color}`]));
    expect(res.matches.every((m) => m.options.color.toLowerCase() === color.toLowerCase())).toBe(true);
  });

  it("maxPriceCents isolation", () => {
    const res = filterVariants(catalog, { maxPriceCents: 1200 });
    expect(res.applied[0]).toContain("price");
    expect(res.matches.every((m) => m.price_cents <= 1200)).toBe(true);
  });

  it("minStock isolation", () => {
    const res = filterVariants(catalog, { minStock: 1 });
    expect(res.applied[0]).toContain("stock");
    expect(res.matches.every((m) => m.stock >= 1)).toBe(true);
    // should exclude stock 0
    const zeroCount = allVariants.filter((v) => v.stock === 0).length;
    expect(res.total).toBe(allVariants.length - zeroCount);
  });

  it("maxStock isolation", () => {
    const res = filterVariants(catalog, { maxStock: 5 });
    expect(res.applied[0]).toContain("stock");
    expect(res.matches.every((m) => m.stock <= 5)).toBe(true);
  });

  it("combined filters AND", () => {
    const color = allVariants[0].options.color;
    const res = filterVariants(catalog, { options: { color }, maxPriceCents: 2000, maxStock: 10 });
    expect(res.matches.every((m) => m.options.color.toLowerCase() === color.toLowerCase())).toBe(true);
    expect(res.matches.every((m) => m.price_cents <= 2000)).toBe(true);
    expect(res.matches.every((m) => m.stock <= 10)).toBe(true);
  });

  it("applied[] sentences correct order", () => {
    const res = filterVariants(catalog, {
      skuPrefix: "OPS-",
      options: { size: "M", color: "Black" },
      maxPriceCents: 1500,
      minStock: 1,
      maxStock: 10,
    });
    // order is skuPrefix, size, color, maxPrice, minStock, maxStock
    expect(res.applied).toEqual([
      "sku starts with 'OPS-'",
      "size = M",
      "color = Black",
      "price \u2264 $15.00",
      "stock \u2265 1",
      "stock \u2264 10",
    ]);
    // if no filter, applied empty
    const none = filterVariants(catalog, {});
    expect(none.applied).toEqual([]);
  });

  it("unknown fromSkus silently skipped", () => {
    const known = allVariants[0].sku;
    const res = filterVariants(catalog, {}, [known, "UNKNOWN-SKU-999"]);
    expect(res.from_result_set).toBe(true);
    expect(res.total).toBe(1);
    expect(res.matches[0].sku).toBe(known);
  });
});
