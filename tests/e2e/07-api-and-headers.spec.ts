// UC-11 | FR-19, MAN-03, §2.6 frozen HTTP API
import { test, expect } from "./fixtures/app.ts";

test.describe("UC-11 health endpoint, frozen headers and route validation", () => {
  test("GET /api/health returns the HealthResponse shape (FR-19)", async ({ request }) => {
    const res = await request.get("/api/health");
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(typeof body.version).toBe("string");
    expect(["live", "degraded"]).toContain(body.mode);
    expect(body.origin_isolated).toBe(true);
    expect(["gemini-2.5-flash", "deterministic"]).toContain(body.planner);
    expect(body.catalog.synthetic).toBe(true);
    expect(body.catalog.variants).toBeGreaterThan(0);
    expect(body.catalog.products).toBeGreaterThan(0);
  });

  test("every response carries the frozen MAN-03 headers", async ({ request }) => {
    for (const path of ["/", "/api/health"]) {
      const res = await request.get(path);
      const headers = res.headers();
      expect(headers["origin-agent-cluster"], `${path} Origin-Agent-Cluster`).toBe("?1");
      expect(headers["permissions-policy"], `${path} Permissions-Policy`).toBe("tools=(self)");
      expect(headers["x-content-type-options"], `${path} X-Content-Type-Options`).toBe("nosniff");
      expect(headers["referrer-policy"], `${path} Referrer-Policy`).toBe("strict-origin-when-cross-origin");
    }
  });

  const dataRoutes: Array<{ path: string; valid: unknown; invalid: unknown }> = [
    { path: "/api/inventory/search", valid: { query: "blue", limit: 5 }, invalid: { query: 123 } },
    { path: "/api/inventory/filter", valid: { options: { color: "Blue" }, limit: 5 }, invalid: { maxPriceCents: "free" } },
    { path: "/api/shipping/quote", valid: { items: [{ sku: "OPS-1002-BLU-M", qty: 1 }], zone: 4, service: "ground" }, invalid: { items: [], zone: 9, service: "teleport" } },
  ];

  for (const { path, valid, invalid } of dataRoutes) {
    test(`POST ${path} returns 200 for valid input`, async ({ request }) => {
      const res = await request.post(path, { data: valid });
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.ok).toBe(true);
      expect(body.data).toBeTruthy();
    });

    test(`POST ${path} returns 400 INVALID_INPUT for invalid input`, async ({ request }) => {
      const res = await request.post(path, { data: invalid });
      expect(res.status(), `${path} must reject invalid input`).toBe(400);
      const body = await res.json();
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe("INVALID_INPUT");
      expect(typeof body.error.message).toBe("string");
    });

    test(`GET ${path} is refused with 405`, async ({ request }) => {
      const res = await request.get(path);
      expect(res.status()).toBe(405);
    });
  }

  test("POST /api/inventory/filter narrows a supplied sku list", async ({ request }) => {
    const all = await (await request.post("/api/inventory/search", { data: { query: "blue", limit: 25 } })).json();
    const skus: string[] = all.data.matches.map((m: { sku: string }) => m.sku).slice(0, 4);

    const res = await request.post("/api/inventory/filter", { data: { skus, limit: 25 } });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.from_result_set).toBe(true);
    for (const m of body.data.matches) expect(skus).toContain(m.sku);
  });

  test("POST /api/agent/plan never returns non-200 and always yields a ToolPlan (FR-12)", async ({ request }) => {
    for (const data of [{ goal: "hold all low-stock blue variants for 15 minutes" }, { goal: "" }, {}, { goal: 42 }]) {
      const res = await request.post("/api/agent/plan", { data });
      expect(res.status(), `plan(${JSON.stringify(data)})`).toBe(200);
      const plan = await res.json();
      expect(typeof plan.goal).toBe("string");
      expect(Array.isArray(plan.steps)).toBe(true);
      expect(["gemini-2.5-flash", "deterministic"]).toContain(plan.planner);
      expect(typeof plan.degraded).toBe("boolean");
      expect(typeof plan.created_at).toBe("string");
      for (const step of plan.steps) {
        expect(["search_inventory", "filter_variants", "calculate_shipping", "hold_order", "confirm_fulfillment"]).toContain(step.tool);
        expect(typeof step.rationale).toBe("string");
      }
    }
  });

  test("an oversized body is rejected rather than processed", async ({ request }) => {
    const res = await request.post("/api/inventory/search", { data: { query: "x".repeat(40 * 1024) } });
    expect([400, 413]).toContain(res.status());
  });
});
