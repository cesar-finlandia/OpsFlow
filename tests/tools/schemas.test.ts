import { describe, it, expect } from "vitest";
import { validate } from "src/resilience";
import { TOOL_SCHEMAS, SEARCH_INVENTORY_SCHEMA, FILTER_VARIANTS_SCHEMA, CALCULATE_SHIPPING_SCHEMA, HOLD_ORDER_SCHEMA, CONFIRM_FULFILLMENT_SCHEMA } from "src/webmcp/schemas.ts";

describe("schemas", () => {
  it("TOOL_SCHEMAS has five tools", () => {
    expect(Object.keys(TOOL_SCHEMAS).sort()).toEqual(["calculate_shipping","confirm_fulfillment","filter_variants","hold_order","search_inventory"].sort());
  });
  it("all schemas have $schema draft-07 and additionalProperties false", () => {
    for (const [name, schema] of Object.entries(TOOL_SCHEMAS)) {
      expect((schema as unknown as Record<string, unknown>).$schema).toBe("http://json-schema.org/draft-07/schema#");
      expect((schema as unknown as Record<string, unknown>).additionalProperties).toBe(false);
    }
  });
  it("SEARCH_INVENTORY required query", () => {
    const strip = (s: unknown) => { const c = { ...(s as Record<string, unknown>) }; delete c["$schema"]; return c; };
    const ok = validate(strip(SEARCH_INVENTORY_SCHEMA) as unknown as object, { query: "blue" });
    expect(ok.valid).toBe(true);
    const missing = validate(strip(SEARCH_INVENTORY_SCHEMA) as unknown as object, {});
    expect(missing.valid).toBe(false);
    const extra = validate(strip(SEARCH_INVENTORY_SCHEMA) as unknown as object, { query: "blue", extra: 1 });
    expect(extra.valid).toBe(false);
    const tooLong = validate(strip(SEARCH_INVENTORY_SCHEMA) as unknown as object, { query: "a".repeat(201) });
    expect(tooLong.valid).toBe(false);
  });
  it("FILTER_VARIANTS optional fields and additionalProperties", () => {
    const strip = (s: unknown) => { const c = { ...(s as Record<string, unknown>) }; delete c["$schema"]; return c; };
    const empty = validate(strip(FILTER_VARIANTS_SCHEMA) as unknown as object, {});
    expect(empty.valid).toBe(true);
    const valid = validate(strip(FILTER_VARIANTS_SCHEMA) as unknown as object, { skuPrefix: "OPS-1001" });
    expect(valid.valid).toBe(true);
    const badPattern = validate(strip(FILTER_VARIANTS_SCHEMA) as unknown as object, { skuPrefix: "lowercase" });
    expect(badPattern.valid).toBe(false);
    const extra = validate(strip(FILTER_VARIANTS_SCHEMA) as unknown as object, { unknown: 1 });
    expect(extra.valid).toBe(false);
  });
  it("CALCULATE_SHIPPING required items zone service and limits", () => {
    const strip = (s: unknown) => { const c = { ...(s as Record<string, unknown>) }; delete c["$schema"]; return c; };
    const valid = validate(strip(CALCULATE_SHIPPING_SCHEMA) as unknown as object, { items: [{ sku: "OPS-1001-BLA-XL", qty: 1 }], zone: 1, service: "ground" });
    expect(valid.valid).toBe(true);
    const missing = validate(strip(CALCULATE_SHIPPING_SCHEMA) as unknown as object, { items: [{ sku: "OPS-1001-BLA-XL", qty: 1 }] });
    expect(missing.valid).toBe(false);
    const badZone = validate(strip(CALCULATE_SHIPPING_SCHEMA) as unknown as object, { items: [{ sku: "OPS-1001-BLA-XL", qty: 1 }], zone: 99, service: "ground" });
    expect(badZone.valid).toBe(false);
    const extra = validate(strip(CALCULATE_SHIPPING_SCHEMA) as unknown as object, { items: [{ sku: "OPS-1001-BLA-XL", qty: 1 }], zone: 1, service: "ground", extra: 1 });
    expect(extra.valid).toBe(false);
  });
  it("HOLD_ORDER required lineItems ttlMinutes", () => {
    const strip = (s: unknown) => { const c = { ...(s as Record<string, unknown>) }; delete c["$schema"]; return c; };
    const valid = validate(strip(HOLD_ORDER_SCHEMA) as unknown as object, { lineItems: [{ sku: "OPS-1001-BLA-XL", qty: 1 }], ttlMinutes: 15 });
    expect(valid.valid).toBe(true);
    const missing = validate(strip(HOLD_ORDER_SCHEMA) as unknown as object, { lineItems: [{ sku: "OPS-1001-BLA-XL", qty: 1 }] });
    expect(missing.valid).toBe(false);
    const badTtl = validate(strip(HOLD_ORDER_SCHEMA) as unknown as object, { lineItems: [{ sku: "OPS-1001-BLA-XL", qty: 1 }], ttlMinutes: 999 });
    expect(badTtl.valid).toBe(false);
    const extra = validate(strip(HOLD_ORDER_SCHEMA) as unknown as object, { lineItems: [{ sku: "OPS-1001-BLA-XL", qty: 1 }], ttlMinutes: 15, extra: 1 });
    expect(extra.valid).toBe(false);
  });
  it("CONFIRM_FULFILLMENT required holdId pattern", () => {
    const strip = (s: unknown) => { const c = { ...(s as Record<string, unknown>) }; delete c["$schema"]; return c; };
    const valid2 = validate(strip(CONFIRM_FULFILLMENT_SCHEMA) as unknown as object, { holdId: "HOLD-AB2CDEFG" });
    expect(valid2.valid).toBe(true);
    const missing = validate(strip(CONFIRM_FULFILLMENT_SCHEMA) as unknown as object, {});
    expect(missing.valid).toBe(false);
    const bad = validate(strip(CONFIRM_FULFILLMENT_SCHEMA) as unknown as object, { holdId: "bad" });
    expect(bad.valid).toBe(false);
    const extra = validate(strip(CONFIRM_FULFILLMENT_SCHEMA) as unknown as object, { holdId: "HOLD-AB2CDEFG", extra: 1 });
    expect(extra.valid).toBe(false);
  });
});
