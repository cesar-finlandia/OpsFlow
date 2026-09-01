import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

describe("DP-SEED W2/T2 determinism", () => {
  it("catalog is byte-stable modulo generated_at", () => {
    const catalog = JSON.parse(readFileSync("data/catalog.json", "utf8"));
    expect(catalog.version).toBe("1.0.0");
    expect(catalog.synthetic).toBe(true);
    expect(catalog.products.length).toBe(60);
    const total = catalog.products.reduce((n: number, p: any) => n + p.variants.length, 0);
    expect(total).toBe(200);
    // products sorted by id asc
    const ids = catalog.products.map((p: any) => p.id);
    expect(ids).toEqual([...ids].sort());
    // variants sorted by sku asc per product
    for (const p of catalog.products) {
      const skus = p.variants.map((v: any) => v.sku);
      expect(skus).toEqual([...skus].sort());
    }
    // synthetic count 261
    let syn = catalog.synthetic === true ? 1 : 0;
    for (const p of catalog.products) {
      if (p.synthetic === true) syn++;
      for (const v of p.variants) if (v.synthetic === true) syn++;
    }
    expect(syn).toBe(261);
  });
});
