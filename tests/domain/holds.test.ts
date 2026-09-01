import { describe, it, expect } from "vitest";
import { newHoldId, newFulfillmentId, isExpired, createHold, confirmHold } from "../../src/engine/domain/holds.ts";
import type { Hold } from "../../src/engine/types.ts";

describe("holds", () => {
  it("newHoldId format HOLD-[A-Z2-7]{8}", () => {
    const id = newHoldId(() => 0.5);
    expect(id).toMatch(/^HOLD-[A-Z2-7]{8}$/);
    // determinism with same rand
    const a = newHoldId(() => 0.1);
    const b = newHoldId(() => 0.1);
    expect(a).toBe(b);
    // different rand gives different id (likely)
    const c = newHoldId(() => 0.9);
    expect(c).not.toBe(a);
    // all chars valid alphabet
    for (let i = 0; i < 10; i++) {
      const r = newHoldId();
      expect(r).toMatch(/^HOLD-[A-Z2-7]{8}$/);
    }
  });

  it("newFulfillmentId format FUL-[A-Z2-7]{8}", () => {
    const id = newFulfillmentId(() => 0.5);
    expect(id).toMatch(/^FUL-[A-Z2-7]{8}$/);
    const a = newFulfillmentId(() => 0.2);
    const b = newFulfillmentId(() => 0.2);
    expect(a).toBe(b);
  });

  it("isExpired true/false", () => {
    const hold: Hold = {
      hold_id: "HOLD-TEST000",
      line_items: [{ sku: "OPS-1001-BLA-XL", qty: 1 }],
      created_at: "2026-09-01T10:00:00.000Z",
      expires_at: "2026-09-01T10:15:00.000Z",
      ttl_minutes: 15,
      status: "held",
      note: null,
      quote: null,
    };
    expect(isExpired(hold, new Date("2026-09-01T10:14:59Z"))).toBe(false);
    expect(isExpired(hold, new Date("2026-09-01T10:15:00Z"))).toBe(true);
    expect(isExpired(hold, new Date("2026-09-01T10:16:00Z"))).toBe(true);
  });

  it("createHold timestamps expires_at = created_at + ttl*60000", () => {
    const now = new Date("2026-09-01T10:00:00.000Z");
    const hold = createHold({ lineItems: [{ sku: "OPS-1001-BLA-XL", qty: 2 }], ttlMinutes: 15, note: "test" }, null, now);
    expect(hold.created_at).toBe(now.toISOString());
    const expectedExpires = new Date(now.getTime() + 15 * 60000).toISOString();
    expect(hold.expires_at).toBe(expectedExpires);
    expect(hold.ttl_minutes).toBe(15);
    expect(hold.status).toBe("held");
    expect(hold.hold_id).toMatch(/^HOLD-[A-Z2-7]{8}$/);
  });

  it("confirmHold already-confirmed => CONFLICT", () => {
    const now = new Date("2026-09-01T10:00:00Z");
    const hold = createHold({ lineItems: [{ sku: "S", qty: 1 }], ttlMinutes: 15 }, null, now);
    hold.status = "confirmed";
    const res = confirmHold(hold, new Date("2026-09-01T10:05:00Z"));
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe("CONFLICT");
  });

  it("confirmHold released => CONFLICT", () => {
    const hold: Hold = {
      hold_id: "HOLD-AAAABBBB",
      line_items: [{ sku: "S", qty: 1 }],
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 60000).toISOString(),
      ttl_minutes: 15,
      status: "released",
      note: null,
      quote: null,
    };
    const res = confirmHold(hold, new Date());
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe("CONFLICT");
  });

  it("confirmHold expired => EXPIRED (status expired)", () => {
    const hold: Hold = {
      hold_id: "HOLD-EXPIRED1",
      line_items: [{ sku: "S", qty: 1 }],
      created_at: new Date("2026-09-01T10:00:00Z").toISOString(),
      expires_at: new Date("2026-09-01T10:01:00Z").toISOString(),
      ttl_minutes: 1,
      status: "expired",
      note: null,
      quote: null,
    };
    const res = confirmHold(hold, new Date("2026-09-01T10:02:00Z"));
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe("EXPIRED");
  });

  it("confirmHold expired via time => sets expired and returns EXPIRED", () => {
    const now = new Date("2026-09-01T10:00:00Z");
    const hold = createHold({ lineItems: [{ sku: "S", qty: 1 }], ttlMinutes: 1 }, null, now);
    // hold expires at 10:01, confirm at 10:02
    const res = confirmHold(hold, new Date("2026-09-01T10:02:00Z"));
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe("EXPIRED");
    expect(hold.status).toBe("expired");
  });

  it("second confirm idempotent CONFLICT", () => {
    const now = new Date("2026-09-01T10:00:00Z");
    const hold = createHold({ lineItems: [{ sku: "S", qty: 1 }], ttlMinutes: 15 }, null, now);
    const first = confirmHold(hold, new Date("2026-09-01T10:01:00Z"));
    expect(first.ok).toBe(true);
    const second = confirmHold(hold, new Date("2026-09-01T10:02:00Z"));
    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.error.code).toBe("CONFLICT");
  });

  it("never-throw for malformed holds", () => {
    expect(() => isExpired({ expires_at: "invalid" } as unknown as Hold, new Date())).not.toThrow();
    expect(() => confirmHold(null as any, new Date())).not.toThrow();
    expect(() => createHold({ lineItems: [], ttlMinutes: 15 } as any, null, new Date())).not.toThrow();
    const res = confirmHold(null as any, new Date());
    expect(res.ok).toBe(false);
  });
});
