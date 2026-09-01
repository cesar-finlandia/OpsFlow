// Requirement IDs: FR-06 | DP-UI · visual_identity_plan.md §7.6
//
// Hold TTL countdown ring. Gate amber while the hold is live, Fault red under a
// minute, desaturated once expired. The mm:ss text beside it is the source of
// truth — the ring is a peripheral-vision cue, never the only signal.

import * as React from "react";

const R = 8;
const C = 2 * Math.PI * R;

export function TtlRing({
  remaining,
  total,
  expired,
}: {
  /** Seconds left. */
  remaining: number;
  /** Seconds the hold was granted, used to scale the arc. */
  total: number;
  expired: boolean;
}): JSX.Element {
  const ratio = expired || total <= 0 ? 0 : Math.min(1, Math.max(0, remaining / total));
  const urgent = !expired && remaining > 0 && remaining <= 60;
  const cls = `of-ttl__ring${urgent ? " of-ttl--urgent" : ""}${expired ? " of-ttl--expired" : ""}`;
  return (
    <svg className={cls} width="20" height="20" viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <circle className="of-ttl__track" cx="10" cy="10" r={R} />
      <circle
        className="of-ttl__value"
        cx="10"
        cy="10"
        r={R}
        strokeDasharray={C}
        strokeDashoffset={C * (1 - ratio)}
      />
    </svg>
  );
}
