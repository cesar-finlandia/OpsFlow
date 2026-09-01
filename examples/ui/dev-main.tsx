// Requirement IDs: UI-03, UI-06, UI-AC-02, GOV-RES-02 | DP-B §6.3, §10.8 item 1
// Dev-shell bootstrap: THEME env (via the single config surface env.ts) picks
// the theme; unknown values warn + fall back to minimal inside resolveTheme.
// Renders the default single-focus composition (docs/ui-layout.md): status
// indicator + streaming text primary, citations revealed by data.
import { createRoot } from "react-dom/client";
import { env } from "src/platform/config/env";
import type { EventEnvelope } from "src/platform/transport";
import { CitationDisplay } from "src/platform/ui/CitationDisplay.js";
import { StepStatusIndicator } from "src/platform/ui/StepStatusIndicator.js";
import { StreamingTextRenderer } from "src/platform/ui/StreamingTextRenderer.js";
import { currentTheme, resolveTheme } from "src/platform/ui/theme";

// Token contract first, then theme overrides — order matters for the cascade.
import "src/platform/ui/tokens.css";
import "src/platform/ui/themes/minimal.css";
import "src/platform/ui/themes/editorial.css";
import "src/platform/ui/themes/operator.css";

resolveTheme(env.theme);
// eslint-disable-next-line no-console
console.info(`[ui] theme = ${currentTheme()}`);

const rootEl = document.getElementById("root");
if (rootEl) {
  createRoot(rootEl).render(
    <main className="ui-layout-main">
      <StepStatusIndicator envelopes={ENVELOPES} title="Progress" />
      <StreamingTextRenderer envelopes={ENVELOPES} showCursor />
      <CitationDisplay envelopes={ENVELOPES} title="Sources" />
    </main>,
  );
}

// Demo feed: dummy fixture envelopes (synthetic Acme Corp content only). A real
// backend swaps this for useEventStream() — same EventEnvelope[] shape (UI-05).
const ENVELOPES: EventEnvelope[] = [];
