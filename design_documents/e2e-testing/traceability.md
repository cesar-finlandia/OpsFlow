# Requirement → E2E test traceability

Every functional requirement (FR), non-functional requirement (NFR) and mandate
(MAN) from `design_documents/master_blueprint_entry.md` is listed here exactly
once, with the test that asserts it. "Unit" means the requirement is covered by
the Vitest suite and the reason a browser adds nothing is stated.

Spec files live in `tests/e2e/`; run everything with `npm run test:e2e`.

## Functional requirements

| ID | Requirement (abbreviated) | Covering test | Spec |
|---|---|---|---|
| FR-01 | Five tools register at first paint, idempotently after reload | UC-01 "registers exactly the five frozen tools…", "registration happens before first render, and idempotently across reloads" | `01-load-and-register` |
| FR-02 | `search_inventory` returns sku/title/options/price/stock, readOnlyHint | UC-03 chain step 1; UC-01 annotation assertions | `02-agent-console`, `01-load-and-register` |
| FR-03 | `filter_variants` narrows the **current result set**, preserving constraint context | UC-03 asserts `from_result_set === true` and match count ≤ the search's; UC-11 asserts the route honours a supplied sku list | `02-agent-console`, `07-api-and-headers` |
| FR-04 | `calculate_shipping` returns a rate breakdown **plus** `explain[]` and `excluded[]` | UC-08 "submitting the form produces a quote card with the full explain breakdown", "the quote names every excluded variant with a reason" | `04-shipping-declarative` |
| FR-05 | `hold_order` creates a reversible TTL hold requiring a human confirmation click | UC-03 chain step 4; UC-05 Cancel and Escape both refuse with `NEEDS_CONFIRMATION` and write nothing | `02-agent-console` |
| FR-06 | `confirm_fulfillment` commits, refuses expired/unknown/already-confirmed with typed errors | UC-09 CONFLICT / NOT_FOUND / EXPIRED cases | `05-holds-lifecycle`, `03-tool-contract` |
| FR-07 | Every tool validates input against its `inputSchema` and returns a typed `ToolError` (never throws) | UC-06 — nine invalid-input cases, each asserting `isError` + `INVALID_INPUT`; the console-error guard proves nothing threw | `03-tool-contract` |
| FR-08 | Every tool honours `options.signal`; abort resolves `TOOL_ABORTED` with no partial state | UC-07 — all five tools with an aborted signal | `03-tool-contract` |
| FR-09 | Free-text inputs are truncated and length-limited; output marked untrusted | UC-06 "free text is truncated…", "every tool result is untrusted-marked…" | `03-tool-contract` |
| FR-10 | Tool Inspector lists the five tools read live from `getTools()`, not a hardcoded list | UC-02 both cases — including the sixth-fabricated-tool case that would pass against a constant list | `01-load-and-register` |
| FR-11 | In-page agent console turns a goal into a validated plan executed via `executeTool` | UC-04 "plans, executes, gates the hold on a click, and meters the batch" | `02-agent-console` |
| FR-12 | Planner uses Gemini 2.5 Flash server-side; deterministic fallback; UI says which ran | UC-11 "`/api/agent/plan` never returns non-200 and always yields a ToolPlan"; UC-10 "a plan is still produced when the planner route is unreachable" | `07-api-and-headers`, `06-degraded` |
| FR-13 | Three screens — Batch, Shipping, Holds — and no fourth | UC-12 asserts exactly three tabs; UC-04 / UC-08 / UC-09 exercise each screen's content | `08-a11y-keyboard`, `02`, `04`, `05` |
| FR-14 | Every tool call emits `started`→`done`/`error` envelopes rendered as a timeline with the exact validated arguments | UC-03 asserts the envelope pair for all five steps; UC-04 asserts the dialog shows resolved (not empty) arguments | `02-agent-console` |
| FR-15 | Savings meter counts tool calls and confirmations against the `data/baseline.json` baseline | UC-04 compares the rendered meter with the envelope counts and asserts the 25 min / 120 clicks baseline | `02-agent-console` |
| FR-16 | 200 synthetic SKUs with `synthetic: true` and a visible badge | UC-11 asserts `/api/health` reports `catalog.synthetic: true` with non-zero counts; UC-04 asserts the on-screen badge | `07-api-and-headers`, `02-agent-console` |
| FR-17 | Without WebMCP: a banner naming both enablement paths, and the full flow still runs | UC-01b — uses the `plainPage` fixture with no host installed | `01-load-and-register` |
| FR-18 | Failures replay from cache/local with `degraded: true` and a visible chip — never a blank screen | UC-10 all four cases | `06-degraded` |
| FR-19 | `GET /api/health` returns `{ok, version, mode, origin_isolated, planner, catalog}` | UC-11 "GET /api/health returns the HealthResponse shape" | `07-api-and-headers` |
| FR-20 | One-command offline rehearsal replays a mock envelope script with zero network | **Unit + CLI.** `npm run demo:offline` is a Node script with no browser surface; the browser-visible half of the same guarantee (the app working with the network severed) is UC-10 and UC-13. | `06-degraded`, `09-production-bundle` |

