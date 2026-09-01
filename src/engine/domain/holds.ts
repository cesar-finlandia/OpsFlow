import type { Hold, HoldOrderInput, ShippingQuote, ToolOutcome, ConfirmFulfillmentOutput } from "../types.ts";
import { makeToolError, ok } from "./errors.ts";

// private to DP-DOM — do not import
// Crockford base32 alphabet (no 0/1/8/9/O/I/L/U to avoid confusion)
const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function newHoldId(rand: () => number = Math.random): string {
  let s = "";
  for (let i = 0; i < 8; i++) s += alphabet[Math.floor(rand() * alphabet.length)];
  return "HOLD-" + s;
}

export function newFulfillmentId(rand: () => number = Math.random): string {
  let s = "";
  for (let i = 0; i < 8; i++) s += alphabet[Math.floor(rand() * alphabet.length)];
  return "FUL-" + s;
}

/**
 * Pure check whether a hold has expired.
 * Never throws — returns false on malformed dates.
 */
export function isExpired(hold: Hold, now: Date): boolean {
  try {
    return new Date(now).getTime() >= new Date(hold.expires_at).getTime();
  } catch {
    return false;
  }
}

/**
 * Deterministic hold construction; `now` is injected for determinism.
 * hold_id via newHoldId, timestamps ISO-8601, expires_at = created_at + ttlMinutes.
 */
export function createHold(input: HoldOrderInput, quote: ShippingQuote | null, now: Date): Hold {
  try {
    const created = now.toISOString();
    const expires = new Date(now.getTime() + input.ttlMinutes * 60000).toISOString();
    return {
      hold_id: newHoldId(),
      line_items: input.lineItems.map((li) => ({ sku: li.sku, qty: li.qty })),
      created_at: created,
      expires_at: expires,
      ttl_minutes: input.ttlMinutes,
      status: "held",
      note: input.note ? input.note.slice(0, 200) : null,
      quote,
    };
  } catch {

    // Never throw — return minimal held hold on unexpected error (should not happen with valid inputs)
    const fallbackNow = new Date();
    const created = fallbackNow.toISOString();
    const expires = new Date(fallbackNow.getTime() + 15 * 60000).toISOString();
    return {
      hold_id: newHoldId(),
      line_items: [],
      created_at: created,
      expires_at: expires,
      ttl_minutes: 15,
      status: "held",
      note: null,
      quote: null,
    };
  }
}

/**
 * Confirm a held hold, returning a Fulfillment on success.
 * Never throws — failures returned as ToolOutcome.
 *
 * Idempotence: a second confirm of the same hold returns CONFLICT, not a second fulfillment —
 * the hold's status is already "confirmed" so the guard returns CONFLICT.
 * Similarly, released/expired holds return CONFLICT/EXPIRED.
 * If the hold has passed its expires_at, status is mutated to "expired" and EXPIRED is returned.
 */
export function confirmHold(hold: Hold, now: Date): ToolOutcome<ConfirmFulfillmentOutput> {
  try {
    if (hold.status === "confirmed") return makeToolError("CONFLICT", `Hold ${hold.hold_id} already confirmed`);
    if (hold.status === "released") return makeToolError("CONFLICT", `Hold ${hold.hold_id} was released`);
    if (hold.status === "expired") return makeToolError("EXPIRED", `Hold ${hold.hold_id} expired`);
    if (isExpired(hold, now)) {
      hold.status = "expired";
      return makeToolError("EXPIRED", `Hold ${hold.hold_id} expired at ${hold.expires_at}`);
    }
    const fulfillment = {
      fulfillment_id: newFulfillmentId(),
      hold_id: hold.hold_id,
      confirmed_at: now.toISOString(),
      line_items: [...hold.line_items],
      total_cents: hold.quote ? hold.quote.total_cents : 0,
    };
    hold.status = "confirmed";
    return ok({ fulfillment, hold });
  } catch {
    return makeToolError("INVALID_INPUT", "confirmHold failed");
  }
}
