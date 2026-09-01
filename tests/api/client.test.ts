import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { apiClient } from "../../src/engine/apiClient.ts";

describe("apiClient fallback proof", () => {
  const originalFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("mock fetch rejected -> search returns {ok:true,degraded:true} via DP-DOM import", async () => {
    vi.spyOn(globalThis, "fetch" as any).mockRejectedValue(new Error("network down"));
    const result: any = await apiClient.search({ query: "blue" });
    expect(result.ok).toBe(true);
    expect(result.degraded).toBe(true);
    expect(result.data).toBeDefined();
    expect(Array.isArray(result.data.matches)).toBe(true);
    expect(result.data.query_echo).toBe("blue");
    expect(result.data.matches.length).toBeGreaterThan(0);
  });

  it("mock fetch rejected -> filter returns degraded", async () => {
    vi.spyOn(globalThis, "fetch" as any).mockRejectedValue(new Error("network down"));
    const result: any = await apiClient.filter({ maxPriceCents: 5000 });
    expect(result.ok).toBe(true);
    expect(result.degraded).toBe(true);
    expect(Array.isArray(result.data.matches)).toBe(true);
    expect(result.data.applied.length).toBeGreaterThan(0);
  });

  it("mock fetch rejected -> quote returns degraded", async () => {
    const { loadCatalog } = await import("../../src/engine/domain/catalog.ts");
    const catalog = loadCatalog();
    const sku = catalog.products.flatMap(p=>p.variants).find(v=>v.stock>0)!.sku;
    vi.spyOn(globalThis, "fetch" as any).mockRejectedValue(new Error("network down"));
    const result: any = await apiClient.quote({ items: [{ sku, qty: 1 }], zone: 4, service: "ground" });
    expect(result.ok).toBe(true);
    expect(result.degraded).toBe(true);
    expect(typeof result.data.total_cents).toBe("number");
  });

  it("mock fetch rejected -> plan returns deterministic degraded", async () => {
    vi.spyOn(globalThis, "fetch" as any).mockRejectedValue(new Error("network down"));
    const plan = await apiClient.plan("hold low stock blue variants under $12 to zone 4");
    expect(plan.planner).toBe("deterministic");
    expect(plan.degraded).toBe(true);
    expect(plan.steps.length).toBeGreaterThanOrEqual(1);
    expect(plan.goal).toContain("hold");
  });

  it("mock fetch rejected -> health returns degraded synthetic", async () => {
    vi.spyOn(globalThis, "fetch" as any).mockRejectedValue(new Error("network down"));
    const health = await apiClient.health();
    expect(health.mode).toBe("degraded");
    expect(health.catalog.synthetic).toBe(true);
  });
});
