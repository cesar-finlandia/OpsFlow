import * as React from "react";
import { holdsStore } from "src/engine/domain/holdsStore.ts";
import { publisher as globalPublisher, onEnvelope } from "src/engine/envelopes.ts";
import type { EventEnvelope } from "src/platform/transport";
import type { Hold, ShippingQuote, SavingsMeter } from "src/engine/types.ts";
import baseline from "data/baseline.json";

const BASELINE_MINUTES = (baseline as { baseline_minutes: number }).baseline_minutes;
const BASELINE_CLICKS = (baseline as { baseline_clicks: number }).baseline_clicks;

function emptyMeter(): SavingsMeter {
  return { tool_calls: 0, confirmations: 0, elapsed_ms: 0, baseline_minutes: BASELINE_MINUTES, baseline_clicks: BASELINE_CLICKS };
}

let _envelopes: EventEnvelope[] = [];
let _seen = new Set<string>();
let _holds: Hold[] = [];
let _resultSkus: string[] = [];
let _lastQuote: ShippingQuote | null = null;
let _meter: SavingsMeter = emptyMeter();
let _traceStartMs: number | null = null;
let _degraded = false;

const listeners = new Set<() => void>();

// DP-TOOLS reads the current result set and the last quote through two narrow
// read-only accessors on globalThis (DP-TOOLS §7: "sessionResultSkus() — reads
// the last successful search_inventory/filter_variants SKUs … DP-UI exposes
// getLastResultSkus()"). Publishing them here is what lets `filter_variants`
// narrow the *previous* result set (FR-03) and lets `hold_order` attach the
// quote produced by the preceding `calculate_shipping` step. Without this
// bridge both tools silently operate on an empty context.
function publishSessionAccessors(): void {
  try {
    const g = globalThis as unknown as Record<string, unknown>;
    g["__opsflow_getLastResultSkus"] = (): string[] => [..._resultSkus];
    g["__opsflow_lastQuote"] = _lastQuote;
  } catch {
    // a locked-down global object must never break the session
  }
}

function notify(): void {
  publishSessionAccessors();
  listeners.forEach((fn) => fn());
}

export function sessionResultSkus(): string[] { return [..._resultSkus]; }
export function lastQuote(): ShippingQuote | null { return _lastQuote; }

function envelopeKey(e: EventEnvelope): string {
  return `${e.step_id}|${e.status}|${e.sequence}|${e.timestamp}`;
}

/**
 * The single ingestion point for envelopes. Both sources (the synchronous
 * in-page fan-out and the publisher-snapshot backstop) route through it, so a
 * step is counted exactly once no matter how many paths deliver it.
 */
function ingest(env: EventEnvelope): boolean {
  const key = envelopeKey(env);
  if (_seen.has(key)) return false;
  _seen.add(key);
  _envelopes = [..._envelopes, env];

  if ((env as { degraded?: boolean }).degraded === true) _degraded = true;

  if (env.status === "started" && typeof env.step_id === "string" && env.step_id.startsWith("tool.")) {
    if (_traceStartMs === null) _traceStartMs = Date.now();
    _meter = { ..._meter, tool_calls: _meter.tool_calls + 1 };
  }
  if (env.step_id === "session.confirm" && env.status === "done") {
    const granted = (env.payload as { granted?: boolean })?.granted === true;
    if (granted) _meter = { ..._meter, confirmations: _meter.confirmations + 1 };
  }
  if (_traceStartMs !== null) _meter = { ..._meter, elapsed_ms: Date.now() - _traceStartMs };

  if ((env.step_id === "tool.search_inventory" || env.step_id === "tool.filter_variants") && env.status === "done") {
    const outcome = (env.payload as { outcome?: { ok: boolean; data?: { matches?: Array<{ sku: string }> } } })?.outcome;
    if (outcome?.ok && outcome.data?.matches) _resultSkus = outcome.data.matches.map((m) => m.sku);
  }
  if (env.step_id === "tool.calculate_shipping" && env.status === "done") {
    const outcome = (env.payload as { outcome?: { ok: boolean; data?: ShippingQuote } })?.outcome;
    if (outcome?.ok && outcome.data) _lastQuote = outcome.data;
  }
  return true;
}

// Note on transport: the chassis `useEventStream()` hook is deliberately NOT
// composed here. It subscribes to `GET /events/stream` and falls back to
// `GET /events`, and §2.6 freezes the HTTP API at five routes — neither of those
// exists, by design, because every tool executes *in the page* and the publisher
// is the in-memory one (§2.10 row 3). Mounting the hook produced nothing but a
// repeating 404 loop in the browser console on every page load. The synchronous
// fan-out below is this app's transport.
//
// Subscribed at module scope, not inside a React effect: `runTool` emits its
// `done` envelope and the orchestrator starts the next step in the same tick,
// so the result set must be current before any component re-renders.
onEnvelope((env) => {
  if (ingest(env as EventEnvelope)) notify();
});

publishSessionAccessors();

export function useSession(): { envelopes: EventEnvelope[]; degraded: boolean; holds: Hold[]; meter: SavingsMeter; lastQuote: ShippingQuote | null; resultSkus: string[] } {
  const [, bump] = React.useState(0);

  React.useEffect(() => {
    const fn = () => bump((x) => x + 1);
    listeners.add(fn);
    return () => { listeners.delete(fn); };
  }, []);

  React.useEffect(() => {
    _holds = holdsStore.list();
    const unsub = holdsStore.subscribe((holds) => { _holds = [...holds]; notify(); });
    return unsub;
  }, []);

  // Backstop for envelopes published by a module instance that does not share
  // this one's fan-out (e.g. a duplicated bundle chunk): drain the publisher's
  // collected snapshot through the same deduplicated ingestion point.
  React.useEffect(() => {
    let cancelled = false;
    const poll = (): void => {
      if (cancelled) return;
      try {
        const snap = (globalPublisher as unknown as { collect?: (id?: string) => { events: EventEnvelope[] } | null }).collect?.();
        const events: EventEnvelope[] = (snap?.events as EventEnvelope[]) ?? [];
        let changed = false;
        for (const env of events) changed = ingest(env) || changed;
        if (changed) notify();
      } catch {
        // the backstop must never surface an error
      }
      if (!cancelled) setTimeout(poll, 400);
    };
    poll();
    return () => { cancelled = true; };
  }, []);

  return { envelopes: _envelopes, degraded: _degraded, holds: _holds, meter: _meter, lastQuote: _lastQuote, resultSkus: _resultSkus };
}

export function resetSessionForTests(): void {
  _envelopes = [];
  _seen = new Set<string>();
  _holds = [];
  _resultSkus = [];
  _lastQuote = null;
  _meter = emptyMeter();
  _traceStartMs = null;
  _degraded = false;
  publishSessionAccessors();
}
