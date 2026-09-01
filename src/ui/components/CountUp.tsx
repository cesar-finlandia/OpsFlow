// Requirement IDs: FR-15 | DP-UI · visual_identity_plan.md §7.7
//
// A requestAnimationFrame count-up for the savings figure. Kept hand-rolled so
// the console adds no runtime animation dependency to the NFR-10 cold-load
// budget (§8.1); `@number-flow/react` is the drop-in replacement if that budget
// ever relaxes. Under prefers-reduced-motion it renders the final value at once.

import * as React from "react";

function prefersReducedMotion(): boolean {
  return typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function CountUp({
  value,
  duration = 900,
  className,
}: {
  value: number;
  duration?: number;
  className?: string;
}): JSX.Element {
  const [shown, setShown] = React.useState(() => (prefersReducedMotion() ? value : 0));

  React.useEffect(() => {
    if (prefersReducedMotion() || typeof requestAnimationFrame !== "function") {
      setShown(value);
      return;
    }
    const from = 0;
    const started = performance.now();
    let frame = 0;
    const tick = (now: number): void => {
      const t = Math.min(1, (now - started) / duration);
      // ease-out cubic — fast, then settles, so the eye lands on the final digit
      const eased = 1 - Math.pow(1 - t, 3);
      setShown(Math.round(from + (value - from) * eased));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, duration]);

  return <span className={className}>{shown}</span>;
}
