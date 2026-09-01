import { describe, it, expect, vi, beforeEach } from "vitest";
import { TOOL_SCHEMAS } from "../../src/webmcp/schemas.ts";
import { validate } from "src/resilience";
import { planDeterministic } from "../../src/agent/deterministic.ts";
import { planGoal } from "../../src/agent/planner.ts";
import * as apiClientMod from "../../src/engine/apiClient.ts";

describe("planner", () => {
  beforeEach(()=> vi.restoreAllMocks());
  it("invalid-step-dropped case", async () => {
    const mock = vi.spyOn(apiClientMod.apiClient, "plan").mockResolvedValue({
      goal: "test",
      steps: [
        { tool: "search_inventory", args: { query: "hello", limit: 25 }, rationale: "ok" },
        { tool: "invalid_tool" as any, args: {}, rationale: "bad" },
        { tool: "filter_variants", args: { limit: 25, options: { color: "blue" } }, rationale: "ok2" }
      ],
      planner: "gemini-2.5-flash",
      degraded: false,
      created_at: new Date().toISOString()
    } as any);
    const r = await planGoal("test");
    expect(r.steps.length).toBe(2);
    expect(r.steps.map(s=>s.tool)).toEqual(["search_inventory","filter_variants"]);
    expect(r.degraded).toBe(false);
  });
  it("fallback-to-deterministic case", async () => {
    vi.spyOn(apiClientMod.apiClient, "plan").mockRejectedValue(new Error("network"));
    const r = await planGoal("search red shoes");
    expect(r.degraded).toBe(true);
    expect(r.planner).toBe("deterministic");
    expect(r.steps.length).toBeGreaterThanOrEqual(1);
    // compare with real deterministic fallback degraded:true
    const { loadCatalog } = await import("../../src/engine/domain/catalog.ts");
    const det = planDeterministic("search red shoes", loadCatalog());
    expect(r.goal).toBe(det.goal);
  });
  it("invalid args dropped", async () => {
    vi.spyOn(apiClientMod.apiClient, "plan").mockResolvedValue({
      goal: "test",
      steps: [
        { tool: "search_inventory", args: { query: "", limit: 0 }, rationale: "bad" },
        { tool: "search_inventory", args: { query: "hello", limit: 25 }, rationale: "ok" }
      ],
      planner: "gemini-2.5-flash",
      degraded: false,
      created_at: new Date().toISOString()
    } as any);
    const r = await planGoal("test");
    expect(r.steps.length).toBe(1);
    expect(r.steps[0].args).toEqual({ query: "hello", limit: 25 });
  });
  it("empty steps fallback", async () => {
    vi.spyOn(apiClientMod.apiClient, "plan").mockResolvedValue({ goal: "test", steps: [], planner: "gemini-2.5-flash", degraded: false, created_at: new Date().toISOString() } as any);
    const r = await planGoal("test");
    expect(r.degraded).toBe(true);
    expect(r.steps.length).toBeGreaterThan(0);
  });
  it("non-object fallback", async () => {
    vi.spyOn(apiClientMod.apiClient, "plan").mockResolvedValue(null as any);
    const r = await planGoal("test");
    expect(r.degraded).toBe(true);
  });
  it("missing created_at normalized", async () => {
    vi.spyOn(apiClientMod.apiClient, "plan").mockResolvedValue({ goal: "test", steps: [{tool:"search_inventory", args:{query:"x", limit:25}, rationale:"ok"}], planner:"gemini-2.5-flash", degraded:true } as any);
    const r = await planGoal("test");
    expect(typeof r.created_at).toBe("string");
    expect(!isNaN(Date.parse(r.created_at))).toBe(true);
  });
  it("never throws", async () => {
    vi.spyOn(apiClientMod.apiClient, "plan").mockRejectedValue(new Error("fail"));
    await expect(planGoal("")).resolves.toBeDefined();
  });
  it("validatePlan not exported", async () => {
    const mod: any = await import("../../src/agent/planner.ts");
    expect(mod.validatePlan).toBeUndefined();
  });
  it("uses TOOL_SCHEMAS and planDeterministic", async () => {
    expect(TOOL_SCHEMAS.search_inventory).toBeDefined();
    expect(planDeterministic).toBeDefined();
  });
});
