import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { TOOL_SCHEMAS } from "../../src/webmcp/schemas.ts";
import { executeToolCompat } from "../../src/webmcp/policy.ts";
import * as policyMod from "../../src/webmcp/policy.ts";
import { publisher, collectEnvelopes } from "../../src/engine/envelopes.ts";
import { orchestrator } from "../../src/agent/orchestrator.ts";
import * as apiClientMod from "../../src/engine/apiClient.ts";
import { makeToolError } from "../../src/engine/domain/errors.ts";

describe("orchestrator", () => {
  beforeEach(() => vi.restoreAllMocks());
  afterEach(() => vi.restoreAllMocks());

  it("imports prove wiring - TOOL_SCHEMAS and executeToolCompat are real", async () => {
    expect(TOOL_SCHEMAS.search_inventory).toBeDefined();
    expect(TOOL_SCHEMAS.hold_order).toBeDefined();
    expect(typeof executeToolCompat).toBe("function");
    expect(Object.keys(TOOL_SCHEMAS)).toEqual(expect.arrayContaining(["search_inventory","filter_variants","calculate_shipping","hold_order","confirm_fulfillment"]));
  });

  it("run emits agent.plan started/done envelopes via publisher/collect with traceId, planner, degraded", async () => {
    const planStub = {
      goal: "search blue",
      steps: [{ tool: "search_inventory" as const, args: { query: "blue", limit: 25 }, rationale: "search because goal says 'search blue'" }],
      planner: "deterministic" as const,
      degraded: false,
      created_at: new Date().toISOString(),
    };
    vi.spyOn(apiClientMod.apiClient, "plan").mockResolvedValue(planStub as never);
    const execSpy = vi.spyOn(policyMod, "executeToolCompat").mockResolvedValue({ ok: true, data: { matches: [], total: 0 } } as never);
    const { plan, results, traceId } = await orchestrator.run("search blue");
    expect(plan.planner).toBe("deterministic");
    expect(typeof traceId).toBe("string");
    expect(traceId.startsWith("opsflow-")).toBe(true);
    expect(results.length).toBe(1);
    expect(results[0].ok).toBe(true);
    // check via publisher.collect(traceId)
    const snap = (publisher as unknown as { collect: (id?: string)=> { events: Array<{step_id:string; status:string; payload:Record<string,unknown>; trace_id:string; degraded?:boolean}>; trace_id:string } | null }).collect?.(traceId);
    expect(snap).not.toBeNull();
    const events = snap!.events;
    const started = events.find(e => e.step_id === "agent.plan" && e.status === "started");
    const done = events.find(e => e.step_id === "agent.plan" && e.status === "done");
    expect(started).toBeDefined();
    expect(done).toBeDefined();
    expect((started!.payload as Record<string,unknown>)["goal"]).toBe("search blue");
    expect((done!.payload as Record<string,unknown>)["planner"]).toBe(plan.planner);
    expect((done!.payload as Record<string,unknown>)["degraded"]).toBe(false);
    expect(started!.trace_id).toBe(traceId);
    expect(done!.trace_id).toBe(traceId);
    // also via collectEnvelopes helper
    const envelopes = collectEnvelopes(traceId);
    expect(envelopes.some(e => e.step_id === "agent.plan" && e.status === "started")).toBe(true);
    expect(envelopes.some(e => e.step_id === "agent.plan" && e.status === "done")).toBe(true);
    expect(execSpy).toHaveBeenCalledTimes(1);
  });

  const STOP_CODES = ["INVALID_INPUT","NOT_FOUND","CONFLICT","EXPIRED","NEEDS_CONFIRMATION"] as const;
  for (const code of STOP_CODES) {
    it(`stop-on-error: ${code} stops before next step (hold not followed by confirm)`, async () => {
      const planStub = {
        goal: "hold test",
        steps: [
          { tool: "hold_order" as const, args: { lineItems: [{ sku: "OPS-0001-BLU-M", qty: 1 }], ttlMinutes: 15 }, rationale: "hold because goal says 'hold'" },
          { tool: "confirm_fulfillment" as const, args: { holdId: "HOLD-ABCD1234" }, rationale: "confirm because goal says 'confirm'" },
        ],
        planner: "deterministic" as const,
        degraded: false,
        created_at: new Date().toISOString(),
      };
      vi.spyOn(apiClientMod.apiClient, "plan").mockResolvedValue(planStub as never);
      const errOutcome = makeToolError(code as never, `${code} message`);
      const spy = vi.spyOn(policyMod, "executeToolCompat").mockImplementation(async (name: unknown) => {
        if (name === "hold_order") return errOutcome as never;
        return { ok: true, data: {} } as never;
      });
      const { results } = await orchestrator.run("hold test");
      expect(results.length).toBe(1);
      expect(results[0].ok).toBe(false);
      if (!results[0].ok) expect((results[0] as { ok:false; error:{code:string}}).error.code).toBe(code);
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).not.toHaveBeenCalledWith("confirm_fulfillment", expect.anything(), expect.anything());
    });
  }

  it("DEGRADED does NOT stop — next step still executes", async () => {
    const planStub = {
      goal: "search then filter",
      steps: [
        { tool: "search_inventory" as const, args: { query: "blue", limit: 25 }, rationale: "search" },
        { tool: "filter_variants" as const, args: { options: { color: "blue" }, limit: 25 }, rationale: "filter" },
      ],
      planner: "deterministic" as const,
      degraded: false,
      created_at: new Date().toISOString(),
    };
    vi.spyOn(apiClientMod.apiClient, "plan").mockResolvedValue(planStub as never);
    const degradedOutcome = makeToolError("DEGRADED" as never, "degraded");
    // First call returns DEGRADED error, second returns success
    const spy = vi.spyOn(policyMod, "executeToolCompat")
      .mockResolvedValueOnce(degradedOutcome as never)
      .mockResolvedValueOnce({ ok: true, data: { matches: [] } } as never);
    const { results } = await orchestrator.run("search then filter");
    expect(results.length).toBe(2);
    expect(!results[0].ok && (results[0] as {error:{code:string}}).error.code === "DEGRADED").toBe(true);
    expect(results[1].ok).toBe(true);
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it("TOOL_ABORTED stops", async () => {
    const planStub = {
      goal: "hold then confirm",
      steps: [
        { tool: "hold_order" as const, args: { lineItems: [{ sku: "OPS-0001-BLU-M", qty: 1 }], ttlMinutes: 15 }, rationale: "hold" },
        { tool: "confirm_fulfillment" as const, args: { holdId: "HOLD-ABCD1234" }, rationale: "confirm" },
      ],
      planner: "deterministic" as const,
      degraded: false,
      created_at: new Date().toISOString(),
    };
    vi.spyOn(apiClientMod.apiClient, "plan").mockResolvedValue(planStub as never);
    const abortedOutcome = makeToolError("TOOL_ABORTED" as never, "Aborted");
    const spy = vi.spyOn(policyMod, "executeToolCompat").mockImplementation(async (name: unknown) => {
      if (name === "hold_order") return abortedOutcome as never;
      return { ok: true, data: {} } as never;
    });
    const { results } = await orchestrator.run("hold then confirm");
    expect(results.length).toBe(1);
    expect(!results[0].ok).toBe(true);
    if (!results[0].ok) expect(results[0].error.code).toBe("TOOL_ABORTED");
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("abort() is idempotent - can be called multiple times safely without throw", async () => {
    expect(() => orchestrator.abort()).not.toThrow();
    expect(() => orchestrator.abort()).not.toThrow();
    expect(() => orchestrator.abort()).not.toThrow();
    // also after a run, abort remains safe
    const planStub = {
      goal: "search blue",
      steps: [{ tool: "search_inventory" as const, args: { query: "blue", limit: 25 }, rationale: "search" }],
      planner: "deterministic" as const,
      degraded: false,
      created_at: new Date().toISOString(),
    };
    vi.spyOn(apiClientMod.apiClient, "plan").mockResolvedValue(planStub as never);
    vi.spyOn(policyMod, "executeToolCompat").mockResolvedValue({ ok: true, data: {} } as never);
    await orchestrator.run("search blue");
    expect(() => orchestrator.abort()).not.toThrow();
    expect(() => orchestrator.abort()).not.toThrow();
  });

  it("abort() aborts in-flight run (loop checks ctrl.signal.aborted)", async () => {
    const planStub = {
      goal: "multi step",
      steps: [
        { tool: "search_inventory" as const, args: { query: "blue", limit: 25 }, rationale: "search" },
        { tool: "filter_variants" as const, args: { limit: 25 }, rationale: "filter" },
        { tool: "calculate_shipping" as const, args: { items: [{ sku: "OPS-0001-BLU-M", qty: 1 }], zone: 1, service: "ground" as const }, rationale: "ship" },
      ],
      planner: "deterministic" as const,
      degraded: false,
      created_at: new Date().toISOString(),
    };
    vi.spyOn(apiClientMod.apiClient, "plan").mockResolvedValue(planStub as never);
    let callCount = 0;
    vi.spyOn(policyMod, "executeToolCompat").mockImplementation(async (_name: unknown, _args: unknown, opts?: { signal?: AbortSignal }) => {
      callCount++;
      // first call takes 80ms, gives window to abort
      if (callCount === 1) {
        await new Promise<void>((resolve) => setTimeout(resolve, 80));
        // if aborted during delay, the orchestrator's signal would be aborted
        // simulate TOOL_ABORTED if signal is aborted
        if (opts?.signal?.aborted) return makeToolError("TOOL_ABORTED" as never, "Aborted") as never;
        return { ok: true, data: {} } as never;
      }
      return { ok: true, data: {} } as never;
    });
    const runPromise = orchestrator.run("multi step");
    // abort after 10ms, during first tool execution
    await new Promise<void>((resolve) => setTimeout(resolve, 10));
    orchestrator.abort();
    // idempotent second abort
    orchestrator.abort();
    const { results } = await runPromise;
    // Should have stopped early: at most 1 result (first step may complete but second should not run, or first returns TOOL_ABORTED)
    // The key invariant: abort prevents full 3-step execution
    expect(results.length).toBeLessThan(3);
    expect(callCount).toBeLessThan(3);
  });

  it("run propagates degraded flag to done envelope", async () => {
    const planStub = {
      goal: "search blue degraded",
      steps: [{ tool: "search_inventory" as const, args: { query: "blue", limit: 25 }, rationale: "search" }],
      planner: "deterministic" as const,
      degraded: true,
      created_at: new Date().toISOString(),
    };
    vi.spyOn(apiClientMod.apiClient, "plan").mockResolvedValue(planStub as never);
    vi.spyOn(policyMod, "executeToolCompat").mockResolvedValue({ ok: true, data: {} } as never);
    const { traceId } = await orchestrator.run("search blue degraded");
    const snap = (publisher as unknown as { collect: (id?: string)=> { events: Array<{step_id:string; status:string; payload:Record<string,unknown>; degraded?:boolean}> } | null }).collect?.(traceId);
    const done = snap!.events.find(e => e.step_id === "agent.plan" && e.status === "done");
    expect(done).toBeDefined();
    expect((done!.payload as Record<string,unknown>)["degraded"]).toBe(true);
    expect(done!.degraded).toBe(true);
  });

  it("abort via external signal also stops the loop", async () => {
    const planStub = {
      goal: "multi step external",
      steps: [
        { tool: "search_inventory" as const, args: { query: "blue", limit: 25 }, rationale: "search" },
        { tool: "filter_variants" as const, args: { limit: 25 }, rationale: "filter" },
      ],
      planner: "deterministic" as const,
      degraded: false,
      created_at: new Date().toISOString(),
    };
    vi.spyOn(apiClientMod.apiClient, "plan").mockResolvedValue(planStub as never);
    const externalCtrl = new AbortController();
    let callCount = 0;
    vi.spyOn(policyMod, "executeToolCompat").mockImplementation(async () => {
      callCount++;
      if (callCount === 1) {
        await new Promise<void>((resolve) => setTimeout(resolve, 60));
        return { ok: true, data: {} } as never;
      }
      return { ok: true, data: {} } as never;
    });
    const runPromise = orchestrator.run("multi step external", { signal: externalCtrl.signal });
    await new Promise<void>((resolve) => setTimeout(resolve, 10));
    externalCtrl.abort();
    const { results } = await runPromise;
    expect(results.length).toBeLessThan(2);
  });
});
