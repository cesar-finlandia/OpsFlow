# TASK — Generate the Master Blueprint + Design Plans for this hackathon entry

You are a principal engineer preparing a hackathon entry for implementation by
**low-intelligence AI models** driven by `run_sweep.sh --planner` and
`run_sweep.sh --sequence`. Your job: read the material below, then produce ONE
Master Blueprint plus a set of chassis-format design plans that those sweeps will
implement verbatim. The goal is simple and absolute: **maximize the probability
of winning WebMCP Challenge — Top 10 (single prize bucket, no side tracks).**

## READ FIRST (in this order)

1. `hackathon-projects/2026-09-webMCP/winning_project_plan.md` — the selected idea, architecture spec,
   and suggested module emphasis (centralized layout; legacy private/pgm/ is deprecated). This is the source of truth for WHAT we build.
2. `hackathon-projects/2026-09-webMCP/proposal.json` — Component Advisor output: which chassis modules
   were selected/excluded and why. If it is absent, read
   `contracts/component-catalog.json` and assume all twelve components with the
   advisor's minimal-viable defaults.
3. `contracts/component-catalog.json` — what each selected chassis module
   already provides (do NOT redesign chassis behavior; compose it).
4. The chassis design plan for EACH selected module. Mapping (module → plans in
   `design_documents/design_plans/`):

   | module | design plan(s) |
   |---|---|
   | resilience | DP-A-resilience-layer.md |
   | platform | DP-B-platform-layer.md |
   | ideation | DP-D1-ideation-hour0.md, DP-D2a-deckgen-script.md, DP-D2b-demodrive-faqdef.md |
   | context | DP-E-context-buffer-manager.md |
   | dev-tooling | DP-F1-local-dev-single-checks.md, DP-F2-local-dev-cross-checks.md |
   | data | DP-H-synthetic-demo-data-generator.md |
   | cost | DP-I-cost-usage-guardrail.md |
   | provenance | DP-J-provenance-disclosure-toolkit.md |
   The table is pre-filtered to the modules marked included:true in hackathon-projects/2026-09-webMCP/proposal.json (centralized layout; legacy private/pgm/proposal.json is deprecated).
   Read ONLY the rows whose module is included:true in `hackathon-projects/2026-09-webMCP/proposal.json`;
   skip excluded modules entirely — never design against a module the manifest excludes.
   **Precedence rule: if this prompt's enumerations conflict with
   `hackathon-projects/2026-09-webMCP/proposal.json`, the manifest wins.**
   Your plans must CALL INTO these modules, never re-implement them.
5. `design_documents/lablab_hackathon_strategy_blueprint.md` — §5 (rules
   confirmations) and §7 (the per-hackathon playbook you are automating).
  6. `hackathon-projects/2026-09-webMCP/event_profile.json` or the event profile wherever
     the Event Profile Extractor wrote it (legacy preparing/exercise-1/work/ is deprecated) — mandated platform, sponsor tracks,
     judging criteria, submission rules, deadlines.

## MANDATORY COMPLIANCE — DISQUALIFICATION-LEVEL (extract before any design)
Before drafting any blueprint section, scan `hackathon-projects/2026-09-webMCP/winning_project_plan.md` + its
source `hackathon-projects/2026-09-webMCP/hackathon_brief.md` (§4 Hackathon Rules - Requirements - Tracks) and the live *Hackathon-page* https://webmcp.devpost.com for verbatim. This event is WebMCP — do not copy Gemini/ADK/GCP requirements from other hackathons.

- MANDATORY TECHNOLOGIES (Stage One pass/fail): **WebMCP only.** Every project must use WebMCP — Imperative API `document.modelContext.registerTool({ name, description, inputSchema, execute })` and/or Declarative API (HTML form annotations). Repo must demonstrate **imported-and-called** usage, not just README mention (pattern verbatim in repo). Only available in origin-isolated documents, gated by `tools` Permissions Policy (defaults to `self`, cross-origin iframe needs `allow="tools"`). Testable in **ChatGPT desktop app in-app browser (WebMCP default) OR Google Chrome 149+ with `chrome://flags/#enable-webmcp-testing` enabled + restart** (+ origin trial registration for hosted origin). No API key; no mandated AI model. Use Google Chrome docs `developer.chrome.com/docs/ai/webmcp` + spec `webmachinelearning/webmcp` Draft 2026-08-26.

