import * as React from "react";
import type { probeWebMcp } from "src/webmcp/policy.ts";
import { useSession } from "src/ui/state/session.ts";
import { WebMcpBanner } from "src/ui/components/WebMcpBanner.tsx";
import { DegradedBanner } from "src/ui/components/DegradedBanner.tsx";
import { CoExecutionTimeline } from "src/ui/components/CoExecutionTimeline.tsx";
import { SavingsMeter } from "src/ui/components/SavingsMeter.tsx";
import { ToolInspector } from "src/ui/components/ToolInspector.tsx";
import { ConfirmDialog, useConfirmDialogState } from "src/ui/components/ConfirmDialog.tsx";
import { BatchScreen } from "src/ui/screens/BatchScreen.tsx";
import { ShippingScreen } from "src/ui/screens/ShippingScreen.tsx";
import { HoldsScreen } from "src/ui/screens/HoldsScreen.tsx";

type Probe = ReturnType<typeof probeWebMcp>;
type TabId = "batch" | "shipping" | "holds";

export function App({ probe }: { probe: Probe }): JSX.Element {
  const { degraded, envelopes, meter } = useSession();
  const [activeTab, setActiveTab] = React.useState<TabId>("batch");
  const [inspectorOpen, setInspectorOpen] = React.useState(false);
  const { request, onResolve } = useConfirmDialogState();

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get("tab") as TabId | null;
    if (tab === "batch" || tab === "shipping" || tab === "holds") {
      setActiveTab(tab);
    }
  }, []);

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    params.set("tab", activeTab);
    const newUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.replaceState(null, "", newUrl);
  }, [activeTab]);

  const tabOrder: TabId[] = ["batch", "shipping", "holds"];
  const tabRefs = React.useRef<Record<TabId, HTMLButtonElement | null>>({ batch: null, shipping: null, holds: null });

  function handleTabKeyDown(e: React.KeyboardEvent): void {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const idx = tabOrder.indexOf(activeTab);
    const nextIdx = e.key === "ArrowRight" ? (idx + 1) % tabOrder.length : (idx - 1 + tabOrder.length) % tabOrder.length;
    const nextTab = tabOrder[nextIdx] as TabId;
    setActiveTab(nextTab);
    tabRefs.current[nextTab]?.focus();
  }

  return (
    <div className="opsflow">
      {!probe.available && <WebMcpBanner probe={probe} />}
      {degraded && <DegradedBanner degraded={degraded} />}
      <header className="opsflow-header">
        <h1>OpsFlow</h1>
        <span className="opsflow-tagline">Agent-native fulfillment console</span>
        <span className="opsflow-badge" aria-label="synthetic data badge">Synthetic data — all 200 SKUs are generated. Every record carries synthetic:true (NFR-04).</span>
        <span className="opsflow-header__spacer" />
        <button onClick={() => setInspectorOpen((v) => !v)}>Inspect tools (5)</button>
      </header>
      <div role="tablist" onKeyDown={handleTabKeyDown}>
        <button role="tab" aria-selected={activeTab === "batch"} aria-controls="panel-batch" id="tab-batch" ref={(el) => { tabRefs.current.batch = el; }} onClick={() => setActiveTab("batch")} tabIndex={activeTab === "batch" ? 0 : -1}>Batch</button>
        <button role="tab" aria-selected={activeTab === "shipping"} aria-controls="panel-shipping" id="tab-shipping" ref={(el) => { tabRefs.current.shipping = el; }} onClick={() => setActiveTab("shipping")} tabIndex={activeTab === "shipping" ? 0 : -1}>Shipping</button>
        <button role="tab" aria-selected={activeTab === "holds"} aria-controls="panel-holds" id="tab-holds" ref={(el) => { tabRefs.current.holds = el; }} onClick={() => setActiveTab("holds")} tabIndex={activeTab === "holds" ? 0 : -1}>Holds</button>
      </div>
      <div role="tabpanel" id="panel-batch" aria-labelledby="tab-batch" hidden={activeTab !== "batch"}>
        {activeTab === "batch" && <BatchScreen />}
      </div>
      <div role="tabpanel" id="panel-shipping" aria-labelledby="tab-shipping" hidden={activeTab !== "shipping"}>
        {activeTab === "shipping" && <ShippingScreen />}
      </div>
      <div role="tabpanel" id="panel-holds" aria-labelledby="tab-holds" hidden={activeTab !== "holds"}>
        {activeTab === "holds" && <HoldsScreen />}
      </div>
      <div className="opsflow-panel opsflow-timeline"><h2>Co-execution timeline</h2><CoExecutionTimeline envelopes={envelopes} /></div>
      <div className="opsflow-meter"><SavingsMeter meter={meter} /></div>
      {inspectorOpen && <div className="opsflow-panel opsflow-inspector"><h2>Registered WebMCP tools</h2><ToolInspector open={inspectorOpen} /></div>}
      <ConfirmDialog request={request} onResolve={onResolve} />
    </div>
  );
}
