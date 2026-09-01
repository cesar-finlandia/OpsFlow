import { describe, it, expect } from "vitest";
import quoteHandler from "../../api/shipping/quote.ts";
import { loadCatalog } from "../../src/engine/domain/catalog.ts";

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

function knownSku(): string {
  const catalog = loadCatalog();
  const v = catalog.products.flatMap(p=>p.variants).find(v=>v.stock>0);
  return v ? v.sku : "OPS-1001-BLA-XL";
}

describe("POST /api/shipping/quote", () => {
  it("POST valid items -> 200 ok:true with total_cents and explain", async () => {
    const sku = knownSku();
    const req = mockReq("POST", { items: [{ sku, qty: 1 }], zone: 4, service: "ground" });
    const res = mockRes();
    await quoteHandler(req, res);
    expect(res.getStatus()).toBe(200);
    const json = JSON.parse(res.getBody());
    expect(json.ok).toBe(true);
    expect(typeof json.data.total_cents).toBe("number");
    expect(Array.isArray(json.data.explain)).toBe(true);
    expect(json.data.explain.length).toBeGreaterThan(0);
    expect(Array.isArray(json.data.surcharges)).toBe(true);
    expect(json.data.zone).toBe(4);
    expect(json.data.service).toBe("ground");
    expect(typeof json.data.total_weight_g).toBe("number");
  });

  it("bad input -> 400 INVALID_INPUT", async () => {
    const req = mockReq("POST", { items: "bad", zone: 4, service: "ground" } as any);
    const res = mockRes();
    await quoteHandler(req, res);
    expect(res.getStatus()).toBe(400);
    const json = JSON.parse(res.getBody());
    expect(json.ok).toBe(false);
    expect(json.error.code).toBe("INVALID_INPUT");
  });

  it("missing required field -> 400", async () => {
    const req = mockReq("POST", { zone: 4, service: "ground" } as any);
    const res = mockRes();
    await quoteHandler(req, res);
    expect(res.getStatus()).toBe(400);
    const json = JSON.parse(res.getBody());
    expect(json.error.code).toBe("INVALID_INPUT");
  });

  it("never throws", async () => {
    const sku = knownSku();
    const req = mockReq("POST", { items: [{ sku, qty: 9999 }], zone: 2, service: "expedited" });
    const res = mockRes();
    await expect(quoteHandler(req, res)).resolves.not.toThrow();
    expect([200,400,500]).toContain(res.getStatus());
  });
});
