import * as React from "react";
import type { probeWebMcp } from "src/webmcp/policy.ts";

type Probe = ReturnType<typeof probeWebMcp>;

export function WebMcpBanner({ probe }: { probe: Probe }): JSX.Element | null {
  if (probe.available) return null;
  return (
    <div role="alert" className="opsflow-banner opsflow-banner--webmcp">
      <strong>WebMCP not detected</strong> — this browser is not exposing document.modelContext. Enable one of these, then reload: 1. Open this URL in the ChatGPT desktop app in-app browser (WebMCP is on by default there), or 2. Open it in Google Chrome 149+ with chrome://flags/#enable-webmcp-testing enabled — paste that URL, set to Enabled, and restart the browser. The in-page Agent Console still runs the full flow via the local executor, so you can judge the product without WebMCP.
    </div>
  );
}
