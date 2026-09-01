// Requirement IDs: FR-14, FR-18 | DP-UI · visual_identity_plan.md §7.4, §10
//
// The timeline's status glyph. Colour encodes agency (§3.1) but never carries
// the meaning alone: running has a halo, done a drawn check, error a cross,
// degraded a slow breathe — and the row's own text states the status anyway.

import * as React from "react";
import { CheckIcon, CrossIcon } from "src/ui/components/Icons.tsx";

export type DotStatus = "running" | "done" | "error" | "degraded";

export function StatusDot({ status }: { status: DotStatus }): JSX.Element {
  return (
    <span className={`of-dot of-dot--${status}`} aria-hidden="true">
      {status === "done" && <CheckIcon size={8} />}
      {status === "error" && <CrossIcon size={8} />}
    </span>
  );
}
