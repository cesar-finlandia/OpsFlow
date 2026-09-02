import * as React from "react";
import type { probeWebMcp } from "src/webmcp/policy.ts";
import { useSession } from "src/ui/state/session.ts";
import { WebMcpBanner } from "src/ui/components/WebMcpBanner.tsx";
import { DegradedBanner } from "src/ui/components/DegradedBanner.tsx";
import { CoExecutionTimeline } from "src/ui/components/CoExecutionTimeline.tsx";
import { SavingsMeter } from "src/ui/components/SavingsMeter.tsx";
import { ToolInspector } from "src/ui/components/ToolInspector.tsx";
import { ConfirmDialog, useConfirmDialogState } from "src/ui/components/ConfirmDialog.tsx";
import { ThemeToggle } from "src/ui/components/ThemeToggle.tsx";
import { HelpTip } from "src/ui/components/HelpTip.tsx";
import { StoryDialog } from "src/ui/components/StoryDialog.tsx";
import { SignalMark, InspectIcon } from "src/ui/components/Icons.tsx";
import { BatchScreen } from "src/ui/screens/BatchScreen.tsx";
import { ShippingScreen } from "src/ui/screens/ShippingScreen.tsx";
import { HoldsScreen } from "src/ui/screens/HoldsScreen.tsx";

type Probe = ReturnType<typeof probeWebMcp>;
type TabId = "batch" | "shipping" | "holds";

/**
 * The three screens, in the order a batch actually moves through them, each
 * with the one-paragraph answer to "what is this page for?". Maya has no
 * onboarding call, so the explanation lives next to the control (§7.10).
 */
const TABS: Array<{ id: TabId; label: string; helpLabel: string; helpTitle: string; help: React.ReactNode }> = [
  {
    id: "batch",
    label: "Batch",
    helpLabel: "About the Batch screen",
    helpTitle: "Describe the job, watch it run",
    help: (
      <>
        <p>Type what you want in plain English. The agent chains the typed tools to do it — search the catalog, narrow it, quote shipping — and each step appears in the timeline as it happens.</p>
        <p>Results land in a table you can still tick and untick by hand if the agent read something wrong. Nothing on this screen commits anything.</p>
      </>
    ),
  },
  {
    id: "shipping",
    label: "Shipping",
    helpLabel: "About the Shipping screen",
    helpTitle: "Quote a set, and see why",
    help: (
      <>
        <p>Rates for the SKUs your batch produced, or any list you paste in. Every quote can be expanded into the rules behind the number: which variants were excluded, which surcharge applied to which zone.</p>
        <p>The form itself is annotated for WebMCP, so an outside agent can quote through it without any JavaScript.</p>
      </>
    ),
  },
  {
    id: "holds",
    label: "Holds",
    helpLabel: "About the Holds screen",
    helpTitle: "Reserved stock, on a clock",
    help: (
      <>
        <p>Every hold placed in this session, each with a live countdown against the window it was granted. Let a hold go, or commit it — committing always opens the gate dialog first.</p>
        <p>The savings meter underneath compares this batch against the 25-minute manual baseline.</p>
      </>
    ),
  },
];

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
        {/* The Signal mark is a legend for the trust model: five nodes, one per
            tool, the fourth an open ring because that is where the human
            decides (visual_identity_plan.md §2.2). */}
        <span className="opsflow-brand">
          <SignalMark size={16} />
          <h1>OpsFlow</h1>
        </span>
        <span className="opsflow-tagline">Agent-native fulfillment console</span>
        {/* The first question anyone has is "what is this?". It is answered next
            to the title, by the product story itself (§7.11). */}
        <StoryDialog />
        <span className="opsflow-badge" aria-label="synthetic data badge">
          <span aria-hidden="true">Synthetic data</span>
          <span className="opsflow-badge__full">Synthetic data — all 200 SKUs are generated. Every record carries synthetic:true (NFR-04).</span>
        </span>
        <span className="opsflow-header__spacer" />
        <span className="opsflow-header__actions">
          <button className="of-icon-btn" onClick={() => setInspectorOpen((v) => !v)} aria-expanded={inspectorOpen}>
            <InspectIcon />
            Inspect tools (5)
          </button>
          <HelpTip
            align="end"
            label="About the tool panel"
            title="What the agent is allowed to do"
          >
            <p>Opens the live list of the five tools this page registers, read from the page itself — not a hard-coded list. Each one shows the exact schema it accepts and returns.</p>
            <p>Three only read data. Two change something real, and both wait for your click.</p>
          </HelpTip>
          <ThemeToggle />
        </span>
      </header>
      <div role="tablist" onKeyDown={handleTabKeyDown}>
        {TABS.map((tab) => (
          <span className="opsflow-tab-slot" key={tab.id}>
            <button
              role="tab"
              aria-selected={activeTab === tab.id}
              aria-controls={`panel-${tab.id}`}
              id={`tab-${tab.id}`}
              ref={(el) => { tabRefs.current[tab.id] = el; }}
              onClick={() => setActiveTab(tab.id)}
              tabIndex={activeTab === tab.id ? 0 : -1}
            >
              {tab.label}
            </button>
            <HelpTip label={tab.helpLabel} title={tab.helpTitle}>{tab.help}</HelpTip>
          </span>
        ))}
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
      <div className="opsflow-panel opsflow-timeline">
        {/* The help button is a sibling of the heading, never a child: a button
            inside an <h2> would fold its label into the heading's accessible
            name (§11.1). */}
        <div className="opsflow-panel__head">
          <h2>Co-execution timeline</h2>
          <HelpTip label="About the timeline" title="Every step, as it happens">
            <p>One row per typed step the agent takes, each moving from running to done. Failures stay visible rather than disappearing.</p>
            <p>A step marked as a replay ran against the last known-good cached result — the data is real but stale, and it is coloured differently so it is never mistaken for a fresh call.</p>
          </HelpTip>
        </div>
        <CoExecutionTimeline envelopes={envelopes} />
      </div>
      <div className="opsflow-meter"><SavingsMeter meter={meter} /></div>
      {inspectorOpen && (
        <div className="opsflow-panel opsflow-inspector">
          <div className="opsflow-panel__head">
            <h2>Registered WebMCP tools</h2>
            <HelpTip label="About this panel" title="Read straight from the page">
              <p>Each entry is a tool this page registered with the browser, with the schema it validates against. An agent — this console&apos;s, or your own — can call nothing that is not listed here.</p>
              <p>The two marked as gated change stored state, and neither runs until you approve the exact arguments.</p>
            </HelpTip>
          </div>
          <ToolInspector open={inspectorOpen} />
        </div>
      )}
      <ConfirmDialog request={request} onResolve={onResolve} />
    </div>
  );
}
