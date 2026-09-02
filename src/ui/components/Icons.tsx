// Requirement IDs: FR-13 | DP-UI · visual_identity_plan.md §2.2, §7
//
// Inline SVG icon set. Zero dependencies on the critical path (§8.1): every
// glyph is a handful of paths, stroked at 1.75 and inheriting currentColor,
// so a theme swap recolours them with no JS.

import * as React from "react";

type IconProps = { size?: number; className?: string };

const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

/**
 * The Signal mark (§2.2) — five nodes, one per tool in the frozen chain, with
 * `hold_order` drawn as an open ring because that is where the human hand
 * enters. The mark is a legend for the product, not decoration.
 */
export function SignalMark({ size = 16, className = "opsflow-mark" }: IconProps): JSX.Element {
  const xs = [5, 19.5, 34, 48.5, 63];
  return (
    <svg
      className={className}
      width={(size * 68) / 16}
      height={size}
      viewBox="0 0 68 16"
      aria-hidden="true"
      focusable="false"
    >
      <path className="of-mark__wire" d="M5 8 H63" />
      {xs.map((x, i) =>
        i === 3 ? (
          <circle key={x} className="of-mark__gate" cx={x} cy={8} r={3.4} />
        ) : (
          <circle key={x} className="of-mark__node" cx={x} cy={8} r={2.4} />
        ),
      )}
    </svg>
  );
}

export function CheckIcon({ size = 12, className }: IconProps): JSX.Element {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" className={className} aria-hidden="true" focusable="false">
      <path d="M2.5 6.3 L4.8 8.6 L9.5 3.6" {...stroke} />
    </svg>
  );
}

export function CrossIcon({ size = 12, className }: IconProps): JSX.Element {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" className={className} aria-hidden="true" focusable="false">
      <path d="M3.4 3.4 L8.6 8.6 M8.6 3.4 L3.4 8.6" {...stroke} />
    </svg>
  );
}

/** Tool Inspector affordance — a schema/registry glyph, not a generic gear. */
export function InspectIcon({ size = 15, className }: IconProps): JSX.Element {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" className={className} aria-hidden="true" focusable="false">
      <rect x="2" y="2.5" width="12" height="11" rx="2" {...stroke} />
      <path d="M2 6h12M5.5 9h5M5.5 11h3" {...stroke} />
    </svg>
  );
}

/** The human gate — a hand-stop, used as the confirmation dialog's eyebrow. */
export function GateIcon({ size = 13, className }: IconProps): JSX.Element {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" className={className} aria-hidden="true" focusable="false">
      <path d="M8 1.6 L13.7 4.1 v3.6 c0 3.2-2.3 5.6-5.7 6.7-3.4-1.1-5.7-3.5-5.7-6.7V4.1Z" {...stroke} />
      <path d="M8 6v3.4" {...stroke} />
      <circle cx="8" cy="11.4" r="0.75" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** Committed — a drawn check in a ring, used on the fulfilment banner. */
export function CommittedIcon({ size = 18, className }: IconProps): JSX.Element {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" className={className} aria-hidden="true" focusable="false">
      <circle cx="10" cy="10" r="8.2" fill="none" stroke="currentColor" strokeWidth={1.5} opacity={0.35} />
      <path d="M6 10.4 L8.8 13.2 L14.2 6.9" />
    </svg>
  );
}

/** The product story — an open document, used by the header "How it works". */
export function StoryIcon({ size = 15, className }: IconProps): JSX.Element {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" className={className} aria-hidden="true" focusable="false">
      <path d="M8 4.1C6.9 3.1 5.4 2.7 3.6 2.9a.7.7 0 0 0-.6.7v7.6c0 .4.4.8.8.7 1.5-.1 3 .3 4.2 1.2 1.2-.9 2.7-1.3 4.2-1.2.4 0 .8-.3.8-.7V3.6a.7.7 0 0 0-.6-.7c-1.8-.2-3.3.2-4.4 1.2Z" {...stroke} />
      <path d="M8 4.1v9" {...stroke} />
    </svg>
  );
}
