import type { JSONSchema7 } from "json-schema";
import type { ToolName } from "src/engine/types.ts";

export const TOOL_DESCRIPTIONS: Record<ToolName, string> = {
  search_inventory: "Search the synthetic OpsFlow catalog for product variants by free-text query.",
  filter_variants: "Narrow the current OpsFlow result set by SKU prefix, size/color, price and stock.",
  calculate_shipping: "Quote shipping for a basket to a zone/service with surcharges explained.",
  hold_order: "Create a reversible OpsFlow hold for line items with a TTL.",
  confirm_fulfillment: "Confirm a held OpsFlow hold into a fulfillment.",
};

export const TOOL_ANNOTATIONS: Record<ToolName, { readOnlyHint: boolean; destructiveHint?: boolean; idempotentHint?: boolean; openWorldHint: boolean }> = {
  search_inventory: { readOnlyHint: true, openWorldHint: false },
  filter_variants: { readOnlyHint: true, openWorldHint: false },
  calculate_shipping: { readOnlyHint: true, openWorldHint: false },
  hold_order: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  confirm_fulfillment: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
};

const SKU_RE = "^[A-Z0-9-]{6,32}$";
const SKU_PREFIX_RE = "^[A-Z0-9-]{1,32}$";
const BASE32_RE = "^[A-Z2-7]{8}$";

export const SEARCH_INVENTORY_SCHEMA: JSONSchema7 = {
  $schema: "http://json-schema.org/draft-07/schema#",
  type: "object",
  additionalProperties: false,
  required: ["query"],
  properties: {
    query: { type: "string", minLength: 0, maxLength: 200, description: "Free-text query; use '*' or 'all' or empty for full catalog, truncated to 200 chars before validation" },
    inStockOnly: { type: "boolean" },
    limit: { type: "integer", minimum: 1, maximum: 50, description: "Result limit, default 25 from config.tools.default_limit" }
  }
};

export const FILTER_VARIANTS_SCHEMA: JSONSchema7 = {
  $schema: "http://json-schema.org/draft-07/schema#",
  type: "object",
  additionalProperties: false,
  required: [],
  properties: {
    skuPrefix: { type: "string", minLength: 1, maxLength: 32, pattern: SKU_PREFIX_RE },
    options: {
      type: "object",
      additionalProperties: false,
      required: [],
      properties: {
        size: { type: "string", minLength: 1, maxLength: 20 },
        color: { type: "string", minLength: 1, maxLength: 20 }
      }
    },
    maxPriceCents: { type: "integer", minimum: 0, maximum: 1_000_000 },
    minStock: { type: "integer", minimum: 0, maximum: 1_000_000 },
    maxStock: { type: "integer", minimum: 0, maximum: 1_000_000 },
    limit: { type: "integer", minimum: 1, maximum: 50 }
  }
};

export const CALCULATE_SHIPPING_SCHEMA: JSONSchema7 = {
  $schema: "http://json-schema.org/draft-07/schema#",
  type: "object",
  additionalProperties: false,
  required: ["items", "zone", "service"],
  properties: {
    items: {
      type: "array",
      minItems: 1,
      maxItems: 50,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["sku", "qty"],
        properties: {
          sku: { type: "string", pattern: SKU_RE },
          qty: { type: "integer", minimum: 1, maximum: 999 }
        }
      }
    },
    zone: { type: "integer", enum: [1, 2, 3, 4, 5] },
    service: { type: "string", enum: ["ground", "expedited", "overnight"] }
  }
};

export const HOLD_ORDER_SCHEMA: JSONSchema7 = {
  $schema: "http://json-schema.org/draft-07/schema#",
  type: "object",
  additionalProperties: false,
  required: ["lineItems", "ttlMinutes"],
  properties: {
    lineItems: {
      type: "array",
      minItems: 1,
      maxItems: 50,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["sku", "qty"],
        properties: {
          sku: { type: "string", pattern: SKU_RE },
          qty: { type: "integer", minimum: 1, maximum: 999 }
        }
      }
    },
    ttlMinutes: { type: "integer", minimum: 1, maximum: 120 },
    note: { type: "string", maxLength: 200 }
  }
};

export const CONFIRM_FULFILLMENT_SCHEMA: JSONSchema7 = {
  $schema: "http://json-schema.org/draft-07/schema#",
  type: "object",
  additionalProperties: false,
  required: ["holdId"],
  properties: {
    holdId: { type: "string", minLength: 1, maxLength: 32, pattern: "^HOLD-[A-Z2-7]{8}$" }
  }
};

export const TOOL_SCHEMAS: Record<ToolName, JSONSchema7> = {
  search_inventory: SEARCH_INVENTORY_SCHEMA,
  filter_variants: FILTER_VARIANTS_SCHEMA,
  calculate_shipping: CALCULATE_SHIPPING_SCHEMA,
  hold_order: HOLD_ORDER_SCHEMA,
  confirm_fulfillment: CONFIRM_FULFILLMENT_SCHEMA
};
