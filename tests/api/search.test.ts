import { describe, it, expect } from "vitest";
import searchHandler from "../../api/inventory/search.ts";

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

describe("POST /api/inventory/search", () => {
  it("POST {query:'blue'} -> 200 ok:true matches/query_echo", async () => {
    const req = mockReq("POST", { query: "blue" });
    const res = mockRes();
    await searchHandler(req, res);
    expect(res.getStatus()).toBe(200);
    const json = JSON.parse(res.getBody());
    expect(json.ok).toBe(true);
    expect(json.data).toBeDefined();
    expect(Array.isArray(json.data.matches)).toBe(true);
    expect(typeof json.data.total).toBe("number");
    expect(typeof json.data.truncated).toBe("boolean");
    expect(json.data.query_echo).toBe("blue");
    expect(json.data.matches.length).toBeGreaterThan(0);
    for (const m of json.data.matches) {
      expect(typeof m.sku).toBe("string");
      expect(typeof m.price_cents).toBe("number");
    }
  });

  it("POST {query:123} -> 400 INVALID_INPUT (validate wiring proof)", async () => {
    const req = mockReq("POST", { query: 123 } as any);
    const res = mockRes();
    await searchHandler(req, res);
    expect(res.getStatus()).toBe(400);
    const json = JSON.parse(res.getBody());
    expect(json.ok).toBe(false);
    expect(json.error.code).toBe("INVALID_INPUT");
    expect(typeof json.error.message).toBe("string");
  });

  it("method guard 405 on GET", async () => {
    const req = mockReq("GET", { query: "blue" });
    const res = mockRes();
    await searchHandler(req, res);
    expect(res.getStatus()).toBe(405);
  });

  it("never throws on empty body", async () => {
    const req = mockReq("POST", {} as any);
    const res = mockRes();
    await expect(searchHandler(req, res)).resolves.not.toThrow();
    expect([200,400]).toContain(res.getStatus());
  });
});
