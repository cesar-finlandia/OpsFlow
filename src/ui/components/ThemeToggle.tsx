// Requirement IDs: NFR-09 | DP-UI · visual_identity_plan.md §4.3
//
// The global light/dark toggle. One button, one inline SVG that morphs sun →
// crescent by sliding a mask circle (no icon swap, no layout shift), and a
// circular View Transition wipe originating at the button.
//
// It is a plain <button>: the E2E suite asserts exactly three role="tab"
// elements and a single <h1>, so nothing here may claim either role (§11.1).

import * as React from "react";
import { currentMode, initMode, toggleMode, type ColorMode } from "src/ui/theme/mode.ts";

export function ThemeToggle(): JSX.Element {
  const [mode, setModeState] = React.useState<ColorMode>(() => currentMode());

  React.useEffect(() => {
    const stop = initMode();
    setModeState(currentMode());
    // Keep the button label honest if the OS flips while we are following it.
    const observer = new MutationObserver(() => setModeState(currentMode()));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-mode"] });
    return () => {
      observer.disconnect();
      stop();
    };
  }, []);

  const isDark = mode === "dark";
  const label = isDark ? "Switch to light theme" : "Switch to dark theme";

  function onClick(e: React.MouseEvent<HTMLButtonElement>): void {
    const rect = e.currentTarget.getBoundingClientRect();
    setModeState(toggleMode({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }));
  }

  return (
    <button
      type="button"
      className="of-icon-btn of-theme-toggle"
      onClick={onClick}
      aria-pressed={isDark}
      aria-label={label}
      title={label}
      data-testid="theme-toggle"
    >
      <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <defs>
          {/* The crescent is the sun disc minus an offset circle. Sliding that
              circle in and out is the whole morph — one transform, no repaint. */}
          <mask id="of-moon-mask">
            <rect x="0" y="0" width="24" height="24" fill="#fff" />
            <circle className="of-moon-mask" cx="12" cy="12" r="5.8" />
          </mask>
        </defs>
        <g className="of-sun-rays">
          <path d="M12 1.6v2.4M12 20v2.4M1.6 12h2.4M20 12h2.4M4.6 4.6l1.7 1.7M17.7 17.7l1.7 1.7M19.4 4.6l-1.7 1.7M6.3 17.7l-1.7 1.7" />
        </g>
        <circle className="of-sun-core" cx="12" cy="12" r="5.6" mask="url(#of-moon-mask)" />
      </svg>
    </button>
  );
}
