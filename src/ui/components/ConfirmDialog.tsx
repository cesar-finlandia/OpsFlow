import * as React from "react";
import type { ToolName } from "src/engine/types.ts";
import { GateIcon } from "src/ui/components/Icons.tsx";
import { HelpTip } from "src/ui/components/HelpTip.tsx";

type Req = { tool: ToolName; args: Record<string, unknown>; summary: string };

let queue: Array<{ req: Req; resolve: (granted: boolean) => void }> = [];
let current: { req: Req; resolve: (granted: boolean) => void } | null = null;
let setDialogRequest: ((req: Req | null) => void) | null = null;

export function uiConfirm(req: Req): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    queue.push({ req, resolve });
    pump();
  });
}
function pump(): void {
  if (current !== null) return;
  const next = queue.shift();
  if (!next) return;
  current = next;
  setDialogRequest?.(current.req);
}
function resolveCurrent(granted: boolean): void {
  if (!current) return;
  const c = current;
  current = null;
  setDialogRequest?.(null);
  c.resolve(granted);
  pump();
}
export function useConfirmDialogState(): { request: Req | null; onResolve: (granted: boolean) => void; register: (setter: (req: Req | null) => void) => () => void } {
  const [request, setRequest] = React.useState<Req | null>(null);
  React.useEffect(() => {
    setDialogRequest = setRequest;
    return () => {
      if (current) { const c = current; current = null; c.resolve(false); }
      queue.forEach(({ resolve }) => resolve(false));
      queue = [];
      setDialogRequest = null;
    };
  }, []);
  React.useEffect(() => { if (request === null && current !== null) setRequest(current.req); }, [request]);
  return { request, onResolve: resolveCurrent, register: (setter) => { setDialogRequest = setter; return () => { setDialogRequest = null; }; } };
}
export function ConfirmDialog({ request, onResolve }: { request: Req | null; onResolve: (granted: boolean) => void }): JSX.Element | null {
  const dialogRef = React.useRef<HTMLDivElement | null>(null);
  const confirmBtnRef = React.useRef<HTMLButtonElement | null>(null);
  const prevActiveRef = React.useRef<Element | null>(null);

  React.useEffect(() => {
    if (!request) return;
    prevActiveRef.current = document.activeElement;
    // focus immediately and also via rAF for jsdom timing
    confirmBtnRef.current?.focus();
    const id = requestAnimationFrame(() => confirmBtnRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, [request]);

  React.useEffect(() => {
    if (!request) {
      const prev = prevActiveRef.current as HTMLElement | null;
      if (prev && typeof prev.focus === "function") {
        try { prev.focus(); } catch {}
      }
      prevActiveRef.current = null;
    }
  }, [request]);

  React.useEffect(() => {
    if (!request) return;
    function onKey(e: KeyboardEvent): void {
      if (e.key === "Escape") {
        e.preventDefault();
        onResolve(false);
      }
      if (e.key === "Tab" && dialogRef.current) {
        const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )).filter((el) => !el.hasAttribute("disabled") && el.getAttribute("aria-hidden") !== "true");
        if (focusable.length === 0) return;
        const first = focusable[0]!;
        const last = focusable[focusable.length - 1]!;
        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [request, onResolve]);

  if (!request) return null;

  return (
    <>
      <div data-testid="confirm-backdrop" className="opsflow-dialog-backdrop" onClick={() => onResolve(false)} />
      {/* The gate is the emotional peak of the product (§7.5): the backdrop blur
          makes the app visibly stop, the amber rail marks it as the one place a
          human decides, and the arguments stay literal — never summarised. */}
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="confirm-title" tabIndex={-1} className="opsflow-dialog">
        <span className="opsflow-dialog__eyebrow">
          <GateIcon />
          Awaiting your confirmation
          <HelpTip label="Why this stopped" title="The one place a human decides">
            <p>Three of the five tools only read data and run unattended. This is one of the two that change something real, so it stops here every time — for the console&apos;s own agent and for any outside agent alike.</p>
            <p>What you see below is not a summary. It is the literal, already-validated payload about to be sent. Dismissing this window sends nothing.</p>
          </HelpTip>
        </span>
        <h2 id="confirm-title">Confirm <span className="of-mono">{request.tool}</span></h2>
        <p>{request.summary}</p>
        <pre>{JSON.stringify(request.args, null, 2)}</pre>
        <div className="opsflow-dialog__actions">
          <button type="button" onClick={() => onResolve(false)}>Cancel</button>
          <button type="button" className="opsflow-primary" ref={confirmBtnRef} data-testid="confirm-action" onClick={() => onResolve(true)}>Confirm</button>
        </div>
      </div>
    </>
  );
}
