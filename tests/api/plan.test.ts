import { describe, it, expect } from "vitest";
import planHandler from "../../api/agent/plan.ts";

function mockRes() {
  let statusCode = 200;
  let body = "";
  const headers: Record<string, string> = {};
  const res: any = {
    status(code: number) { statusCode = code; return res; },
    setHeader(k: string, v: string) { headers[k] = v; return res; },
    send(payload: string) { body = payload; return res; },
    getStatus() { return statusCode; },
    getBody() { return body; },
  };
  return res;
}
function mockReq(method: string, body?: unknown) {
  return { method, body, headers: {} } as any;
}

describe("POST /api/agent/plan", () => {
  it("keyless path -> 200 planner deterministic steps>=3 with goal echoed", async () => {
    const orig = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;
    const goal = "hold low stock blue variants under $12 to zone 4";
    const req = mockReq("POST", { goal });
    const res = mockRes();
    await planHandler(req, res);
    expect(res.getStatus()).toBe(200);
    const json = JSON.parse(res.getBody());
    expect(json.goal).toBe(goal);
    expect(json.planner).toBe("deterministic");
    expect(Array.isArray(json.steps)).toBe(true);
    expect(json.steps.length).toBeGreaterThanOrEqual(3);
    expect(typeof json.degraded).toBe("boolean");
    expect(typeof json.created_at).toBe("string");
    expect(new Date(json.created_at).toISOString()).toBe(json.created_at);
    for (const s of json.steps) {
      expect(typeof s.tool).toBe("string");
      expect(typeof s.args).toBe("object");
      expect(typeof s.rationale).toBe("string");
    }
    if (orig !== undefined) process.env.GEMINI_API_KEY = orig;
  });

  it("never throws even with empty goal", async () => {
    const orig = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;
    const req = mockReq("POST", { goal: "" });
    const res = mockRes();
    await expect(planHandler(req, res)).resolves.not.toThrow();
    expect(res.getStatus()).toBe(200);
    const json = JSON.parse(res.getBody());
    expect(json.planner).toBe("deterministic");
    if (orig !== undefined) process.env.GEMINI_API_KEY = orig;
  });

  it("method guard 405", async () => {
    const req = mockReq("GET", { goal: "test" });
    const res = mockRes();
    await planHandler(req, res);
    expect(res.getStatus()).toBe(405);
  });

  it("truncates long goal to 400 chars", async () => {
    const orig = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;
    const long = "a".repeat(600);
    const req = mockReq("POST", { goal: long });
    const res = mockRes();
    await planHandler(req, res);
    const json = JSON.parse(res.getBody());
    expect(json.goal.length).toBe(400);
    if (orig !== undefined) process.env.GEMINI_API_KEY = orig;
  });
});
