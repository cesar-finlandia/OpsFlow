# OpsFlow — End-to-End Testing Strategy

> **Status:** v1.0.0 — implemented in `tests/e2e/`, executed with `npm run test:e2e`
> **Scope:** every use case in `design_documents/master_blueprint_entry.md` §1.1 (FR-01…FR-20),
> §1.2 (NFR-01…NFR-12) and §1.0.1 (MAN-01…MAN-10), exercised through a **real browser**.
> **Companion documents:** [`traceability.md`](./traceability.md) (requirement → test id),
> [`results.md`](./results.md) (the recorded outcome of the last full run).

---

## 1. Why this strategy looks the way it does

OpsFlow is judged on four equally weighted axes, and the first one — *WebMCP
Leverage* — is decided by whether the **page's own `document.modelContext`**
really registers five working tools that an agent can chain. That fact cannot be
established by unit tests. A unit test can call `runTool()` directly and prove
the domain logic is right while `registerTool` is never called, the tools never
appear on `document.modelContext`, and the deployed page is inert. The repository
arrived in exactly that state: 164 unit tests passed while, in a browser, no
envelope was ever published, no tool input was ever validated, and the demo chain
held zero SKUs.

So the organising principle here is: **assert on the artifact a judge will open.**
Every use case is driven through a real Chromium page against a real HTTP server,
and the assertions are made on rendered DOM, on network responses, and on the
values that come back out of `document.modelContext.executeTool` — never on an
internal function call.

Three consequences follow, and they shape everything below.

### 1.1 The agent must be simulated, because the judge's agent cannot be scripted

The blueprint's primary agent is ChatGPT's in-app browser agent (§0.4). That
cannot be automated in CI, and Chrome's `--enable-webmcp-testing` flag is not
available in the pinned Playwright Chromium build. Testing only the in-page
console would therefore leave `registerTool` — the single most important line in
the repository (MAN-01) — unverified.

The suite closes that gap with a **WebMCP host polyfill**
(`tests/e2e/fixtures/webmcp-host.ts`), installed with `page.addInitScript` before
any application code runs. It implements the imperative surface the specification
defines and the app consumes — `registerTool`, `getTools`, `executeTool` — and
nothing else. It is a *test host*, not a test double of the app: the code under
test is the app's real `register.ts` and real `execute` callbacks. When the
polyfill is installed the suite is asserting "an external agent can drive this
page"; when it is absent the suite is asserting the FR-17 fallback ("a judge on
an unsupported browser still sees the whole product").

Both configurations are exercised. Neither is optional.

### 1.2 The API must actually run locally, or the tests measure the wrong thing

`api/**` are Vercel serverless functions. `vite` knows nothing about that
convention, so before this work `npm run dev` served no API at all: every
read-only tool silently fell through to the in-browser catalog and the console
rendered permanently degraded. E2E against that server would have "passed" while
never touching a single route.

`vite.config.ts` therefore carries an `opsflow-api-dev-server` plugin that loads
the same handler modules through `ssrLoadModule` and adapts Node's req/res to the
Vercel signature. `npm run dev` and `vercel --prod` now execute identical handler
code, and the E2E suite exercises the real routes, including their 400s.

### 1.3 Both rungs of the fallback ladder are first-class test subjects

§5.2 of the blueprint defines a six-rung degradation ladder and states that no
rung may be entered silently. A test suite that only covers rung 1 would leave
the entire resilience story — the thing that keeps a live demo alive on venue
Wi-Fi — unverified. Degradation is tested as a feature, by blocking `/api/**` at
the browser level and asserting the flow still completes *and* says so on screen.

---

## 2. Test architecture

```
tests/e2e/
  fixtures/
    webmcp-host.ts       # the WebMCP host polyfill + install helper
    app.ts               # Playwright fixtures: clean storage, console-error guard, helpers
  01-load-and-register.spec.ts    # UC-01, UC-02
  02-agent-console.spec.ts        # UC-03, UC-04
  03-tool-contract.spec.ts        # UC-05, UC-06, UC-07
  04-shipping-declarative.spec.ts # UC-08
  05-holds-lifecycle.spec.ts      # UC-09
  06-degraded.spec.ts             # UC-10
  07-api-and-headers.spec.ts      # UC-11
  08-a11y-keyboard.spec.ts        # UC-12
  09-production-bundle.static.spec.ts # UC-13
playwright.config.ts
```

### 2.1 Two Playwright projects, two server shapes

| Project | Server | What it proves |
|---|---|---|
| `live` | `vite` dev server on `:5174`, **with** the API plugin | The complete product: routes, tool chain, confirmations, degradation, a11y. Runs specs `01`–`08`. |
| `static` | `vite build` + `vite preview` on `:4174`, **no** API | The *production bundle* — the exact JS a judge downloads — boots, registers five tools and completes the whole flow from the in-browser catalog with a visible degraded state. Runs spec `09`. |

