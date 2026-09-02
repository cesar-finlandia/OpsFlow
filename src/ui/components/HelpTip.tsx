// Requirement IDs: NFR-09 | DP-UI · visual_identity_plan.md §7.10
//
// The inline help affordance: a small "?" button that opens a short popover
// explaining one thing — a screen, a button, a column. Maya is not an engineer
// and has no onboarding call, so every non-obvious control carries one.
//
// Three constraints shaped the implementation:
//   1. The popover is portalled to <body>. The tablist and the table wrappers
//      both scroll on overflow, and an in-flow popover would be clipped by them.
//   2. It is role="note", never role="dialog": the E2E suite asserts a single
//      dialog (the confirmation gate), and help must never look like a gate.
//   3. Accessible names avoid the verbs the test suite queries by
//      ("Confirm", "Release", "Run batch", …) so a help button can never be
//      mistaken for the control it describes (visual_identity_plan.md §11.1).

import * as React from "react";
import { createPortal } from "react-dom";

const MARGIN = 12;
const WIDTH = 320;

export interface HelpTipProps {
  /** Accessible name of the trigger, e.g. "About the Batch screen". */
  label: string;
  /** Bold first line inside the popover. */
  title: string;
  /** The explanation itself. */
  children: React.ReactNode;
  /** Anchor the popover's right edge to the button (for controls near the right edge). */
  align?: "start" | "end";
  className?: string;
}

export function HelpTip({ label, title, children, align = "start", className }: HelpTipProps): JSX.Element {
  const id = React.useId();
  const popId = `help-${id}`;
  const [open, setOpen] = React.useState(false);
  const [pos, setPos] = React.useState<{ top: number; left: number } | null>(null);
  const btnRef = React.useRef<HTMLButtonElement | null>(null);
  const popRef = React.useRef<HTMLDivElement | null>(null);

  // Clamped horizontally, flipped vertically. A help popover that runs off the
  // bottom of a laptop screen is the one place inline help actively hurts.
  const place = React.useCallback(() => {
    const btn = btnRef.current;
    if (!btn) return;
    const r = btn.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const width = Math.min(WIDTH, vw - MARGIN * 2);
    const raw = align === "end" ? r.right - width : r.left - 8;
    const left = Math.max(MARGIN, Math.min(raw, vw - width - MARGIN));
    const h = popRef.current?.offsetHeight ?? 0;
    const below = r.bottom + 8;
    const flip = h > 0 && below + h + MARGIN > vh && r.top - 8 - h > MARGIN;
    setPos({ top: flip ? r.top - 8 - h : below, left });
  }, [align]);

  React.useLayoutEffect(() => {
    if (!open) {
      setPos(null);
      return;
    }
    place();
  }, [open, place]);

  React.useEffect(() => {
    if (!open) return;
    function onDocPointer(e: MouseEvent): void {
      const t = e.target as Node;
      if (btnRef.current?.contains(t) || popRef.current?.contains(t)) return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent): void {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      setOpen(false);
      btnRef.current?.focus();
    }
    function onMove(): void {
      place();
    }
    document.addEventListener("pointerdown", onDocPointer, true);
    document.addEventListener("keydown", onKey, true);
    window.addEventListener("scroll", onMove, true);
    window.addEventListener("resize", onMove);
    return () => {
      document.removeEventListener("pointerdown", onDocPointer, true);
      document.removeEventListener("keydown", onKey, true);
      window.removeEventListener("scroll", onMove, true);
      window.removeEventListener("resize", onMove);
    };
  }, [open, place]);

  // The tab strip owns ArrowLeft/ArrowRight for tab switching. A help button
  // lives inside it, so an open popover must not let arrow keys walk away from
  // the explanation the operator is mid-way through reading.
  function onKeyDown(e: React.KeyboardEvent): void {
    if (open && (e.key === "ArrowLeft" || e.key === "ArrowRight")) e.stopPropagation();
  }

  return (
    <span className={className ? `of-help ${className}` : "of-help"} onKeyDown={onKeyDown}>
      <button
        type="button"
        ref={btnRef}
        className="of-help__btn"
        aria-label={label}
        title={label}
        aria-expanded={open}
        aria-controls={open ? popId : undefined}
        onClick={() => setOpen((v) => !v)}
      >
        <svg width="13" height="13" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
          <circle cx="8" cy="8" r="7" className="of-help__ring" />
          <path d="M5.9 6.1a2.1 2.1 0 1 1 2.6 2.05c-.4.12-.6.42-.6.83v.42" className="of-help__glyph" />
          <circle cx="8" cy="12" r="0.95" className="of-help__dot" />
        </svg>
      </button>
      {open &&
        createPortal(
          <div
            ref={popRef}
            id={popId}
            role="note"
            className="of-help__pop"
            style={
              pos === null
                ? { top: 0, left: 0, visibility: "hidden", width: `${WIDTH}px` }
                : { top: `${pos.top}px`, left: `${pos.left}px`, width: `${Math.min(WIDTH, window.innerWidth - MARGIN * 2)}px` }
            }
          >
            <span className="of-help__title">{title}</span>
            <div className="of-help__body">{children}</div>
          </div>,
          document.body,
        )}
    </span>
  );
}
