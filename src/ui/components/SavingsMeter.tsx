import * as React from "react";
import type { SavingsMeter as SavingsMeterType } from "src/engine/types.ts";
import { useSession } from "src/ui/state/session.ts";

export function SavingsMeter({ meter }: { meter: SavingsMeterType }): JSX.Element {
  const elapsed_s = Math.round(meter.elapsed_ms / 1000);
  const saved_min = Math.max(0, meter.baseline_minutes - Math.round(meter.elapsed_ms / 60000));
  let degradedSuffix = "";
  try {
    const session = useSession();
    if (session.degraded) degradedSuffix = " (degraded)";
  } catch {
    // outside provider (unit test) — no suffix
  }
  return <div>{meter.tool_calls} tool calls · {meter.confirmations} confirmation(s) · {elapsed_s}s — manual baseline 25 min / 120 clicks — saved ~{saved_min} min{degradedSuffix}</div>;
}
