import { describe, it, expect } from "vitest";
import healthHandler from "../../api/health.ts";

function mockRes() {
  const headers: Record<string, string> = {};
  let statusCode = 200;
  let body = "";
  const res: any = {
    status(code: number) { statusCode = code; return res; },
    setHeader(k: string, v: string) { headers[k] = v; return res; },
    send(payload: string) { body = payload; return res; },
    getStatus() { return statusCode; },
    getBody() { return body; },
    getHeaders() { return headers; },
  };
  return res;
}

function mockReq(method: string, body?: unknown) {
  return { method, body, headers: {} } as any;
}

describe("GET /api/health", () => {
  it("returns 200 HealthResponse with frozen shape", async () => {
    const req = mockReq("GET");
    const res = mockRes();
    await healthHandler(req, res);
    expect(res.getStatus()).toBe(200);
    const json = JSON.parse(res.getBody());
    // frozen shape from DP-SRV §5C / §5A
    expect(json.ok).toBe(true);
    expect(json.version).toBe("1.0.0");
    expect(["live","degraded"]).toContain(json.mode);
    expect(json.origin_isolated).toBe(true);
    expect(["gemini-2.5-flash","deterministic"]).toContain(json.planner);
    expect(json.catalog).toBeDefined();
    expect(typeof json.catalog.products).toBe("number");
    expect(typeof json.catalog.variants).toBe("number");
    expect(json.catalog.products).toBe(60);
    expect(json.catalog.variants).toBe(200);
    expect(json.catalog.synthetic).toBe(true);
    expect(res.getHeaders()["Content-Type"]).toMatch(/application\/json/);
  });

  it("never throws and handles method guard 405", async () => {
    const req = mockReq("POST");
    const res = mockRes();
    await expect(healthHandler(req, res)).resolves.not.toThrow();
    expect(res.getStatus()).toBe(405);
    const json = JSON.parse(res.getBody());
    expect(json.ok).toBe(false);
    expect(json.error.code).toBe("INVALID_INPUT");
  });

  it("never non-200 on GET and reports planner deterministic without key", async () => {
    const orig = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;
    const req = mockReq("GET");
    const res = mockRes();
    await healthHandler(req, res);
    expect(res.getStatus()).toBe(200);
    const json = JSON.parse(res.getBody());
    expect(json.planner).toBe("deterministic");
    if (orig !== undefined) process.env.GEMINI_API_KEY = orig;
  });
});
