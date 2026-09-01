// Requirement IDs: NFR-09 | DP-UI · visual_identity_plan.md §4
//
// Colour mode ("light" | "dark") is orthogonal to the chassis theme slot.
// `setTheme("operator")` owns `data-theme` on <html> (src/platform/ui/theme.ts,
// never edited — NFR-05); this module owns `data-mode` on the same element.
//
// Resolution order (§4.1): explicit user choice in localStorage →
// prefers-color-scheme → "dark" (the console default, and what the demo records).

export type ColorMode = "light" | "dark";

export const MODE_STORAGE_KEY = "opsflow.theme.v1";

const DEFAULT_MODE: ColorMode = "dark";

function isMode(value: unknown): value is ColorMode {
  return value === "light" || value === "dark";
}

function storage(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    // Storage can throw in a partitioned/blocked context — never fatal here.
    return null;
  }
}

/** The user's explicit choice, or null if they have never expressed one. */
export function storedMode(): ColorMode | null {
  const raw = storage()?.getItem(MODE_STORAGE_KEY);
  return isMode(raw) ? raw : null;
}

/** What the OS asks for, when it asks for anything. */
export function systemMode(): ColorMode | null {
  if (typeof matchMedia !== "function") return null;
  if (matchMedia("(prefers-color-scheme: light)").matches) return "light";
  if (matchMedia("(prefers-color-scheme: dark)").matches) return "dark";
  return null;
}

export function resolveMode(): ColorMode {
  return storedMode() ?? systemMode() ?? DEFAULT_MODE;
}

/** The mode currently painted, read back off the document. */
export function currentMode(): ColorMode {
  const attr = typeof document === "undefined" ? null : document.documentElement.getAttribute("data-mode");
  return isMode(attr) ? attr : resolveMode();
}

function paint(mode: ColorMode): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.setAttribute("data-mode", mode);
  root.style.colorScheme = mode;
  const meta = document.querySelector('meta[name="color-scheme"]');
  if (meta) meta.setAttribute("content", mode);
}

type ViewTransitionDocument = Document & {
  startViewTransition?: (cb: () => void) => { finished: Promise<void> };
};

/**
 * Apply a mode. `origin` is the click point of the toggle: where the View
 * Transition wipe expands from (§4.3). Falls back to a short token cross-fade
 * where View Transitions are unavailable, and to an instant swap under
 * prefers-reduced-motion.
 */
export function applyMode(mode: ColorMode, origin?: { x: number; y: number }): void {
  if (typeof document === "undefined") {
    return;
  }
  const root = document.documentElement;
  const reduced = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (origin) {
    root.style.setProperty("--of-wipe-x", `${origin.x}px`);
    root.style.setProperty("--of-wipe-y", `${origin.y}px`);
  }

  const doc = document as ViewTransitionDocument;
  if (!reduced && typeof doc.startViewTransition === "function") {
    doc.startViewTransition(() => paint(mode));
    return;
  }

  if (!reduced) {
    root.classList.add("of-mode-anim");
    window.setTimeout(() => root.classList.remove("of-mode-anim"), 260);
  }
  paint(mode);
}

/** Persist and apply. Called by the header toggle. */
export function setMode(mode: ColorMode, origin?: { x: number; y: number }): ColorMode {
  storage()?.setItem(MODE_STORAGE_KEY, mode);
  applyMode(mode, origin);
  return mode;
}

export function toggleMode(origin?: { x: number; y: number }): ColorMode {
  return setMode(currentMode() === "dark" ? "light" : "dark", origin);
}

/**
 * Paint the resolved mode at boot, and keep following the OS until the user
 * makes an explicit choice. Returns an unsubscribe function.
 */
export function initMode(): () => void {
  paint(resolveMode());
  if (typeof matchMedia !== "function") return () => {};
  const mq = matchMedia("(prefers-color-scheme: light)");
  const onChange = (): void => {
    if (storedMode() === null) applyMode(resolveMode());
  };
  if (typeof mq.addEventListener === "function") {
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }
  return () => {};
}
