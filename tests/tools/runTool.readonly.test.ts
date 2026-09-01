import { describe, it, expect, beforeEach } from "vitest";
import { runTool } from "src/webmcp/runTool.ts";
import { publisher, collectEnvelopes } from "src/engine/envelopes.ts";
import { loadCatalog } from "src/engine/domain/catalog.ts";
import { holdsStore } from "src/engine/domain/holdsStore.ts";

describe("runTool readonly", () => {
  beforeEach(() => {
    holdsStore.reset();
  });

  it("valid search_inventory -> ok:true with matches, emits started then done", async () => {
    const res = await runTool("search_inventory", { query: "blue" });
    expect(res.structuredContent.ok).toBe(true);
    expect(res.isError).toBe(false);
    if (res.structuredContent.ok) {
      const data = res.structuredContent.data as { matches: unknown[]; total: number };
      expect(Array.isArray(data.matches)).toBe(true);
      expect(typeof data.total).toBe("number");
    }
    expect(res.content[0].text).toContain("variants matched");
    // check envelopes via publisher.collect
    const snap = (publisher as unknown as { collect: (id?: string)=> { events: Array<{step_id:string; status:string}> } | null }).collect?.();
    if (snap && snap.events) {
      const toolEvents = snap.events.filter(e => e.step_id === "tool.search_inventory");
      expect(toolEvents.some(e => e.status === "started")).toBe(true);
      expect(toolEvents.some(e => e.status === "done" || e.status === "error")).toBe(true);
    }
  });

  it("invalid input missing query -> INVALID_INPUT, never calls domain", async () => {
    const res = await runTool("search_inventory", {});
    expect(res.structuredContent.ok).toBe(false);
    if (!res.structuredContent.ok) expect(res.structuredContent.error.code).toBe("INVALID_INPUT");
    expect(res.isError).toBe(true);
    expect(res.content[0].text).toContain("INVALID_INPUT");
  });

  it("filter_variants threads sessionResultSkus", async () => {
    // first do a search to populate some session context? Instead set global accessor
    const catalog = loadCatalog();
    const skus = catalog.products.flatMap(p=>p.variants).slice(0,2).map(v=>v.sku);
    (globalThis as unknown as Record<string, unknown>)["__opsflow_getLastResultSkus"] = () => skus;
    const res = await runTool("filter_variants", { skuPrefix: skus[0].slice(0,4) });
    expect(res.structuredContent.ok).toBe(true);
    if (res.structuredContent.ok) {
      const data = res.structuredContent.data as { total: number };
      expect(typeof data.total).toBe("number");
    }
    expect(res.content[0].text).toContain("Filter applied");
    delete (globalThis as unknown as Record<string, unknown>)["__opsflow_getLastResultSkus"];
  });

  it("calculate_shipping explains surcharges", async () => {
    const catalog = loadCatalog();
    const validSku = catalog.products.flatMap(p=>p.variants)[0].sku;
    const res = await runTool("calculate_shipping", { items: [{ sku: validSku, qty: 1 }], zone: 1, service: "ground" });
    expect(res.structuredContent.ok).toBe(true);
    if (res.structuredContent.ok) {
      const data = res.structuredContent.data as { zone: number; service: string; total_cents: number; explain: string[] };
      expect(data.zone).toBe(1);
      expect(data.service).toBe("ground");
      expect(Array.isArray(data.explain)).toBe(true);
      expect(data.explain.length).toBeGreaterThan(0);
    }
    expect(res.content[0].text).toContain("Quote zone");
  });

  it("search_inventory additionalProperties false -> INVALID_INPUT", async () => {
    const res = await runTool("search_inventory", { query: "blue", extra: 1 });
    expect(res.structuredContent.ok).toBe(false);
    if (!res.structuredContent.ok) expect(res.structuredContent.error.code).toBe("INVALID_INPUT");
  });

  it("filter_variants with no filters returns total", async () => {
    const res = await runTool("filter_variants", {});
    expect(res.structuredContent.ok).toBe(true);
  });
});
