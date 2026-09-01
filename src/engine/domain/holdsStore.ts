// DP-DOM holdsStore — singleton with validation and persistence
import type { Hold, HoldOrderInput, ShippingQuote, ToolOutcome, HoldOrderOutput, ConfirmFulfillmentOutput } from "../types.ts";
import { loadConfig } from "../config.ts";
import { makeToolError, ok } from "./errors.ts";
import { createHold, confirmHold, isExpired } from "./holds.ts";
import { loadCatalog, variantBySku } from "./catalog.ts";

const STORAGE_KEY = "opsflow.holds.v1";
let memory: Hold[] = [];
let subscribers: Array<(holds: Hold[]) => void> = [];
let warned = false;

function warnOnce(msg: string): void {
  if (!warned) {
    warned = true;
    try { console.warn(msg); } catch {}
  }
}

function readHolds(): void {
  try {
    if (typeof localStorage === "undefined") return;
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as { version: string; holds: Hold[] };
    if (Array.isArray(parsed.holds)) memory = parsed.holds;
  } catch (e) {
    warnOnce("[holdsStore] read failed, using memory only: " + String(e));
  }
}

function persistHolds(): void {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: "1.0.0", holds: memory }));
  } catch (e) {
    warnOnce("[holdsStore] write failed, memory only: " + String(e));
  }
}

function notify(): void {
  const snap = [...memory];
  for (const fn of subscribers) {
    try { fn(snap); } catch {}
  }
}

try { readHolds(); } catch {}

export const holdsStore = {
  create(input: HoldOrderInput, quote: ShippingQuote | null, now: Date = new Date()): ToolOutcome<HoldOrderOutput> {
    let min = 1, max = 120;
    try { const c = loadConfig(); min = c.holds.min_ttl_minutes; max = c.holds.max_ttl_minutes; } catch {}
    if (!Number.isInteger(input.ttlMinutes) || input.ttlMinutes < min || input.ttlMinutes > max) {
      return makeToolError("INVALID_INPUT", `ttlMinutes must be integer ${min}..${max}`, { ttlMinutes: input.ttlMinutes });
    }
    if (!Array.isArray(input.lineItems) || input.lineItems.length === 0) {
      return makeToolError("INVALID_INPUT", "lineItems must be non-empty array");
    }
    if (input.lineItems.length > 50) {
      return makeToolError("INVALID_INPUT", "lineItems > 50");
    }
    try {
      const cat = loadCatalog();
      for (const li of input.lineItems) {
        if (!li.sku || typeof li.sku !== "string") return makeToolError("INVALID_INPUT", "each lineItem needs sku");
        if (!Number.isInteger(li.qty) || li.qty < 1 || li.qty > 999) return makeToolError("INVALID_INPUT", `qty for ${li.sku} must be 1..999`);
        if (!variantBySku(cat, li.sku)) return makeToolError("NOT_FOUND", `unknown sku ${li.sku}`, { sku: li.sku });
      }
    } catch {
      // if catalog load fails, still validate shape without sku existence
      for (const li of input.lineItems) {
        if (!li.sku || typeof li.sku !== "string") return makeToolError("INVALID_INPUT", "each lineItem needs sku");
        if (!Number.isInteger(li.qty) || li.qty < 1 || li.qty > 999) return makeToolError("INVALID_INPUT", `qty for ${li.sku} must be 1..999`);
      }
    }
    if (input.note !== undefined && input.note !== null && typeof input.note === "string" && input.note.length > 200) {
      return makeToolError("INVALID_INPUT", "note must be <= 200 chars");
    }
    const hold = createHold(input, quote, now);
    memory.push(hold);
    persistHolds();
    notify();
    return ok({ hold, requires_confirmation: true as const });
  },
  confirm(holdId: string, now: Date = new Date()): ToolOutcome<ConfirmFulfillmentOutput> {
    const idx = memory.findIndex((h) => h.hold_id === holdId);
    if (idx === -1) return makeToolError("NOT_FOUND", `unknown hold ${holdId}`, { holdId });
    const hold = memory[idx];
    if (isExpired(hold, now) && hold.status === "held") {
      hold.status = "expired";
      persistHolds();
      notify();
      return makeToolError("EXPIRED", `Hold ${holdId} expired at ${hold.expires_at}`);
    }
    const res = confirmHold(hold, now);
    if (res.ok) { persistHolds(); notify(); }
    if (!res.ok && (res.error.code === "EXPIRED" || res.error.code === "CONFLICT")) {
      persistHolds();
    }
    return res;
  },
  release(holdId: string): ToolOutcome<Hold> {
    const idx = memory.findIndex((h) => h.hold_id === holdId);
    if (idx === -1) return makeToolError("NOT_FOUND", `unknown hold ${holdId}`);
    const h = memory[idx];
    if (h.status === "confirmed") return makeToolError("CONFLICT", `hold ${holdId} already confirmed`);
    if (h.status === "released") return makeToolError("CONFLICT", `hold ${holdId} already released`);
    h.status = "released";
    persistHolds();
    notify();
    return ok(h);
  },
  get(holdId: string): Hold | null {
    return memory.find((h) => h.hold_id === holdId) ?? null;
  },
  list(): Hold[] {
    return [...memory];
  },
  subscribe(fn: (holds: Hold[]) => void): () => void {
    subscribers.push(fn);
    return () => { subscribers = subscribers.filter((f) => f !== fn); };
  },
  reset(): void {
    memory = [];
    subscribers = [];
    warned = false;
    try { if (typeof localStorage !== "undefined") localStorage.removeItem(STORAGE_KEY); } catch {}
    notify();
  },
};