The `static` project is not redundant. It is the only place the shipped artifact
is executed, and it is the local stand-in for §5.2 rung 3 ("API routes
unreachable"). A regression that only appears in a production build — a
dev-only import, a stripped stylesheet, a broken JSON asset — is invisible to the
`live` project.

### 2.2 Fixtures

* **Clean state per test.** `localStorage` (`opsflow.holds.v1`) is cleared before
  every test, because holds are client-owned by design (§2.6) and would otherwise
  leak across cases.
* **Console-error guard.** Every test fails if the page logs an uncaught error or
  an unhandled rejection. FR-07/FR-08 promise that `execute` *never throws*; a
  guard makes that promise falsifiable instead of aspirational.
* **`runBatch(page, goal)`** drives the in-page console the way a user does:
  fill the goal, click Run, wait for the confirmation dialog.
* **`agentExecute(page, tool, args)`** calls
  `document.modelContext.executeTool` from page context and returns the parsed
  result — the external-agent entry point.

### 2.3 What is deliberately *not* E2E

* **Pure domain arithmetic** (rate tables, surcharge maths, hold reducers) stays
  in `tests/domain/**`. Driving 200 SKUs of price arithmetic through a browser
  would be slow and would localise failures worse than a unit test does.
* **The vendored chassis modules.** `src/resilience`, `src/context`,
  `src/platform`, `src/data` belong to the chassis repository and NFR-05 forbids
  editing them here. They are exercised through the app's behaviour, not directly.
* **Real Vertex AI calls.** The planner's live path needs a Google Cloud project
  and costs money per run; a hermetic suite must not depend on either. The
  deterministic planner is the tested path (it is also the path a judge without
  credentials gets), and the Vertex branch is covered by asserting the route's
  contract: it always answers 200 with a valid `ToolPlan` and labels which
  planner ran (FR-12).

---

## 3. Use-case catalogue

Each row is a use case drawn from the design plans. "Rung" refers to §5.2.

### UC-01 — Cold load registers five tools before first interaction
**Requirements:** FR-01, FR-10, NFR-10, MAN-01
**Rung:** 1
Load the page with the WebMCP host installed. Assert: the document title is
OpsFlow's, `document.modelContext.getTools()` returns exactly the five frozen
names, each carries a non-empty `description`, a hand-written `inputSchema` with
`type: "object"`, and the `annotations` from §2.5 (`readOnlyHint` true for the
three read-only tools, false for `hold_order`/`confirm_fulfillment`). Assert
registration completed before React rendered, by reading the boot-order marker.
Assert time-to-five-tools is under 1.5 s (NFR-10).

### UC-02 — The Tool Inspector reads the live registry, not a hardcoded list
**Requirements:** FR-10, MAN-01
**Rung:** 1
Open the inspector panel. Assert five tool cards, each showing the pretty-printed
schema. Then, in a page where the host polyfill exposes a *sixth* fabricated
tool, assert the inspector still renders exactly the five registered by the app
in frozen order — proving it filters what `getTools()` returns rather than
printing a constant.

### UC-03 — External agent chains all five tools
**Requirements:** FR-02…FR-06, FR-14, MAN-01
**Rung:** 1
Acting purely as an external agent through `executeTool`, run
`search_inventory({query:"blue"})` → `filter_variants({options:{color:"Blue"}, maxStock:5})`
→ `calculate_shipping` → `hold_order` → `confirm_fulfillment`. Assert each returns
the WebMCP result shape (`content[0].type === "text"`, `structuredContent`,
`isError`), that `filter_variants` narrowed the *previous* result set
(`from_result_set === true`, and its match count ≤ the search's), that the quote
carries a non-empty `explain[]`, and that the fulfillment id references the hold.
This is the tool-chaining behaviour the blueprint calls "the non-trivial part
judges screen for".

### UC-04 — In-page console runs the demo goal end to end
**Requirements:** FR-11, FR-13, FR-14, FR-15, FR-05
**Rung:** 1
Type the demo goal from §2.2 step 3, click Run. Assert: the timeline shows
`agent.plan` `started`→`done` with the planner label, then a `tool.*` pair per
step; the results table lists matched variants with low-stock chips; the
confirmation dialog opens for `hold_order` showing the **resolved** line items
(not an empty array); confirming creates a hold visible on the Holds screen; the
savings meter reads exactly the number of tool calls and confirmations that
occurred, against the 25-minute/120-click baseline from `data/baseline.json`.

### UC-05 — Nothing commits without a human click
**Requirements:** FR-05, FR-06
**Rung:** 1
Run the same goal and press **Cancel**. Assert the outcome is
`NEEDS_CONFIRMATION`, that no hold exists, and that the timeline recorded
`session.confirm` `done` with `granted: false`. Repeat with **Escape**.

### UC-06 — Bad input is refused with a typed error, never a throw
**Requirements:** FR-07, FR-09, NFR-07
**Rung:** 1
Through `executeTool`, send: a non-string `query`; a `hold_order` with an empty
`lineItems` and no session context; an unknown property; a `confirm_fulfillment`
with a malformed `holdId`; a 5 000-character `query`. Assert every call
**resolves** (never rejects) with `isError: true` and
`structuredContent.error.code === "INVALID_INPUT"`, that the over-long query is
truncated to 200 chars rather than rejected, that no result text exceeds 4 000
chars, and that every result text is prefixed with the untrusted-content marker.
The console-error guard proves nothing threw.

### UC-07 — Abort leaves no partial state
**Requirements:** FR-08
**Rung:** 1
Call `hold_order` with an already-aborted `AbortSignal`. Assert the outcome is
`TOOL_ABORTED` and that the holds list is unchanged.

### UC-08 — Shipping screen and the declarative form
**Requirements:** FR-04, FR-13, MAN-02
**Rung:** 1
Assert the `<form>` carries the `toolname="calculate_shipping"` annotation and
per-field `tooldescription` attributes (MAN-02 is proven by the DOM, not by the
README). Submit it with two SKUs. Assert the quote card renders zone, service,
total weight and total, that the breakdown toggle reveals the `explain[]` lines,
and that any excluded variant is listed with its reason.

### UC-09 — Holds lifecycle and every typed refusal
**Requirements:** FR-06, FR-13
**Rung:** 1
Create a hold, then assert: confirming twice returns `CONFLICT`; confirming an
unknown id returns `NOT_FOUND`; a hold created with a 1-minute TTL and then
time-travelled past expiry returns `EXPIRED` and its Confirm button is disabled;
releasing removes it from the active list; and a surviving hold is still present
after a full page reload (client-owned state, §2.6).

### UC-10 — Degraded operation is complete and visible
**Requirements:** FR-18, NFR-03, and §5.2 rungs 3–5
**Rung:** 3
Block `**/api/**` at the browser. Re-run the demo goal. Assert the full chain
still completes from the in-browser catalog, that the affected steps carry
`degraded: true`, that the degraded banner and the per-step chip are visible, and
that the data returned is still *correct* (the same SKUs the live path returned),
not a placeholder.

### UC-11 — Health endpoint, frozen headers, and route validation
**Requirements:** FR-19, MAN-03, and §2.6
**Rung:** 1
`GET /api/health` returns the `HealthResponse` shape with `origin_isolated: true`
and the catalog counts. Every response carries `Origin-Agent-Cluster: ?1` and
`Permissions-Policy: tools=(self)`. Each of the three data routes returns 200 for
valid input and **400 `INVALID_INPUT`** for invalid input, and 405 for `GET`.
`POST /api/agent/plan` never returns non-200 and always yields a `ToolPlan`
naming its planner.

### UC-12 — Keyboard and screen-reader path
**Requirements:** NFR-09
**Rung:** 1
Tabs are reachable and switchable with Arrow keys; the confirmation dialog is
`role="dialog" aria-modal="true"`, moves focus to Confirm on open, traps Tab
inside itself, closes on Escape, and restores focus to the previously focused
element.

### UC-13 — The production bundle is the thing that works
**Requirements:** NFR-01, NFR-11, NFR-12, MAN-05, and §5.2 rung 3
**Project:** `static`
Against `vite preview` serving `dist/`: the page boots, registers five tools,
completes the full goal→hold→confirm flow from local data with a visible degraded
state, renders no cross-origin `<iframe>` (NFR-12), and the built JS contains no
credential-shaped string (NFR-01).

---

## 4. Running the suite

```bash
npm run test:e2e
```

`playwright.config.ts` starts both servers itself (`webServer`), so no manual
setup is needed. Useful variants:

```bash
npm run test:e2e -- --project=live      # only the full-stack project
npm run test:e2e -- --headed            # watch it drive the browser
npm run test:e2e -- --ui                # Playwright's interactive runner
npx playwright show-report reports/e2e  # open the last HTML report
```

The unit suite remains the fast inner loop and stays green as a precondition:

```bash
npm test
```

---

## 5. Definition of done

The suite is the gate for hackathon delivery. Delivery is blocked unless:

1. `npm test` — the entry's unit suite — is green.
2. `npm run test:e2e` — both projects — is green with zero skipped tests.
3. Every row in [`traceability.md`](./traceability.md) names at least one passing
   test, or carries a written justification for why a browser cannot assert it.
4. The console-error guard reported no uncaught page error in any test.

## 6. Known limits, stated rather than hidden

* **The ChatGPT in-app browser is not automated.** No CI can drive it. The suite
  proves the page satisfies the imperative WebMCP contract that browser consumes;
  the final check against the real client is a manual step in
  `docs/submission-checklist.md`.
* **The Vertex AI planner path is contract-tested, not called.** See §2.3.
* **Cold-load timing (NFR-10) is measured on the dev server**, which is slower
  than the CDN-served production bundle. A pass locally is a conservative pass.
* **`npx tsc --noEmit` is not green.** The repository's strict-mode settings
  surface pre-existing type errors, concentrated in test files and in
  `noUncheckedIndexedAccess` index reads. `tsconfig.json` was corrected so that
  module resolution matches how the code is actually built (it previously failed
  on *every* file); clearing the remaining strictness errors is tracked
  separately and does not affect the shipped bundle, which Vite builds cleanly.
