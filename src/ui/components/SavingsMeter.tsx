import * as React from "react";
import type { SavingsMeter as SavingsMeterType } from "src/engine/types.ts";
import { useSession } from "src/ui/state/session.ts";
import { CountUp } from "src/ui/components/CountUp.tsx";

// FR-15 · visual_identity_plan.md §7.7 — the claim "25 min → 3 min" is
// demonstrated, not asserted: two bars compare the manual baseline against this
// batch, and the original sentence stays underneath as the literal readout.

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

  // Bar widths are proportional to the baseline, so "this batch" reads as the
  // sliver of the manual cost that it actually is.
  const baselineMin = Math.max(1, meter.baseline_minutes);
  const actualPct = Math.max(2, Math.min(100, (meter.elapsed_ms / 60000 / baselineMin) * 100));

  return (
    <div className="of-meter">
      <div className="of-meter__top">
        <span className="of-meter__value">
          <CountUp value={saved_min} />
        </span>
        <span className="of-meter__unit">min saved{degradedSuffix}</span>
        <span className="of-meter__stats">
          <span>{meter.tool_calls} tool calls</span>
          <span>{meter.confirmations} confirmation(s)</span>
          <span>{elapsed_s}s</span>
        </span>
      </div>

      <div className="of-meter__bars" aria-hidden="true">
        <div className="of-bar of-bar--baseline">
          <span>Manual</span>
          <span className="of-bar__track">
            <span className="of-bar__fill" style={{ width: "100%" }} />
          </span>
          <span>{meter.baseline_minutes} min</span>
        </div>
        <div className="of-bar of-bar--actual">
          <span>This batch</span>
          <span className="of-bar__track">
            <span className="of-bar__fill" style={{ width: `${actualPct}%` }} />
          </span>
          <span>{elapsed_s}s</span>
        </div>
      </div>

      {/* The literal readout — unchanged wording, and the accessible summary. */}
      <div className="of-meter__readout">
        {meter.tool_calls} tool calls · {meter.confirmations} confirmation(s) · {elapsed_s}s — manual baseline 25 min / 120 clicks — saved ~{saved_min} min{degradedSuffix}
      </div>
    </div>
  );
}