## Non-functional requirements

| ID | Requirement (abbreviated) | Covering test | Spec |
|---|---|---|---|
| NFR-01 | No API key, secret or token in client code or the built bundle | UC-13 "the built bundle contains no credential-shaped string" — scans every emitted asset for API-key, PEM, service-account and bearer patterns | `09-production-bundle` |
| NFR-02 | Every tool `execute` resolves < 300 ms p95 with the catalog in memory | **Bench.** `npm run bench:tools` measures this over 50 iterations without browser and network variance; a Playwright assertion would measure the harness. E2E asserts the *user-visible* budget instead (NFR-10). | — |
| NFR-03 | The entire flow works with the network disconnected, with a visible degraded banner | UC-10 "the whole demo goal completes offline, hold included" | `06-degraded` |
| NFR-04 | Zero real personal data; fixtures carry `synthetic: true` | UC-11 health assertion; UC-04 badge assertion | `07`, `02` |
| NFR-05 | Zero edits to the chassis `src/` | **Process, not runtime.** No browser can observe it; upheld by design — every fix in this pass is in entry-owned files, and `src/engine/schemaCheck.ts` exists precisely so the chassis validator did not have to be edited. | — |
| NFR-06 | Every outbound LLM call is wrapped in `withResilience` | **Static + UC-10.** The single call site is `api/agent/plan.ts`, inside `guarded()`; UC-10's planner-unreachable case asserts the observable consequence (always a valid plan, never an error). | `06-degraded` |
| NFR-07 | Tool output ≤ 4000 chars and marked untrusted | UC-06 "every tool result is untrusted-marked and under 4000 chars" | `03-tool-contract` |
| NFR-08 | LLM spend metered into `data/cost-store.json`, falls back above the cap | **Unit + CLI.** Server-side file I/O with no browser surface. | — |
| NFR-09 | Operator theme, keyboard-navigable, focus-trapped confirmation dialogs | UC-12 all three cases — arrow-key tab switching, focus trap, Escape, focus restoration | `08-a11y-keyboard` |
| NFR-10 | Cold load to "five tools registered" < 1.5 s | UC-01 "cold load to five tools registered stays under 1.5 s" | `01-load-and-register` |
| NFR-11 | Builds and runs from a clean clone with no `.env` | The whole suite runs with no credentials configured; UC-11 asserts `/api/agent/plan` still answers, UC-13 asserts the built bundle works | `07`, `09` |
| NFR-12 | No cross-origin iframe anywhere | UC-01 and UC-13 both count `iframe` elements across all three screens | `01`, `09` |

## Mandates

| ID | Mandate (abbreviated) | Covering test | Spec |
|---|---|---|---|
| MAN-01 | Imperative `registerTool({name, description, inputSchema, execute})`, imported and called | UC-01 — five tools present on `document.modelContext` with hand-written schemas and the §2.5 annotations; UC-03 drives all five through `executeTool` | `01`, `02` |
| MAN-02 | Declarative API — an annotated HTML form, in addition to imperative | UC-08 "the form carries the declarative annotations MAN-02 requires" — asserts `toolname` and per-field `tooldescription` in the live DOM | `04-shipping-declarative` |
| MAN-03 | `Origin-Agent-Cluster: ?1` and `Permissions-Policy: tools=(self)` on every response | UC-11 "every response carries the frozen MAN-03 headers" | `07-api-and-headers` |
| MAN-04 | Public repo, all source + instructions, licence detectable at repo top | **Repo state.** `LICENSE` (MIT) at root, `README.md` spin-up, `disclosure.md`; `npm run submit:hygiene`. `.gitignore` was rewritten in this pass so the authoring harness is not published. | — |
| MAN-05 | Working live URL, testable in a WebMCP browser, running consistently | UC-13 exercises the production bundle end to end; the deployed URL is verified by `npm run deploy:verify` after `vercel --prod` | `09-production-bundle` |
| MAN-06 | Video < 3 min, public YouTube, audio covering what + how | **Manual.** `script.md` and the recording are operator steps. | — |
| MAN-07 | Text description answering the four prompts | **Manual.** `submission.md`. | — |
| MAN-08 | Devpost form complete by the deadline | **Manual.** `docs/submission-checklist.md`, `npm run gate`. | — |
| MAN-09 | New & Existing rule + dated commit history, chassis reuse disclosed | **Repo state.** `git log`, `disclosure.md`. | — |
| MAN-10 | One track, no bonus integration | **Repo state.** `submission.md`, `README.md`, deck slide 1. | — |

## Coverage summary

* **20 / 20** functional requirements: 18 asserted in a real browser, 2 (FR-20) shared with the CLI/unit path with the browser-visible half covered.
* **12 / 12** non-functional requirements: 8 asserted in a real browser, 4 covered by bench/unit/process with the reason recorded above.
* **10 / 10** mandates: 5 asserted in a real browser, 5 are repo-state or operator steps that no browser can assert.
