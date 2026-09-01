// Requirement IDs: UI-01, UI-02, UI-06, GOV-MIN-02 | DP-B §6.5
// EXAMPLE ONLY — not the default layout (GOV-MIN-02). Composites all three
// components in the operator-style three-zone arrangement to prove they
// compose; default single-focus guidance lives in docs/ui-layout.md.
// Envelope-only runtime data (UI-05): pass any EventEnvelope[] from a real or
// mock backend — no adapters, no per-project wiring.
import type { EventEnvelope } from "src/platform/transport";
import { CitationDisplay } from "src/platform/ui/CitationDisplay.js";
import { StepStatusIndicator } from "src/platform/ui/StepStatusIndicator.js";
import { StreamingTextRenderer } from "src/platform/ui/StreamingTextRenderer.js";

export type DashboardProps = {
  envelopes: EventEnvelope[];
  className?: string;
};

export function Dashboard({ envelopes, className }: DashboardProps) {
  return (
    <div className={"ui-layout-root".concat(className ? ` ${className}` : "")}>
      <main className="ui-layout-main">
        <section className="zone-status">
          <StepStatusIndicator envelopes={envelopes} title="Progress" showSequence />
        </section>
        <section className="zone-content">
          <StreamingTextRenderer envelopes={envelopes} showCursor />
        </section>
        <aside className="zone-citations">
          <CitationDisplay envelopes={envelopes} title="Sources" />
        </aside>
      </main>
    </div>
  );
}
