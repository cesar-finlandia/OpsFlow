import { describe, it, expect, beforeEach } from "vitest";
import { runTool } from "src/webmcp/runTool.ts";
import { holdsStore } from "src/engine/domain/holdsStore.ts";
import { setConfirmationHandler } from "src/webmcp/confirm.ts";
import { loadCatalog } from "src/engine/domain/catalog.ts";

describe("runTool state", () => {
  const catalog = loadCatalog();
  const validSku = catalog.products.flatMap(p=>p.variants)[0].sku;
  const validSku2 = catalog.products.flatMap(p=>p.variants)[1]?.sku ?? validSku;

  beforeEach(() => {
    holdsStore.reset();
    setConfirmationHandler(async () => false);
    try { delete (globalThis as unknown as Record<string, unknown>)["__opsflow_confirm_handler"]; } catch {}
    setConfirmationHandler(async () => false);
    try { delete (globalThis as unknown as Record<string, unknown>)["__opsflow_lastQuote"]; } catch {}
    try { delete (globalThis as unknown as Record<string, unknown>)["__opsflow_getLastResultSkus"]; } catch {}
  });

  it("hold_order without confirmation handler -> NEEDS_CONFIRMATION (safe default, no state)", async () => {
    setConfirmationHandler(async () => false);
    (globalThis as unknown as Record<string, unknown>)["__opsflow_confirm_handler"] = null;
    // ensure internal handler is false default
    setConfirmationHandler(async () => false);
    // clear handler to default false by setting global to undefined and internal to false
    (globalThis as unknown as Record<string, unknown>)["__opsflow_confirm_handler"] = undefined;
    setConfirmationHandler(async () => false);
    // now request without granting
    const before = holdsStore.list().length;
    const res = await runTool("hold_order", { lineItems: [{ sku: validSku, qty: 1 }], ttlMinutes: 15 });
    // default handler returns false => NEEDS_CONFIRMATION
    expect(res.structuredContent.ok).toBe(false);
    if (!res.structuredContent.ok) expect(res.structuredContent.error.code).toBe("NEEDS_CONFIRMATION");
    expect(holdsStore.list().length).toBe(before);
  });

  it("hold_order with granted true -> hold exists", async () => {
    setConfirmationHandler(async () => true);
    const res = await runTool("hold_order", { lineItems: [{ sku: validSku, qty: 2 }], ttlMinutes: 15, note: "Blue batch" });
    expect(res.structuredContent.ok).toBe(true);
    if (res.structuredContent.ok) {
      const data = res.structuredContent.data as { hold: { hold_id: string; line_items: unknown[] } };
      expect(data.hold.hold_id).toMatch(/^HOLD-[A-Z2-7]{8}$/);
      expect(data.hold.line_items.length).toBe(1);
    }
    expect(holdsStore.list().length).toBe(1);
    expect(res.content[0].text).toContain("Hold");
    expect(res.content[0].text).toContain("created");
  });

  it("refused confirmation -> no write", async () => {
    setConfirmationHandler(async () => false);
    const before = holdsStore.list().length;
    const res = await runTool("hold_order", { lineItems: [{ sku: validSku, qty: 1 }], ttlMinutes: 15 });
    expect(res.structuredContent.ok).toBe(false);
    if (!res.structuredContent.ok) expect(res.structuredContent.error.code).toBe("NEEDS_CONFIRMATION");
    expect(holdsStore.list().length).toBe(before);
  });

  it("confirm_fulfillment for unknown hold -> NOT_FOUND", async () => {
    setConfirmationHandler(async () => true);
    const res = await runTool("confirm_fulfillment", { holdId: "HOLD-AB2CDEFG" });
    expect(res.structuredContent.ok).toBe(false);
    if (!res.structuredContent.ok) expect(res.structuredContent.error.code).toBe("NOT_FOUND");
  });

  it("confirm_fulfillment for expired hold -> EXPIRED", async () => {
    setConfirmationHandler(async () => true);
    // create hold at T0 with ttl 1, then confirm at T2 via holdsStore directly to expire, then via runTool
    const t0 = new Date(Date.now() - 10 * 60000);
    const created = holdsStore.create({ lineItems: [{ sku: validSku, qty: 1 }], ttlMinutes: 1 }, null, t0);
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const hid = created.data.hold.hold_id;
    // hold is now expired (created 10 mins ago, ttl 1)
    const res = await runTool("confirm_fulfillment", { holdId: hid });
    expect(res.structuredContent.ok).toBe(false);
    if (!res.structuredContent.ok) expect(res.structuredContent.error.code).toBe("EXPIRED");
  });

  it("confirm_fulfillment for already-confirmed -> CONFLICT", async () => {
    setConfirmationHandler(async () => true);
    const created = holdsStore.create({ lineItems: [{ sku: validSku, qty: 1 }], ttlMinutes: 15 }, null, new Date());
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const hid = created.data.hold.hold_id;
    const first = await runTool("confirm_fulfillment", { holdId: hid });
    expect(first.structuredContent.ok).toBe(true);
    const second = await runTool("confirm_fulfillment", { holdId: hid });
    expect(second.structuredContent.ok).toBe(false);
    if (!second.structuredContent.ok) expect(second.structuredContent.error.code).toBe("CONFLICT");
  });

  it("abort mid-flight -> TOOL_ABORTED, no hold written", async () => {
    setConfirmationHandler(async () => true);
    const controller = new AbortController();
    controller.abort();
    const before = holdsStore.list().length;
    const res = await runTool("hold_order", { lineItems: [{ sku: validSku, qty: 1 }], ttlMinutes: 15 }, { signal: controller.signal });
    expect(res.structuredContent.ok).toBe(false);
    if (!res.structuredContent.ok) expect(res.structuredContent.error.code).toBe("TOOL_ABORTED");
    expect(holdsStore.list().length).toBe(before);
  });

  it("TOOL_ABORTED via AbortController with signal already aborted before confirm", async () => {
    setConfirmationHandler(async () => true);
    const created = holdsStore.create({ lineItems: [{ sku: validSku, qty: 1 }], ttlMinutes: 15 }, null, new Date());
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const hid = created.data.hold.hold_id;
    const controller = new AbortController();
    controller.abort();
    const res = await runTool("confirm_fulfillment", { holdId: hid }, { signal: controller.signal });
    expect(res.structuredContent.ok).toBe(false);
    if (!res.structuredContent.ok) expect(res.structuredContent.error.code).toBe("TOOL_ABORTED");
    // hold should still be held, not confirmed
    const hold = holdsStore.get(hid);
    expect(hold?.status).toBe("held");
  });

  it("valid confirm_fulfillment -> fulfillment id FUL-XXXXXXXX", async () => {
    setConfirmationHandler(async () => true);
    const created = holdsStore.create({ lineItems: [{ sku: validSku, qty: 1 }], ttlMinutes: 15 }, null, new Date());
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const hid = created.data.hold.hold_id;
    const res = await runTool("confirm_fulfillment", { holdId: hid });
    expect(res.structuredContent.ok).toBe(true);
    if (res.structuredContent.ok) {
      const data = res.structuredContent.data as { fulfillment: { fulfillment_id: string; hold_id: string } };
      expect(data.fulfillment.fulfillment_id).toMatch(/^FUL-[A-Z2-7]{8}$/);
      expect(data.fulfillment.hold_id).toBe(hid);
    }
    expect(res.content[0].text).toContain("Fulfillment");
  });

  it("hold_order renders Hold <id> created ... then prefix control stripped", async () => {
    setConfirmationHandler(async () => true);
    const res = await runTool("hold_order", { lineItems: [{ sku: validSku, qty: 1 }], ttlMinutes: 15 });
    expect(res.content[0].text.startsWith("[untrusted tool output")).toBe(true);
    expect(res.content[0].text).toContain("Hold");
  });

  it("confirm_fulfillment NEEDS_CONFIRMATION when handler false", async () => {
    setConfirmationHandler(async () => false);
    const created = holdsStore.create({ lineItems: [{ sku: validSku, qty: 1 }], ttlMinutes: 15 }, null, new Date());
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const hid = created.data.hold.hold_id;
    const res = await runTool("confirm_fulfillment", { holdId: hid });
    expect(res.structuredContent.ok).toBe(false);
    if (!res.structuredContent.ok) expect(res.structuredContent.error.code).toBe("NEEDS_CONFIRMATION");
    expect(holdsStore.get(hid)?.status).toBe("held");
  });
});
