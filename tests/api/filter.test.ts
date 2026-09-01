import { describe, it, expect } from "vitest";
import filterHandler from "../../api/inventory/filter.ts";

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
  };
  return res;
}
function mockReq(method: string, body?: unknown) {
  return { method, body, headers: {} } as any;
}

describe("POST /api/inventory/filter", () => {
  it("POST {maxPriceCents:5000} -> 200 ok:true with applied non-empty", async () => {
    const req = mockReq("POST", { maxPriceCents: 5000 });
    const res = mockRes();
    await filterHandler(req, res);
    expect(res.getStatus()).toBe(200);
    const json = JSON.parse(res.getBody());
    expect(json.ok).toBe(true);
    expect(Array.isArray(json.data.matches)).toBe(true);
    expect(typeof json.data.total).toBe("number");
    expect(Array.isArray(json.data.applied)).toBe(true);
    expect(json.data.applied.length).toBeGreaterThan(0);
    expect(json.data.applied.join(" ")).toMatch(/price/);
    expect(typeof json.data.from_result_set).toBe("boolean");
  });

  it("POST bad input -> 400 INVALID_INPUT", async () => {
    const req = mockReq("POST", { maxPriceCents: "bad" } as any);
    const res = mockRes();
    await filterHandler(req, res);
    expect(res.getStatus()).toBe(400);
    const json = JSON.parse(res.getBody());
    expect(json.ok).toBe(false);
    expect(json.error.code).toBe("INVALID_INPUT");
  });

  it("filters by color and price together", async () => {
    const req = mockReq("POST", { options: { color: "Blue" }, maxPriceCents: 5000, limit: 10 });
    const res = mockRes();
    await filterHandler(req, res);
    expect(res.getStatus()).toBe(200);
    const json = JSON.parse(res.getBody());
    expect(json.ok).toBe(true);
    // all matches should be blue and cheap
    for (const m of json.data.matches) {
      expect(m.options.color.toLowerCase()).toBe("blue");
      expect(m.price_cents).toBeLessThanOrEqual(5000);
    }
  });

  it("never throws", async () => {
    const req = mockReq("POST", { skuPrefix: "OPS-1001" });
    const res = mockRes();
    await expect(filterHandler(req, res)).resolves.not.toThrow();
    expect(res.getStatus()).toBe(200);
  });
});