- PRIZE TRACKS: **One overall challenge, single prize bucket — no layered tracks, no sponsor sub-challenges.** Quoted from Rules §9: **"WebMCP Challenge Winners — Top 10 submissions receive the following prizes from the hackathon sponsors: ... 10 winners — All eligible Submissions"** (OpenAI $3,000 cash + Spotlight + Codex Micro + swag + Pro 1yr ×3, Cloudflare $10k credits, Vercel $300/mo + $50/mo Gateway ×12, Render $300, Netlify $500 cash, Shopify $250 gear, Chrome 3-mo AI Ultra). Hosting choice (ChatGPT Sites/Cloudflare/Vercel/Render/Netlify/Shopify/any) is deployment preference, not a judged track. You must focus on exactly **1 primary track: WebMCP Challenge — Top 10**; selecting 0 or inventing side tracks violates the brief.

- JUDGING CRITERIA (Official Rules §7): Stage One pass/fail — reasonably fits theme + reasonably applies WebMCP. Stage Two **four equally weighted** (tie-break in listed order): 1) **WebMCP Leverage** — How thoroughly/skillfully does project use WebMCP? Working, non-trivial implementation? 2) **Execution** — Complete, coherent product experience — not just proof of concept? 3) **Potential Impact** — Credible, specific case for real problem/real audience, actually addressed as demonstrated? 4) **Creativity & Ambition** — Creative/novel, differs from existing concepts?

- SUBMISSION GATE (Official Rules §4 — all required or Stage One fail): 1) **Working live URL** that judges can access using ChatGPT in-app browser or Chrome with WebMCP enabled (host on ChatGPT Sites/Cloudflare/Vercel/Render/Netlify/any; if auth, provide credentials in form; must be installable and run consistently, frozen Sep 3 13:00 PDT until Sep 21). 2) **Text description** explaining 4 prompts: why use case is strong fit for WebMCP, how it creates better UX, what people+agents can do together that was difficult/impossible before, briefly how you implemented WebMCP. 3) **Public code repository** (GitHub/GitLab/Bitbucket) containing all source/assets/instructions to be functional, **must include open-source license file detectable/visible at top of repo page (About section)**, must contain `document.modelContext.registerTool` pattern. 4) **Demonstration video <3 minutes** (only first 3 min evaluated) — must include clear demo of project functioning **with audio covering what you built + how you used WebMCP**, must be uploaded publicly to **YouTube**, link on submission form, no infringing material. 5) Completed Devpost submission form by **Sep 3, 2026 @ 1:00 PM PDT (20:00 UTC)**.

- RULES HIGHLIGHTS: New or meaningfully extended with WebMCP after Aug 25, 2026 (pre-existing needs dated commit history); open-source Non-Proprietary Aspects, 3-year promotion license, IP remains entrant's; no financial/preferential support from Sponsor/Administrator; testing via live URL (judges may judge on description/repo/video only); solo/team/org allowed **no cap** (Representative model), eligibility excludes Belarus/Brazil/China/Crimea/Cuba/Donetsk/Luhansk/Hong Kong/Iran/North Korea/Quebec/Russia/Syria/Venezuela + OFAC, must be age of majority in OpenAI API-supported country; online format.

- BONUS: **No bonus integrations.** This event awards no Stage Three points for Gemma/Veo/Lyria/blog/social beyond the Top 10 bundle. Explicitly state "no bonus integration — not worth dilution" in the blueprint.

These are Stage-One pass/fail — a missing mandatory tech = disqualified regardless of idea quality. Therefore:
- §1 Requirements MUST trace the WebMCP mandatory tech to a winning-plan section and to a Judging axis (e.g. "imperative registerTool 5 tools with typed inputSchema + annotations + tools Permissions Policy → AI Solution + WebMCP Leverage 25%; Vercel origin-isolated deploy + inspector video proof → Execution 25%; Maya persona + 25min→3min delta → Potential Impact 25%; visible co-execution with confirmation dialogs vs CSV upload → Creativity 25%").
- §2 Architecture MUST name the imperative WebMCP stack (registerTool with inputSchema/execute/signal/annotations), origin isolation + tools policy handling, the chosen host (Vercel origin-isolated deploy with `vercel --prod`, `tools self`, `allow="tools"` if iframe) with video capture plan (how the <3min YouTube proves registerTool calls in DevTools Application → WebMCP inspector / Model Context Tool Inspector), and diagram wiring. Do not name Gemini/ADK/Cloud Run as mandatory — they are not required for this event.
- §3 Design-plan map MUST allocate a work unit to each mandatory proof artifact (origin-isolated deploy, diagram, <3min video WebMCP inspector segment, spin-up).
- sponsor_tracks choice must be justified as the highest win-probability track for this idea — for this event that is exactly 1 track (WebMCP Challenge — Top 10), not 0 and not 3+.
- Bonus is opt-in only — for this event explicitly state no bonus.

