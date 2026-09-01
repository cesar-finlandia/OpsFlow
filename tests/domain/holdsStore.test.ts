/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { holdsStore } from "../../src/engine/domain/holdsStore.ts";
import { loadCatalog } from "../../src/engine/domain/catalog.ts";

describe("holdsStore", () => {
  const catalog = loadCatalog();
  const validSku = catalog.products.flatMap((p) => p.variants)[0].sku;

  beforeEach(() => {
    holdsStore.reset();
  });

  it("create ttl out of 1..120 => INVALID_INPUT", () => {
    const r0 = holdsStore.create({ lineItems: [{ sku: validSku, qty: 1 }], ttlMinutes: 0 }, null);
    expect(r0.ok).toBe(false);
    if (!r0.ok) expect(r0.error.code).toBe("INVALID_INPUT");
    const r121 = holdsStore.create({ lineItems: [{ sku: validSku, qty: 1 }], ttlMinutes: 121 }, null);
    expect(r121.ok).toBe(false);
    if (!r121.ok) expect(r121.error.code).toBe("INVALID_INPUT");
    const rNeg = holdsStore.create({ lineItems: [{ sku: validSku, qty: 1 }], ttlMinutes: -1 }, null);
    expect(rNeg.ok).toBe(false);
    const rFloat = holdsStore.create({ lineItems: [{ sku: validSku, qty: 1 }], ttlMinutes: 1.5 as any }, null);
    expect(rFloat.ok).toBe(false);
  });

  it("unknown sku => NOT_FOUND", () => {
    const r = holdsStore.create({ lineItems: [{ sku: "UNKNOWN-SKU-999", qty: 1 }], ttlMinutes: 15 }, null);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("NOT_FOUND");
  });

  it("note >200 => INVALID_INPUT", () => {
    const longNote = "a".repeat(201);
    const r = holdsStore.create({ lineItems: [{ sku: validSku, qty: 1 }], ttlMinutes: 15, note: longNote }, null);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("INVALID_INPUT");
    // exactly 200 should pass
    const okNote = "b".repeat(200);
    const rOk = holdsStore.create({ lineItems: [{ sku: validSku, qty: 1 }], ttlMinutes: 15, note: okNote }, null);
    expect(rOk.ok).toBe(true);
  });

  it("lineItems empty and >50 => INVALID_INPUT", () => {
    const empty = holdsStore.create({ lineItems: [], ttlMinutes: 15 }, null);
    expect(empty.ok).toBe(false);
    if (!empty.ok) expect(empty.error.code).toBe("INVALID_INPUT");
    const many = Array.from({ length: 51 }, () => ({ sku: validSku, qty: 1 }));
    const rMany = holdsStore.create({ lineItems: many, ttlMinutes: 15 }, null);
    expect(rMany.ok).toBe(false);
    if (!rMany.ok) expect(rMany.error.code).toBe("INVALID_INPUT");
  });

  it("list/get/subscribe/reset", () => {
    expect(holdsStore.list().length).toBe(0);
    expect(holdsStore.get("HOLD-UNKNOWN")).toBeNull();
    const created = holdsStore.create({ lineItems: [{ sku: validSku, qty: 1 }], ttlMinutes: 15 }, null);
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const hid = created.data.hold.hold_id;
    expect(holdsStore.get(hid)).not.toBeNull();
    expect(holdsStore.list().length).toBe(1);
    // subscribe
    const calls: any[] = [];
    const unsub = holdsStore.subscribe((holds) => calls.push(holds.length));
    const created2 = holdsStore.create({ lineItems: [{ sku: validSku, qty: 1 }], ttlMinutes: 15 }, null);
    expect(created2.ok).toBe(true);
    expect(calls.length).toBeGreaterThan(0);
    expect(calls[calls.length - 1]).toBe(2);
    unsub();
    const before = calls.length;
    holdsStore.create({ lineItems: [{ sku: validSku, qty: 1 }], ttlMinutes: 15 }, null);
    expect(calls.length).toBe(before); // unsubscribed
    // reset clears
    holdsStore.reset();
    expect(holdsStore.list().length).toBe(0);
  });

  it("expired hold: create at T0 ttl 1 then confirm T0+2min => EXPIRED status expired", () => {
    const t0 = new Date("2026-09-01T00:00:00Z");
    const t2 = new Date("2026-09-01T00:02:00Z");
    const created = holdsStore.create({ lineItems: [{ sku: validSku, qty: 1 }], ttlMinutes: 1 }, null, t0);
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const hid = created.data.hold.hold_id;
    expect(created.data.hold.expires_at).toBe(new Date(t0.getTime() + 60000).toISOString());
    const res = holdsStore.confirm(hid, t2);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe("EXPIRED");
    const hold = holdsStore.get(hid);
    expect(hold?.status).toBe("expired");
  });

  it("storage throw => memory-only with warnOnce", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    // stub Storage.prototype to throw for any localStorage instance
    const proto = (globalThis as any).Storage?.prototype ?? (globalThis as any).Window?.prototype;
    let setItemSpy: any = null;
    let getItemSpy: any = null;
    try {
      if (typeof Storage !== "undefined" && Storage.prototype.setItem) {
        setItemSpy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("QuotaExceeded"); });
        getItemSpy = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("SecurityError"); });
      } else if ((globalThis as any).localStorage) {
        const ls: any = (globalThis as any).localStorage;
        setItemSpy = vi.spyOn(ls, "setItem").mockImplementation(() => { throw new Error("QuotaExceeded"); });
        getItemSpy = vi.spyOn(ls, "getItem").mockImplementation(() => { throw new Error("SecurityError"); });
      }
      holdsStore.reset(); // reset warned flag
      const r = holdsStore.create({ lineItems: [{ sku: validSku, qty: 1 }], ttlMinutes: 15 }, null);
      expect(r.ok).toBe(true);
      expect(holdsStore.list().length).toBe(1);
      expect(warnSpy).toHaveBeenCalled();
      const callCount = warnSpy.mock.calls.length;
      holdsStore.create({ lineItems: [{ sku: validSku, qty: 1 }], ttlMinutes: 15 }, null);
      expect(warnSpy.mock.calls.length).toBe(callCount);
    } finally {
      warnSpy.mockRestore();
      if (setItemSpy) setItemSpy.mockRestore();
      if (getItemSpy) getItemSpy.mockRestore();
      holdsStore.reset();
    }
  });

  it("stock-boundary note: holdsStore.create does not check stock (only sku existence)", () => {
    // Use zero-stock variant: holdsStore should allow it because it only checks existence, not stock
    const zeroSku = catalog.products.flatMap((p) => p.variants).find((v) => v.stock === 0)?.sku;
    if (zeroSku) {
      const r = holdsStore.create({ lineItems: [{ sku: zeroSku, qty: 1 }], ttlMinutes: 15 }, null);
      expect(r.ok).toBe(true);
    }
  });

  it("second confirm idempotent CONFLICT", () => {
    const t0 = new Date("2026-09-01T10:00:00Z");
    const t1 = new Date("2026-09-01T10:01:00Z");
    const t2 = new Date("2026-09-01T10:02:00Z");
    const created = holdsStore.create({ lineItems: [{ sku: validSku, qty: 1 }], ttlMinutes: 15 }, null, t0);
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const hid = created.data.hold.hold_id;
    const first = holdsStore.confirm(hid, t1);
    expect(first.ok).toBe(true);
    const second = holdsStore.confirm(hid, t2);
    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.error.code).toBe("CONFLICT");
  });
});
