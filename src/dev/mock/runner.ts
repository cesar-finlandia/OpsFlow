// DP-MOCK stub — satisfies demodrive feeder import (src/ideation/demodrive/feeder.ts)
// Implements runMock publisher replay per TRN-04 / MOCK-01.
// Minimal implementation: reads demo/mock-script.json envelopes and replays via publisher.publish.

import { readFileSync } from "node:fs";

export async function runMock(opts: {
  scriptPath?: string;
  realtime?: boolean;
  publisher: { publish: (opts: { stepId: string; status: string; payload: Record<string, unknown>; traceId?: string; degraded?: boolean }) => Promise<void> };
}): Promise<void> {
  const path = opts.scriptPath ?? "demo/mock-script.json";
  let raw: string;
  try {
    raw = readFileSync(path, "utf8");
  } catch {
    return;
  }
  const script = JSON.parse(raw) as {
    envelopes: Array<{ step_id: string; status: string; payload: Record<string, unknown>; delay_ms?: number; trace_id?: string; degraded?: boolean }>;
  };
  for (const env of script.envelopes ?? []) {
    const delay = opts.realtime === false ? 0 : (env.delay_ms ?? 0);
    if (delay > 0) await new Promise((r) => setTimeout(r, delay));
    await opts.publisher.publish({
      stepId: env.step_id,
      status: env.status,
      payload: env.payload ?? {},
      traceId: env.trace_id,
      degraded: env.degraded,
    });
  }
}