## DELIVERABLES (exact paths) — exactly TWO artifacts, nothing else

This chat produces ONLY the blueprint and the plan-generation prompts. The fully
defined design plans are authored LATER, one per fresh chat window, by executing
the prompts you create here.

1. `design_documents/master_blueprint_entry.md` — the entry's master
    blueprint:
    - §1 Requirements: functional + non-functional, each traced back to
      winning_project_plan.md sections and event judging criteria (§7 four axes).
    - §2 Architecture: components, data flow, envelope/transport wiring from
      engine to the assembled UI (EventEnvelope shape, useEventStream()), plus
      an explicit inter-module contract table: every cross-module function/type/file
      is owned by exactly one module — with file path, export name, and
      input/output shape — so consumers know what to import and never re-implement
      or stub it.
    - §3 Design-plan map: EVERY design plan needed to build the entry — one row
      per plan with id (`DP-<TOPIC>`), title, scope boundaries, the interfaces
      it owns (inputs/outputs/paths), its consumers, its dependencies on other plans,
      and the requirements each of its work units must fulfill when written. This map
      together with §2 is the single binding contract between all follow-up chats.
    - §3a Inter-module boundary rule (why §2+§3 must be in-depth): the blueprint is
      the ONLY shared context between independent authoring chats. If it is vague,
      one module will expose foo() while another independently creates its own
      foo() or stub and neither is used — resulting in disconnected, duplicate
      implementations. To prevent this, §2+§3 must be exhaustive: every
      provider-consumer pair is named once, with owning module, file, export, and
      shape, so authors import rather than duplicate.
    - §4 Submission checklist mapping: deployed Vercel URL, public repo with LICENSE + registerTool proof, disclosure doc, deck/script/demo — which design plan produces which.
    - §5 Risks + degraded-demo fallback ladder (golden cache replay when execute aborts, RES_FORCED_DEGRADED=1, mock envelopes).
2. `design_documents/prompts/PROMPT-DP-<TOPIC>.md` — ONE prompt per
   plan listed in §3. Each must be FULLY SELF-CONTAINED: executing it in a
   FRESH chat window (operator types only "Read and execute
   design_documents/prompts/PROMPT-DP-<TOPIC>.md") yields the complete,
   chassis-format design plan at
   `design_documents/design_plans/DP-<TOPIC>.md` without reading any
   other file.

**DO NOT write the design plans themselves in this chat.** If your output
contains files under `design_plans/`, you have violated this instruction.

## HARD QUALITY BAR — the implementor is a LOW-INTELLIGENCE model

Encode this bar into §2+§3 of the blueprint AND into every PROMPT-DP-*.md file, so
the author chats produce design plans under which the implementor cannot infer
anything and no two plans duplicate the same cross-module contract:

- fully define every contract: exact file paths, exported names, function
  signatures, input/output JSON shapes — and for cross-module contracts,
  state owning module, file, export, and all consuming modules (single owner,
  N consumers; consumers MUST import, never re-define or stub);
- spell out every algorithm as numbered steps or pseudocode — no "use judgment",
  no "as appropriate", no unstated defaults;
- every work unit ends with one runnable verification command and its expected
  output (for cross-module work units, the command must exercise the actual
  provider→consumer import);
- if a task genuinely requires higher intelligence, split it until it does not,
  or move that part into a prompt template the runtime LLM call receives.

## CONSTRAINTS

- Engine code lives ONLY inside the assembled working copy
  (`../hackathon-entries/<entry>`): `engine/` stubs marked TODO(ENGINE) plus
  new files under `src/`. NEVER modify the chassis repo's `src/`.
- Compose chassis modules via their documented CLIs/APIs; wrap every outbound
  LLM call with `withResilience`; emit progress as EventEnvelopes so the
  platform UI streams it.
- Budget honesty: prefer deterministic code over extra LLM calls; degrade
  gracefully (DegradedResult) instead of crashing mid-demo.

## FINISH

Print the list of generated files (blueprint + PROMPT-DP-*.md) and stop. Do NOT
write anything under design_plans/ and do NOT implement anything yourself.
