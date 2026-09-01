import { describe, it, expect } from "vitest";
import { loadCatalog } from "../../src/engine/domain/catalog.ts";
import { loadZones, quoteShipping, type ZoneTable } from "../../src/engine/domain/shipping.ts";

describe("shipping", () => {
  const catalog = loadCatalog();
  const zones = loadZones();
  const variant = catalog.products.flatMap((p) => p.variants).find((v) => v.stock > 0)!;
  const zeroStockVariant = catalog.products.flatMap((p) => p.variants).find((v) => v.stock === 0);

  it("single valid item base+multiplier correct", () => {
    const q = quoteShipping(catalog, zones, { items: [{ sku: variant.sku, qty: 1 }], zone: 1, service: "ground" });
    // base = base_cents + ceil(weight/100)*per100
    const ze = zones.zones["1"];
    const expectedBase = ze.base_cents + Math.ceil(variant.weight_g / 100) * ze.per_100g_cents;
    // ground multiplier is 1
    expect(q.base_rate_cents).toBe(expectedBase);
    expect(q.subtotal_cents).toBe(variant.price_cents);
    expect(q.total_weight_g).toBe(variant.weight_g);
    expect(q.excluded.length).toBe(0);
  });

  it("zone 4 triggers REMOTE surcharge", () => {
    const q = quoteShipping(catalog, zones, { items: [{ sku: variant.sku, qty: 1 }], zone: 4, service: "ground" });
    const hasRemote = q.surcharges.some((s) => s.code === "REMOTE");
    expect(hasRemote).toBe(true);
    // zone 1 should not have REMOTE (if spec zone>=4, zone1 not remote)
    const q1 = quoteShipping(catalog, zones, { items: [{ sku: variant.sku, qty: 1 }], zone: 1, service: "ground" });
    expect(q1.surcharges.some((s) => s.code === "REMOTE")).toBe(false);
  });

  it("weight>10000 triggers OVERSIZE", () => {
    // use a heavy variant or qty to exceed 10kg
    const heavy = catalog.products.flatMap((p) => p.variants).reduce((max, v) => (v.weight_g > max.weight_g ? v : max), variant);
    // calculate qty needed to exceed 10000
    const qty = Math.ceil(10001 / heavy.weight_g);
    const clampedQty = Math.min(qty, heavy.stock > 0 ? heavy.stock : 1);
    // if heavy stock insufficient, try with multiple items via same sku repeated? But API is per line item qty
    // ensure we exceed threshold: use a variant with large weight and enough stock, or use custom ZoneTable test separately
    const q = quoteShipping(catalog, zones, { items: [{ sku: heavy.sku, qty: clampedQty }], zone: 1, service: "ground" });
    if (heavy.weight_g * clampedQty > 10000) {
      expect(q.surcharges.some((s) => s.code === "OVERSIZE")).toBe(true);
    } else {
      // fallback: craft a fake catalog with heavy weight to guarantee oversize
      const fakeCatalog: any = {
        version: "1.0.0",
        synthetic: true,
        products: [
          {
            id: "P",
            title: "Fake",
            brand: "Fake",
            category: "Fake",
            synthetic: true,
            variants: [{ sku: "HEAVY-001", product_id: "P", title: "Heavy", options: { size: "M", color: "red" }, price_cents: 5000, stock: 100, weight_g: 6000, low_stock_threshold: 5, synthetic: true }],
          },
        ],
      };
      const q2 = quoteShipping(fakeCatalog, zones, { items: [{ sku: "HEAVY-001", qty: 2 }], zone: 1, service: "ground" });
      expect(q2.total_weight_g).toBe(12000);
      expect(q2.surcharges.some((s) => s.code === "OVERSIZE")).toBe(true);
    }
  });

  it("non-ground triggers EXPEDITED_FUEL", () => {
    const qGround = quoteShipping(catalog, zones, { items: [{ sku: variant.sku, qty: 1 }], zone: 1, service: "ground" });
    const qExp = quoteShipping(catalog, zones, { items: [{ sku: variant.sku, qty: 1 }], zone: 1, service: "expedited" });
    expect(qGround.surcharges.some((s) => s.code === "EXPEDITED_FUEL")).toBe(false);
    expect(qExp.surcharges.some((s) => s.code === "EXPEDITED_FUEL")).toBe(true);
    // multiplier effect: base should be multiplied
    const ze = zones.zones["1"];
    const baseUnmult = ze.base_cents + Math.ceil(variant.weight_g / 100) * ze.per_100g_cents;
    const expectedExpBase = Math.round(baseUnmult * ze.service_multiplier.expedited);
    expect(qExp.base_rate_cents).toBe(expectedExpBase);
  });

  it("subtotal<2000 triggers LOW_VALUE when present in zones", () => {
    // Build a custom ZoneTable with LOW_VALUE to ensure logic works regardless of file content
    const customZones: ZoneTable = {
      version: "1.0.0",
      synthetic: true,
      zones: zones.zones,
      surcharges: [
        ...zones.surcharges,
        { code: "LOW_VALUE", label: "Low order value handling", amount_cents: 250 },
      ],
    };
    // find cheap variant with price <2000
    const cheap = catalog.products.flatMap((p) => p.variants).find((v) => v.price_cents < 2000 && v.stock > 0) ?? variant;
    const qLow = quoteShipping(catalog, customZones, { items: [{ sku: cheap.sku, qty: 1 }], zone: 1, service: "ground" });
    if (cheap.price_cents < 2000) {
      expect(qLow.surcharges.some((s) => s.code === "LOW_VALUE")).toBe(true);
    }
    // expensive should not trigger LOW_VALUE
    const exp = catalog.products.flatMap((p) => p.variants).find((v) => v.price_cents >= 2000 && v.stock > 0);
    if (exp) {
      const qHigh = quoteShipping(catalog, customZones, { items: [{ sku: exp.sku, qty: 1 }], zone: 1, service: "ground" });
      // may need qty to keep subtotal above 2000
      if (exp.price_cents >= 2000) expect(qHigh.surcharges.some((s) => s.code === "LOW_VALUE")).toBe(false);
    }
  });

  it("unknown sku excluded with reason unknown sku", () => {
    const q = quoteShipping(catalog, zones, { items: [{ sku: "UNKNOWN-XYZ", qty: 1 }], zone: 1, service: "ground" });
    expect(q.excluded.some((e) => e.sku === "UNKNOWN-XYZ" && e.reason === "unknown sku")).toBe(true);
    expect(q.items.length).toBe(0);
  });

  it("qty 0 and 1000 are invalid quantity", () => {
    const q0 = quoteShipping(catalog, zones, { items: [{ sku: variant.sku, qty: 0 }], zone: 1, service: "ground" });
    expect(q0.excluded.some((e) => e.reason === "invalid quantity")).toBe(true);
    const q1000 = quoteShipping(catalog, zones, { items: [{ sku: variant.sku, qty: 1000 }], zone: 1, service: "ground" });
    expect(q1000.excluded.some((e) => e.reason === "invalid quantity")).toBe(true);
    const qNeg = quoteShipping(catalog, zones, { items: [{ sku: variant.sku, qty: -1 }], zone: 1, service: "ground" });
    expect(qNeg.excluded.some((e) => e.reason === "invalid quantity")).toBe(true);
  });

  it("qty>stock gives insufficient stock (have N)", () => {
    const lowStock = catalog.products.flatMap((p) => p.variants).find((v) => v.stock > 0 && v.stock < 999)!;
    const q = quoteShipping(catalog, zones, { items: [{ sku: lowStock.sku, qty: lowStock.stock + 1 }], zone: 1, service: "ground" });
    const ex = q.excluded.find((e) => e.sku === lowStock.sku);
    expect(ex).toBeDefined();
    expect(ex!.reason).toBe(`insufficient stock (have ${lowStock.stock})`);
  });

  it("empty items returns zero quote with explain No items to rate", () => {
    const q = quoteShipping(catalog, zones, { items: [], zone: 1, service: "ground" });
    expect(q.total_cents).toBe(0);
    expect(q.base_rate_cents).toBe(0);
    expect(q.explain).toEqual(["No items to rate."]);
    expect(q.items.length).toBe(0);
  });

  it("explain.length >=2 and <=12, total_cents = base + surcharges", () => {
    const q = quoteShipping(catalog, zones, { items: [{ sku: variant.sku, qty: 1 }], zone: 4, service: "expedited" });
    expect(q.explain.length).toBeGreaterThanOrEqual(2);
    expect(q.explain.length).toBeLessThanOrEqual(12);
    const sumSurcharges = q.surcharges.reduce((a, b) => a + b.amount_cents, 0);
    expect(q.total_cents).toBe(q.base_rate_cents + sumSurcharges);
  });
});
