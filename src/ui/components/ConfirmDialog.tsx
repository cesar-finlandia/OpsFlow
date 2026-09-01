import * as React from "react";
import type { ToolName } from "src/engine/types.ts";

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
      <div data-testid="confirm-backdrop" onClick={() => onResolve(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 999 }} />
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="confirm-title" tabIndex={-1} style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)", background: "white", color: "black", padding: 24, zIndex: 1000, minWidth: 320, maxWidth: 600 }}>
        <h2 id="confirm-title">Confirm {request.tool}</h2>
        <p>{request.summary}</p>
        <pre style={{ background: "#f5f5f5", padding: 12, overflow: "auto", maxHeight: 200 }}>{JSON.stringify(request.args, null, 2)}</pre>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
          <button type="button" onClick={() => onResolve(false)}>Cancel</button>
          <button type="button" className="opsflow-primary" ref={confirmBtnRef} data-testid="confirm-action" onClick={() => onResolve(true)}>Confirm</button>
        </div>
      </div>
    </>
  );
}
