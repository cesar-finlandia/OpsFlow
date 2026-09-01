// Requirement IDs: UI-03, UI-04 | DP-B §6.4 (Playwright capture surface)
// Renders the single-focus composition for one theme, selected via the
// ?theme= query param (falls back to minimal), with ?populated=1 loading the
// backend-a dummy fixture envelopes. Screenshot surface only — no app logic.
import { createRoot } from "react-dom/client";
import type { EventEnvelope } from "src/platform/transport";
import { CitationDisplay } from "src/platform/ui/CitationDisplay.js";
import { StepStatusIndicator } from "src/platform/ui/StepStatusIndicator.js";
import { StreamingTextRenderer } from "src/platform/ui/StreamingTextRenderer.js";
import { resolveTheme } from "src/platform/ui/theme";

// Token contract first, then theme overrides — order matters for the cascade.
import "src/platform/ui/tokens.css";
import "src/platform/ui/themes/minimal.css";
import "src/platform/ui/themes/editorial.css";
import "src/platform/ui/themes/operator.css";
import fixture from "../dummy-fixtures/event-envelope/backend-a.json";

const params = new URLSearchParams(window.location.search);
const theme = params.get("theme") ?? "minimal";
const populated = params.get("populated") === "1";
const envelopes = (populated ? fixture : []) as unknown as EventEnvelope[];

resolveTheme(theme);

const rootEl = document.getElementById("root");
if (rootEl) {
  createRoot(rootEl).render(
    <main className="ui-layout-main">
      <StepStatusIndicator envelopes={envelopes} title="Progress" />
      <StreamingTextRenderer envelopes={envelopes} showCursor />
      <CitationDisplay envelopes={envelopes} title="Sources" />
    </main>,
  );
}
