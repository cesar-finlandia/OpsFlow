import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { probeWebMcp, executeToolCompat } from "src/webmcp/policy.ts";
import { installFakeModelContext, clearFakeModelContext } from "./setup.ts";

describe("policy probeWebMcp", () => {
  afterEach(() => {
    clearFakeModelContext();
    try { delete (globalThis as unknown as Record<string, unknown>)["document"]; } catch {}
  });

  it("no document -> no-model-context", async () => {
    clearFakeModelContext();
    // ensure no document
    try { delete (globalThis as unknown as Record<string, unknown>)["document"]; } catch {}
    try { delete (globalThis as unknown as Record<string, unknown>)["originAgentCluster"]; } catch {}
    const { probeWebMcp: fresh } = await import("src/webmcp/policy.ts");
    // re-import to avoid cached flag? probe checks global each time
    const res = fresh();
    expect(res.reason).toBe("no-model-context");
    expect(res.available).toBe(false);
  });

  it("document without modelContext -> no-model-context", () => {
    clearFakeModelContext();
    (globalThis as unknown as Record<string, unknown>)["document"] = {};
    const res = probeWebMcp();
    expect(res.reason).toBe("no-model-context");
  });

  it("modelContext + originAgentCluster===false -> not-origin-isolated", () => {
    clearFakeModelContext();
    (globalThis as unknown as Record<string, unknown>)["document"] = { modelContext: {} };
    (globalThis as unknown as Record<string, unknown>)["originAgentCluster"] = false;
    const res = probeWebMcp();
    expect(res.reason).toBe("not-origin-isolated");
  });

  it("with fake -> ok", () => {
    clearFakeModelContext();
    installFakeModelContext();
    const res = probeWebMcp();
    expect(res.reason).toBe("ok");
    expect(res.available).toBe(true);
  });

  it("executeToolCompat falls back to runTool when no modelContext", async () => {
    clearFakeModelContext();
    try { delete (globalThis as unknown as Record<string, unknown>)["document"]; } catch {}
    const result = await executeToolCompat("search_inventory", { query: "blue" });
    expect(result.ok).toBe(true);
  });

  it("executeToolCompat via fake modelContext executeTool", async () => {
    clearFakeModelContext();
    const { tools } = installFakeModelContext();
    // need to register tool via registerAllTools or manually register fake execute that delegates to runTool
    const { runTool } = await import("src/webmcp/runTool.ts");
    tools.set("search_inventory", {
      execute: (input: unknown, opts?: unknown) => runTool("search_inventory", input, opts as { signal?: AbortSignal })
    });
    // also need to ensure originAgentCluster true
    (globalThis as unknown as Record<string, unknown>)["originAgentCluster"] = true;
    const result = await executeToolCompat("search_inventory", { query: "blue" });
    expect(result.ok).toBe(true);
  });
});
