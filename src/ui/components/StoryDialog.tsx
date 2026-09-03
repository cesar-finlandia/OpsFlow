// Requirement IDs: FR-13, NFR-09 | DP-UI · visual_identity_plan.md §7.11
//
// "How it works" — the header affordance that answers the first question any
// visitor has: what is this console for, and who is it for? It renders
// ./real-life-usecase-opsflow.md (product copy co-located with this component),
// imported at build time, so the story a judge reads on the page and the story
// in the repository are the same file and cannot drift apart.
//
// It is modal because it is a full document that takes the screen; it uses the
// same focus-trap contract as the confirmation gate (NFR-09) but never borrows
// the gate's amber — nothing here commits anything (§3.1).

import * as React from "react";
import { createPortal } from "react-dom";
import storySource from "./real-life-usecase-opsflow.md?raw";
import { Markdown } from "src/ui/components/Markdown.tsx";
import { CrossIcon, StoryIcon } from "src/ui/components/Icons.tsx";

const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

export function StoryDialog(): JSX.Element {
  const [open, setOpen] = React.useState(false);
  const dialogRef = React.useRef<HTMLDivElement | null>(null);
  const closeRef = React.useRef<HTMLButtonElement | null>(null);
  const openerRef = React.useRef<HTMLButtonElement | null>(null);

  React.useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const id = requestAnimationFrame(() => closeRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent): void {
      if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
        openerRef.current?.focus();
        return;
      }
      if (e.key !== "Tab" || !dialogRef.current) return;
      const nodes = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => !el.hasAttribute("disabled") && el.getAttribute("aria-hidden") !== "true",
      );
      if (nodes.length === 0) return;
      const first = nodes[0]!;
      const last = nodes[nodes.length - 1]!;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  function close(): void {
    setOpen(false);
    openerRef.current?.focus();
  }

  return (
    <>
      <button
        type="button"
        ref={openerRef}
        className="opsflow-story-btn"
        onClick={() => setOpen(true)}
        aria-expanded={open}
        data-testid="story-open"
      >
        <StoryIcon />
        How it works
      </button>
      {open &&
        createPortal(
          <>
            <div className="opsflow-dialog-backdrop of-story-backdrop" data-testid="story-backdrop" onClick={close} />
            <div
              ref={dialogRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby="story-title"
              tabIndex={-1}
              className="of-story"
              data-testid="story-dialog"
            >
              <header className="of-story__head">
                <div>
                  <span className="of-story__eyebrow">The use case, end to end</span>
                  <h2 id="story-title">How OpsFlow is used</h2>
                </div>
                <button type="button" ref={closeRef} className="of-icon-btn" onClick={close} aria-label="Close this document">
                  <CrossIcon />
                </button>
              </header>
              <div className="of-story__body" tabIndex={0}>
                <Markdown source={storySource} />
              </div>
            </div>
          </>,
          document.body,
        )}
    </>
  );
}
