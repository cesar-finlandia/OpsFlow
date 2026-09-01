> **Provenance:** transcribed on **2026-09-01** — **DEFINITIVE kickoff-day version** — from **https://webmcp.devpost.com** and **every tab carrying binding information** read fresh today via direct HTTP fetch: **Overview** (`/`), **Resources** (`/resources`), **Rules** (`/rules` — *Official Rules*), **Updates** (`/updates`), **Discussions** (`/forum_topics`), **Project gallery** (`/project-gallery`), **Participants** (`/participants`), **Schedule** (`/details/dates`), plus every binding linked page reached from those tabs: **WebMCP specification** (`https://webmachinelearning.github.io/webmcp/` — Draft Community Group Report 2026-08-26), **Chrome developer documentation** (`https://developer.chrome.com/docs/ai/webmcp` plus sub-pages `/imperative-api`, `/declarative-api`, `/secure-tools`, `/evals`, `/best-practices`), **WebMCP origin trial** (`https://developer.chrome.com/blog/ai-webmcp-origin-trial`), **WebMCP Showcase** (`https://developers.openai.com/showcase?view=webmcp-apps`), **ChatGPT Sites** (`https://learn.chatgpt.com/docs/sites`), **Cloudflare / Vercel / Shopify / Render / Netlify** resource links listed on Resources, and **Devpost Terms / Privacy** incorporated by reference. Cross-checked with on-page HTML, schedule JSON helper, and Rules §1–§16. Items marked **`[unconfirmed]`** were not yet published on the event site at transcription time and remain open questions for the Updates feed / Discussions board / OpenAI Discord — **never a silent assumption**. Where a figure was quoted exactly, it appears verbatim.
>
> Purpose: single paste-input for `src/profile` (Event Profile Extractor) and `src/pgm` (Problem Grounding Engine), per `docs/tutorials/TU16-mock-hackathon-walkthrough.md`. Official facts above the `---` separator are transcribed exactly as published; my own analysis lives exclusively below it under *My annotations*.

---

# The WebMCP Challenge — Official Brief

**10 days for exploring what's possible with WebMCP**

🌎 **Online** · Public · 📅 **August 25 – September 3, 2026** (Submission Period) · ⏰ **Submissions close Sep 3, 2026 @ 1:00 PM PDT (20:00 UTC)** · Sponsored by **OpenAI** (Sponsor: OpenAI OpCo, LLC) — Administrator **Devpost, Inc.** · Hosted on **Devpost** · **5,067 participants** as of 2026-09-01 · Themes: Machine Learning/AI, E-commerce/Retail, Web

> **Classification — DEFINED.** The binding challenge, mandated stack, deliverables, constraints, and judging rubric are published verbatim in the Overview, Resources, and Official Rules tabs and quoted exactly in §4 below. Any residual ambiguity is listed as an explicit open question in My annotations, not assumed away.

Central premise — quoted from the event (Overview):

> *"WebMCP is an emerging open standard that lets websites expose structured tools agents can use directly. Instead of leaving agents to guess their way through your UI, you define exactly how they can use your app, so they complete tasks faster, more accurately, and more reliably."*
>
> *"The WebMCP Challenge invites you to build something we haven't seen before: an app that becomes meaningfully better when people and their agents can use it together."*

## Summary of the definitive challenge (see §4 for verbatim)

Build a **WebMCP-powered web app** that imagines and explores the future of the open web — where humans and agents can interact, collaborate, and create together — by exposing structured, agent-callable tools via `document.modelContext.registerTool()`. See §4 for the exact quoted requirement, platform constraints, and "new & existing" rule.

## Tracks — structure — summary (see §4 for verbatim)

This event has **no layered tracks and no separate sponsor sub-challenges**. There is **one overall challenge** (WebMCP-powered web app); judging is **overall ranking across all eligible submissions** for the single prize bucket (Top 10). Choice of hosting/deployment provider does **not** create a separate track. See §4 for quoted details and the single prize bucket definition.

How to get started (quoted from Overview, 4 steps): **Learn what WebMCP enables → Get inspired → Build and deploy → Test your app** (see §4 for full text + testing browsers).

## Mandated technology and how to obtain credits/keys — summary (see §4 for verbatim + full procedure)

- **WebMCP (mandatory for every submission)** — Imperative API `document.modelContext.registerTool({ name, description, inputSchema, execute })` and/or Declarative API (HTML form annotations). Testing requires **ChatGPT desktop app in-app browser** (WebMCP default) **or Google Chrome 149+ with `chrome://flags/#enable-webmcp-testing` enabled** + restart (+ origin trial registration for hosted origin). No API key; API is gated by **origin isolation** and **`tools` Permissions Policy** (`allow="tools"` for cross-origin iframes). See §4.
- **No sponsor API key is required to satisfy the challenge** — optional hosting/supporter credits only: Vercel $30 build credits (first 1,000 builders, code `OAIWEBMH-9E2F-MUT4`), Render $50 credits (first 500 claims, 1-year validity), Netlify 3,000 credits (first 1,000 eligible builders via form by Sep 1 12:00 PT), Cloudflare free-tier (Workers/Pages/Browser Run), Shopify/Chrome docs only. ChatGPT Sites requires a **paid ChatGPT plan** (not available UK/EEA/Switzerland). See §4 for exact URLs, amounts, and deadlines.

## Official resources — summary (see §4 for full verified link list)

Curated on `/resources` in two sections: **Documentation** (spec + Chrome docs + origin trial + tool security guide) and **Resources from hackathon supporters** (OpenAI, Cloudflare, Vercel, Shopify, Google Chrome, Render, Netlify) — each with 2–6 verified links. All links verified 2026-09-01 — see §4 for complete list.

## Prizes

**Total pool: $35,000 in prizes** (site header: *"$35,000 in cash"*; Resources/Overview prize card). Prize structure is **one bucket: Top 10 submissions** — each winner receives the full sponsor bundle below. Payable within 60 days of Required Forms; taxes/fees winner's responsibility — see §4 for quoted terms.

| Sponsor | Prize per winning submission (×10) | Notes |
|---|---|---|
| **OpenAI** | **$3,000 USD cash** + Spotlight on @OpenAIDevs on X + **Codex Micro** + **Swag for up to 3 members** + **ChatGPT Pro for 1 year for up to 3 members** | Header card renders "$3,500 in cash" — Rules §9 clarifies $3,000 cash per winner (see schedule note). |
| **Cloudflare** | **$10,000 in Cloudflare credits** | per winner (×10 = $100k credits pool implied) |
| **Vercel** | **$300/mo Vercel credits + $50/mo Gateway credits × 12 months ($3,600 + $600)** | per winner |
| **Render** | **$300 in Render credits** | per winner |
| **Netlify** | **$500 in cash from Netlify** | per winner — prize card says "$500 in cash prizes" |
| **Shopify** | **$250 in limited-edition Shopify Supply gear** | per winning submission |
| **Google Chrome** | **3-month subscription to Google AI Ultra per winning team member (~$300 value / member)** | per member |

*Each Project eligible for **one prize bucket**; max one prize per Submission (see §4). If zero eligible Submissions, no prize awarded. Cash paid to individual / Representative / Organization as entered.* See §4 for verbatim prize table and substitution/tax/delivery terms.

## Full schedule (all times quoted exactly as published, with UTC conversion)

| When (as published) | When (UTC) | What |
|---|---|---|
| **Mon Aug 25, 2026 @ 11:00 AM PT** — rendered on `details/dates` as **Aug 25 12:00 PM PDT** | **2026-08-25 18:00 UTC** (if 11:00 PT) / **2026-08-25 19:00 UTC** (if 12:00 PDT rendering) | **Registration Period begins · Submission Period begins** (Official Rules §1) |
| **Mon Sep 1, 2026 @ 12:00 PM PT** | **2026-09-01 19:00 UTC** | **Netlify credits form closes** (Resources: *"by September 1st at 12pm PT"*) |
| **Wed Sep 3, 2026 @ 1:00 PM PDT** — rendered site header as *"Deadline: Sep 3, 2026 @ 1:00pm PDT"* / *"September 03 at 1:00pm PDT"* | **2026-09-03 20:00 UTC** | **Registration Period ends · Submission Period ends — hard deadline. Late submissions disqualified. No edits to Devpost submission, repo, or live site during judging.** (Rules §1, §4, §6) |
| **Thu Sep 4, 2026 @ 10:00 AM PT** | **2026-09-04 17:00 UTC** | **Judging Period begins** |
| **Sun Sep 21, 2026 @ 5:00 PM PT** | **2026-09-22 00:00 UTC** | **Judging Period ends** |
| **On or around Wed Sep 23, 2026 @ 2:00 PM PT** | **2026-09-23 21:00 UTC** | **Winners Announced** (Rules §1) |

Timezone note: Rules define times in **PT/PDT**; PDT (UTC−7) is in effect Aug 25–Sep 23 (Pacific Daylight). Both header and Rules resolve Sep 3 deadline to **20:00 UTC**. The one-hour discrepancy between Rules text (11:00 AM PT) and `details/dates` card (12:00 PM PDT) on start time is quoted verbatim above — treat Rules as authoritative; calendar the earlier. Updates mid-event confirm midpoint: *"Submissions close Thursday, September 3rd at 1:00 PM PT"* (`/updates/46123`). See §4 for full quoted schedule.

## Teams & participation rules — summary (see §4 for quoted eligibility)

- **Format:** Fully **online**; public; worldwide where OpenAI API supported.
- **Eligibility:** Above age of majority; resident/domiciled in country/territory supporting OpenAI API; **excluded**: Belarus, Brazil, China, Crimea, Cuba, Donetsk/Luhansk People's Republics, Hong Kong, Iran, North Korea (Korea DPR), Quebec, Russia, Syrian Arab Republic, Venezuela + any OFAC-designated + where US/local law prohibits; not on denied lists; employees/families of Promotion Entities, Judges, etc. ineligible.
- **Team size:** **No cap** — individual, team, or organization allowed; organization must be incorporated in a supported country. Appoint one **Representative** to act. An individual may join multiple Teams/Organizations and enter solo separately.
- **No purchase necessary; original work** — newly created or meaningfully extended with WebMCP after Aug 25 if pre-existing.

See §4 for full quoted eligibility and IP/integration terms.

## Submission — the EXACT list of fields (as evaluated) — summary

A complete Submission must conform to **Official Rules §4 — Project & Submission Requirements** and the Devpost *"Enter a Submission"* page. Missing any risks Stage One failure — see §4 for verbatim:

| # | Field (exactly what judge/automated checker expects) | Requirement detail (see §4 for verbatim) |
|---|---|---|
| 1 | **Working live URL** (for judging/testing) | Hostable anywhere (ChatGPT Sites, Cloudflare, Vercel, Render, Netlify, Shopify, any provider). Must be **successfully installable and run consistently** on intended platform; if authenticated, provide credentials in form. Keep available, unchanged until judging ends; fork to continue building. |
| 2 | **Text description** (4 prompts) | Must explain: *why use case is strong fit for WebMCP*, *how it creates better UX*, *what people + agents can do together that was difficult/impossible before*, *briefly how you implemented WebMCP*. |
| 3 | **URL to public code repository** (GitHub/GitLab/Bitbucket) | Must contain all source/assets/instructions to be functional; **must include open-source license file** detectable at repo top (About section); must contain working `document.modelContext.registerTool({ name, description, inputSchema, execute })` pattern. |
| 4 | **Demonstration video** | **<3 minutes** — only first 3 min evaluated; must include clear demo of project functioning **with audio covering what you built + how you used WebMCP**; **public YouTube link**; no infringing/trademarked material. |
| 5 | **Completed Devpost submission form** | All required fields on *"Enter a Submission"* page during Submission Period, by authorized account holder; may save drafts before deadline. |

*Multiple submissions allowed per Entrant if each is unique/substantially different. All materials in English or with English translation. Images if present must show Project functioning.*

## Judging criteria (Official Rules §7 — equal-weighted)

Stage One is **pass/fail viability screen** — *"reasonably fits the theme and reasonably applies the required APIs/SDKs"*.

Stage Two scores every Stage-One-passing submission on **four equally weighted criteria** (no numeric weights published; tie-break is criteria in listed order, then judges vote):

| Axis (exact label) | Weight | What judges look for (quoted) |
|---|---|---|
| **WebMCP Leverage** | Equal (25% implied) | *"How thoroughly and skillfully does the project use WebMCP? Does the code reflect genuine effort and a working, non-trivial implementation?"* |
| **Execution** | Equal | *"Does the project deliver a working or runnable project that has a complete, coherent product experience — not just a technical proof of concept?"* |
| **Potential Impact** | Equal | *"Does the project make a credible, specific case for solving a real problem for a real audience — and does the solution actually address that problem based on what's demonstrated?"* |
| **Creativity & Ambition** | Equal | *"How creative and novel is the concept and does the project differ from existing concepts?"* |

*Highest-scoring Submissions become potential winners. Sponsor/Administrator may use expert panels, peer review, or automated AI-driven analysis at sole discretion. Judges listed on Overview: Sarah Drasner (Chrome), Justin Rushing (OpenAI), Andrew Galloni (Cloudflare), Alex Nahas (MCP-B), Ilya Grigorik (Shopify), Jude Gao (Vercel), Sean Roberts (Netlify) — full roster on Overview → Judges.*

## Rules highlights — summary (see §4 for verbatim and citations)

- **Originality + new/existing rule:** new during Submission Period or meaningfully extended with WebMCP after Aug 25; document what's new vs pre-existing.
- **License & disclosure:** all Non-Proprietary Aspects under detectable open-source license at repo top; non-exclusive judging/promotion license to Sponsor/Devpost for 3 years; IP remains entrant's.
- **Financial support:** no prize for Project developed with financial/preferential support from Sponsor/Administrator.
- **Testing & freeze:** provide live URL + credentials; keep frozen Sep 3 13:00 PDT until Sep 21; judges not required to test, may judge on description/repo/video only.
- **Governing law & arbitration:** New York substantive law; exclusive binding AAA arbitration near contestant; class-action waiver.
- **Privacy & terms:** Devpost Terms of Service + Privacy Policy incorporated by reference; contact `support@devpost.com`, hackathon manager `shawni@devpost.com`.

See §4 for full quoted highlights and links to Official Rules + Devpost Terms.

---

## My annotations (NOT part of the official brief)

### The official project broken down for my use

- **Specific user persona (one, named — required for Potential Impact):** pick exactly one, not "everyone who uses the web." Strong fits for WebMCP's *"humans + agents together"* thesis:
  - *Freelance operations coordinator* for a small e-commerce store (Shopify + Vercel track affinity) who fulfills 20–40 orders/day and lives in tabs: inventory CSV, shipping rate calc, support inbox.
  - *Accommodating travel planner for a family of four* booking multi-city, multi-passenger trips with constraints (budget, accessibility, loyalty).
  - *First-time marketplace seller* onboarding a product catalog to multiple storefronts (Shopify, Cloudflare) without learning each admin UI.
  Choose one. Name them in pitch, deck, and description. "Knowledge workers" as a category is not a persona.

- **What it does (one sentence, agent-shaped):** A **deterministic, tool-driven web app** where the page itself exposes 3–6 `document.modelContext.registerTool()` tools (e.g., `search_products`, `filter_results`, `checkout`, `schedule_task`, `explain_state`) that a **user's agent calls directly** — instead of scraping the DOM — to co-complete a multi-step task with the user in shared, visible context (e.g., user says "find me a 3-stop EU trip under €800 for 4 with aisle seats," agent calls `search_flights → filter_results → hold_itinerary` while the UI updates live, user confirms, agent calls `checkout` with a confirmation dialog).

- **Why AI / why now (one sentence, must survive the "why not a form + DB?" filter):**
  Agent actuation by scraping is **brittle and slow** (DOM hallucination, N-step interpretation). WebMCP's declared tools + JSON Schemas give **explicit purpose, state, and typed I/O**, so the agent knows exactly how to interact — higher accuracy, fewer steps, user trust via visible execution. WebMCP only reached **Chrome 149 origin trial + ChatGPT in-app browser support in Aug 2026** (spec Draft 2026-08-26) — two years ago this path didn't exist as a standard.

- **Business value:**
  - *Named user* as above; *revenue model* = B2C freemium/pro per-workspace or per-seat for the hosted app, or **B2B infrastructure wedge**: the WebMCP pattern itself becomes a distribution moat (agent-native storefronts convert higher, support tickets drop). *TAM anchor* = web commerce / travel / ops-tooling vertical for the chosen persona (pin exact figure during PGM — do not invent). Even a narrow TAM is credible if the co-task is specific and demonstrably improved.
  - Measurably reduces a bottleneck WebMCP explicitly invites: **form-filling / filtering / checkout / scheduling tedium where agents currently guess**.

- **Demo story (under 3-minute video, then live URL):**
  - 0:00–0:20 — Problem + named persona (one sentence).
  - 0:20–1:40 — **Live functioning footage** with audio: user speaks/types a goal, **agent calls a registered tool visibly**, UI updates deterministically (show DevTools → Application → WebMCP inspector or the Model Context Tool Inspector extension listing tools). Repeat for 2–3 tools in a coherent flow (search → refine → act). **Show the code snippet** `registerTool` briefly to prove non-trivial implementation.
  - 1:40–2:30 — Why this is a strong fit for WebMCP (declarative vs scraping comparison) + what humans+agents can do together that was impossible before (e.g., agent operates a human-first date picker via `date_pick` tool).
  - 2:30–3:00 — Tech + ask. Cut at 3:00. Upload to **YouTube, public**, same URL in submission.
  - The live URL must then let a judge reproduce the same flow in **ChatGPT in-app browser or Chrome 149+ with flag enabled** with no local setup. Have a **DEMODRIVE golden capture** ready as fallback if the live agent call flakes (recorded video + screenshots from the validated script).

- **Judging-axis strategy — how each axis gets evidenced by my build via DECKGEN / SCRIPT / FAQDEF / SUBMIT artifacts:**

  | Axis | Strategy | Which artifact evidences it |
  |---|---|---|
  | **WebMCP Leverage** | Show *imported + called* `document.modelContext.registerTool` for **≥3 non-trivial tools** with typed `inputSchema`, annotations (`readOnlyHint`/`untrustedContentHint`), permission handling, and visible execution; demonstrate **declarative + imperative** is a bonus; tool security guide mitigations cited. Not a single untouched call. | **Repo** (call-site citations, `registerTool` + `getTools`/`executeTool` if in-page agent) + **Deck** (Tech Overview slot + arch diagram from manifest) + **FAQDEF** (deep-dive on tool design, schema, permissions) |
  | **Execution** | Deliver a **complete, coherent product experience** in ≤3 screens: goal → agent tool calls → visible state change → confirmation. No settings maze; handles degraded mode explicitly. | **SCRIPT** (timestamped storyboard forces coherence) + **DEMODRIVE** (golden-path capture proves it) + **Deployed URL** (coherent on both target browsers) |
  | **Potential Impact** | Name one persona + one bottleneck; quantify time/step delta vs scraping baseline; show the solution actually addresses it in demo (before/after step count). | **Deck** (Problem / Business Value slots) + **SCRIPT** (1:40–2:30 business case) + **Submission description** (4-prompt answers) |
  | **Creativity & Ambition** | Non-obvious pairing of WebMCP tools with a narrowly scoped co-task; show understanding of actuation vs declaration tradeoff; differentiating chrome (e.g., confirmation dialogs for sensitive actions, cross-origin iframe with `allow="tools"`). | **FAQDEF** (originality/predictability questions) + **Deck** (Why Now slot) + **PGM evidence** (Reddit-grounded pain) |

### Chassis module mapping implied by the definitive challenge (grounded in `contracts/component-catalog.json`)

Mandated tech → module decision (include = must, lean = default-include, skip = rationale-skipped):

| Module (catalog id) | Verdict | Why — tied to exact brief text |
|---|---|---|
| **resilience** (`resilience`) | **Include** | GOV-MIN-01 — WebMCP `execute` callbacks are async and may abort; bearer agent calls can fail. `withResilience` + `DegradedResult` + golden cache prevents blank-screen mid-demo when tool execution rejects. Zero runtime deps. |
| **context** (`context`) | **Include (lean)** | Co-task involves multi-turn agent + tool-output context. Buffer manager prevents hard context-length error mid-demo; heuristic counter suffices for browser-side payloads. Zero deps. |
| **cost** (`cost`) | **Lean / optional** | WebMCP itself is browser-native (no LLM billing), but if you add an LLM co-pilot behind tools, per-call metering still valuable. Lightweight; leave out if purely rule-based tools. |
| **platform** (`platform/deploy/transport/ui`) | **Include (deploy + transport + ui)** | **Hosted URL is a required submission field** evaluated by judges. Transport powers streaming tool-output rendering; UI themes give the "complete product" Execution axis. Deploy provider: any of ChatGPT Sites / Cloudflare / Vercel / Render / Netlify / Shopify — Vercel/Cloudflare have the most WebMCP-specific templates on Resources. Set `DEPLOY_PROVIDER` accordingly; if ChatGPT Sites chosen, note paid-plan + region limitation. |
| **media** (`media/stt/vision/pdf/tts`) | **Skip unless demo is voice/multimodal** | `media/*` sub-wrappers only if the demo story needs STT/TTS/vision/PDF. WebMCP tools themselves handle structured I/O; media is an orthogonal input channel. Each sub-wrapper individually optional per GOV-MIN-03 — pick only if judged-relevant. |
| **data** (`data`) | **Include (lean)** | Synthetic demo-data generator seeds the app state (catalog, inventory, itinerary) for offline rehearsal; watermarked `synthetic:true` so claims stay honest. Especially useful for commerce/travel demos needing realistic fixtures without real PII. |
| **dev-tooling** (`dev-tooling/mock/eval/doctor/track/bench`) | **Include** | `mock` lets UI stream against replayed tool-call envelopes offline; `eval` regression-proofs any LLM policy behind tools; `doctor` catches deploy/origin-trial misconfig before Hour 40; `track` keeps deck/script/submission from going stale after a plan pivot. All verified offline. |
| **provenance** (`provenance/prov/submit`) | **Include** | License detectability at repo top is scored in Stage One; provenance generates the required open-source disclosure from `assembly.manifest.json`. Submission formatter gates on repo hygiene before pushing public. |
| **ideation** (`ideation/pit/idea/retro/deckgen/script/demodrive/faqdef`) | **Include (pit/deckgen/script/demodrive/faqdef)** | DECKGEN/SCRIPT/FAQDEF/DEMODRIVE directly produce the artifacts this event scores (deck, 3-min script, golden demo, Q&A). PIT/IDEA/RETRO are manual fallbacks when PGM/Advisor are offline. |
| **pgm / profile** (`pgm`, `profile`) | **Pre-assembly only** | Already consumed producing this brief + the next-step `event_profile.json` + `winning_project_plan.md`. Rationale-skipped in delivered working copy per GOV-MIN-03 (NONGOAL-12). |
| **assembly-advisory** (`assembly-advisory`) | **Pre-assembly only** | Advisor proposes the manifest (this table is the human-approved version); assembly scaffolds the working copy. Rarely ships inside the delivered app. |

**Env vars / provider keys implied by included modules (from catalog `requires_env`/`requires_providers`):**

- Always (if platform/deploy included): deploy provider creds — `VERCEL_TOKEN`/`VERCEL_PROJECT_ID` for Vercel, **or** Cloudflare/Netlify/Render equivalents via `DEPLOY_PROVIDER`; **ChatGPT Sites:** needs a paid ChatGPT plan, not an env var. No `OPENAI_API_KEY` required by WebMCP itself.
- If `media`/`data`/`ideation` LLM polish selected: `OPENAI_API_KEY` + optionally `REPLICATE_API_KEY`/`ELEVENLABS_API_KEY`/`ANTHROPIC_API_KEY` per sub-wrapper (catalog rows) — but the submitted app must still demonstrate **runtime WebMCP**, not just an LLM wrapper.
- If `ideation/demodrive` capture selected: optionally `PLAYWRIGHT` (browser automation).
- Reddit tiers: optionally `REDDIT_CLIENT_ID` for PGM live tiers — but PGM tier-1/2 are keyless via public endpoints / browser fallback; `--llm sweep` also applies.

### Constraints I care about

- **Solo/team:** Solo, team, or organization all allowed — **no cap on team size** (Rules §3). Solo explicitly eligible; if team, appoint one **Representative**. A cash prize is paid to the individual / Representative / Organization as entered; internal split is the Representative's responsibility. A few prize items (e.g., Pro account, swag) only cover up to 3 members — that's a prize limit, not a team limit.
- **Online:** Fully online — build from anywhere; no on-site requirement. Testing requires either ChatGPT in-app browser or Chrome 149+ with flag.
- **Demo must survive bad Wi-Fi (offline golden path):** Hosted URL is required, but the **<3-min trailer is the fallback ladder's rung 3**. Capture golden-path video + screenshots **early** via **DEMODRIVE** (`--data-source mock`) while tools work; set `RES_FORCED_DEGRADED=1` to serve cached tool-result replay if live origin trial fails. `npm run dev + mock:publish` gives a localhost sync render replaying mock tool-call envelopes with zero network.
- **Credit/kit claiming procedure (do on day 0):**
  - **Vercel:** $30 build credits (first 1,000) at `https://credits.vercel.sh/redeem` + code `OAIWEBMH-9E2F-MUT4` — redeem immediately.
  - **Render:** $50 credits (first 500) at `https://credits-portal-mmdm.onrender.com/claim/openai-hackathon` — valid 1 year.
  - **Netlify:** 3,000 credits (first 1,000 eligible) via `https://forms.gle/xw75XGUQzCXEiALc7` **by Sep 1 @ 12pm PT** — even existing users eligible.
  - **Cloudflare:** free-tier Workers/Pages + Browser Run + `https://github.com/cloudflare/agents/tree/main/examples/webmcp-react` template; credits not form-gated.
  - **ChatGPT Sites:** build/host inside ChatGPT — needs paid plan; not available UK/EEA/Switzerland.
  - No other credit form — WebMCP spec/Chrome flag are free. Install **Model Context Tool Inspector** extension (`gbpdfapgefenggkahomfgkhfehlcenpd`) to verify `inputSchema` and manually invoke tools.
- **Hard deadline (absolute):** **2026-09-03 @ 1:00 PM PDT = 2026-09-03 20:00 UTC = 2026-09-03 16:00 EDT** (`endDate` on site header; Rules §1 §6). Late submissions disqualified. **Do not edit Devpost submission, repo, or live site from Sep 3 13:00 PDT until winners announced** — fork to keep building. Plan to submit with hours to spare; draft-saves allowed until deadline, then locked.

---

## Hackathon Rules - Requirements - Tracks

*This section is the sole source-of-truth for the hackathon's binding challenge, tracks, requirements and rules as published on https://webmcp.devpost.com and its binding linked pages (Official Rules, Resources, WebMCP specification, Chrome developer documentation). It contains verbatim excerpts (quoted) of the most important rules, requirements and tracks plus a concise summary; other sections above contain only one-line summaries with cross-reference "see §4" and checklist tables (prizes, schedule, teams, submission fields, judging criteria, official resources) are not re-listed here in full — see §2 for those. Do not invent anything — only transcribe/summarize what the site actually states.*

### 1. Binding challenge — verbatim

Quoted verbatim from **Overview → Requirements → What to Build** (also duplicated in **Official Rules §4 — Project Requirements → What to Create**):

> **"Build a WebMCP-powered web app that imagines and explores the future of the open web—where humans and agents can interact, collaborate, and create together."**

Mandatory companion clause — read together with the above (Overview — introductory context):

> **"WebMCP is an emerging open standard that lets websites expose structured tools agents can use directly. Instead of leaving agents to guess their way through your UI, you define exactly how they can use your app, so they complete tasks faster, more accurately, and more reliably."**

Therapeutic gloss from Overview — Why join:

> **"Explore what new experiences that become possible when web apps can be built for people and their agents. Help shape an emerging open standard and the future of the agent-native web."**

How to get started (4 steps, quoted from Overview → Get started):

> 1. **"Learn what WebMCP enables. Read the WebMCP specification and Chrome's developer documentation to understand how websites can expose tools to AI agents."**
> 2. **"Get inspired. Explore the WebMCP Showcase for examples of agent-native apps and ideas for what you could build, and read the WebMCP guide from OpenAI."**
> 3. **"Build and deploy. Create a new WebMCP-enabled app or add WebMCP support to an existing one. Host it on ChatGPT Sites, Cloudflare, Vercel, Render, Netlify, Shopify, or any deployment platform you choose."**
> 4. **"Test your app. Open your deployed app in ChatGPT's in-app browser, which supports WebMCP out of the box. To test in Google Chrome, enable WebMCP using chrome://flags/#enable-webmcp-testing."**

Platform constraint (Resources → Starter guidance, quoted verbatim):

> **"Start with the documentation and supporter resources below, then test your deployed app in ChatGPT's in-app browser or Google Chrome with WebMCP enabled via chrome://flags/#enable-webmcp-testing. Use starter templates and example apps for inspiration."**

### 2. Tracks — verbatim

This hackathon has **one track: WebMCP** — no partner-led sub-tracks, no layered overall-vs-sponsor structure. Quoted from Official Rules §9 — Prize header:

> **"WebMCP Challenge Winners — Top 10 submissions receive the following prizes from the hackathon sponsors: ... 10 winners — All eligible Submissions"**

Quoted from Rules §7 — Judging §7 Stage One/Stage Two header:

> **"Eligible submissions will be evaluated by a panel of judges selected by the Sponsor ... Judging may take place in one or more rounds ..."**

> **"Stage One) The first stage will determine via pass/fail whether the ideas meet a baseline level of viability, in that the Project reasonably fits the theme and reasonably applies the required APIs/SDKs featured in the Hackathon."**

> **"Stage Two) All Submissions that pass Stage One will be evaluated in Stage Two based on the following equally weighted criteria (the 'Judging Criteria')..."** — four criteria as listed in §2 (WebMCP Leverage, Execution, Potential Impact, Creativity & Ambition).

*No separate track selection field exists on the submission form — the challenge is the track. Hosting-provider choice (ChatGPT Sites / Cloudflare / Vercel / Render / Netlify / Shopify / any other) is a deployment preference, not a judged track.*

### 3. Mandated technology and credits/keys — verbatim

**Mandated platform (non-negotiable — every track):**

- **WebMCP is mandatory.** Repository must demonstrate imported-and-called usage, not just README mention (Resources → Support, code snippet is the check). Quoted pattern required to appear in repo (Overview → Requirements and Rules §4):

> ```javascript
> document.modelContext.registerTool({
>   name: "search_products",
>   description: "Search the product catalog",
>   inputSchema: { /* ... */ },
>   execute: async (input) => { /* ... */ }
> });
> ```

Quoted from the **WebMCP Draft Community Group Report (webmachinelearning/webmcp, 2026-08-26)** — API surface (§4.2 ModelContext):

> **`document.modelContext.registerTool(tool, options)` — Registers a tool that agents can invoke. Returns a rejected promise if a tool with the same name is already registered...**; **`document.modelContext.getTools(options)` — Returns a promise that resolves to a list of registered tools...**; **`document.modelContext.executeTool(tool, inputObject, options)` — Executes a tool on the document it was registered on.**

Full IDL + semantics: `webmachinelearning/webmcp` — `ModelContext` interface `registerTool`/`getTools`/`executeTool`, `ModelContextTool` dictionary (`name`, `title`, `description`, `inputSchema`, `execute`, `annotations`), `ToolExecuteCallbackOptions` (`signal`), `ModelContextRegisterToolOptions` (`signal`, `exposedTo`), permissions policy `tools` (defaults to `self`). Security §6 covers prompt-injection, misrepresentation of intent, privacy leakage, same-origin violations, and mitigations (input length limits, untrusted annotation).

Browser enablement — quoted from Chrome docs + Resources:

> **"Get access to WebMCP. Download the ChatGPT desktop app and use its in-app browser, which supports WebMCP by default. Alternatively, download Google Chrome 149 or later, enable chrome://flags/#enable-webmcp-testing, and restart the browser."** — Rules §4 How To Enter, step 3

> **"WebMCP is only available in origin-isolated documents. ... Both APIs are gated by the `tools` Permissions Policy. The policy defaults to `self`, which allows tool registration in top-level and same-origin contexts, and disables it for cross-origin iframes. To allow WebMCP tools in a cross-origin iframe, add the `allow=\"tools\"` attribute to the iframe."** — Chrome docs (`developer.chrome.com/docs/ai/webmcp`, Security & permissions)

> **"Join the WebMCP origin trial from Chrome 149. ... WebMCP is available as a Chrome flag for local development: 1. Open Chrome and navigate to `chrome://flags/#enable-webmcp-testing` 2. Set the flag to Enabled. 3. Relaunch Chrome"** — Chrome docs, Get started / Local WebMCP

> **Imperative API:** Define tools with standard JavaScript (form input, navigation, state, or other functions). **Declarative API:** Add annotations to standard HTML forms to create a WebMCP tool. — Chrome docs (`/imperative-api`, `/declarative-api`)

> **Limitations:** headless browsing limited, overhead for complex interfaces, tool discoverability requires visiting the site.

**"New & Existing" rule — quoted verbatim from Official Rules §4:**

> **"New & Existing: Projects must be either newly created during the Hackathon Submission Period or, if the Project existed prior to the Submission Period, must have been meaningfully extended using WebMCP after the Submission Period start date. Pre-existing Projects will be evaluated only on work added during the Submission Period. Entrants with pre-existing Projects must provide clear documentation distinguishing prior work from new work, including evidence that it was meaningfully extended with WebMCP within the Submission Period (e.g., timestamped, dated commit history, or equivalent)."**

**Third-Party Integrations — quoted from Rules §4:**

> **"If a Project integrates any third-party SDK, APIs and/or data, Entrant must be authorized to use them in accordance with any terms and conditions or licensing requirements of the tool."**

**Platforms — quoted from Rules §4:**

> **"A submitted Project must run on the platform for which it is intended and which is specified in the Submission Requirements."**

> **"Functionality: The Project must be capable of being successfully installed and running consistently on the platform for which it is intended and must function as depicted in the video and/or expressed in the text description."**

**Supporter SDK / hosting access — quoted / verified (no mandated AI model, no sponsor-exclusive stack):**

| Provider | How to get access (verified link) | Cost/credit note (quoted) |
|---|---|---|
| **ChatGPT Sites** | `https://learn.chatgpt.com/docs/sites?surface=app` | Build/host inside ChatGPT — needs paid ChatGPT plan; not available UK/EEA/Switzerland (Resources FAQ) |
| **Cloudflare** | Overview at `https://blog.cloudflare.com/webmcp/`; Browser Run docs `https://developers.cloudflare.com/browser-run/features/webmcp/`; Demo `https://webmcp-coffee.jilles.fyi/`; Landing `https://webmcp-challenge.examples.workers.dev/`; Template `https://github.com/cloudflare/agents/tree/main/examples/webmcp-react`; Pages/Workers `https://developers.cloudflare.com/pages/` | Free-tier Workers/Pages (Resources: *"Cloudflare, Vercel, Netlify, and Render all have solid free tiers that cost nothing to build on"*) |
| **Vercel** | Storefront source `https://github.com/vercel/shop`; PR `https://github.com/vercel/shop/pull/498`; Demo `https://template.vercel.shop/`; Pricing `https://vercel.com/pricing`; Redeem `https://credits.vercel.sh/redeem` | **"$30 in build credits (first 1000 builders) - and use code OAIWEBMH-9E2F-MUT4"** |
| **Shopify** | WebMCP tools docs `https://shopify.dev/docs/api/web-mcp`; Agentic tools `https://shopify.dev/docs/agents` | No separate credit quoted; gear prize only |
| **Google Chrome** | `useWebMCPTool` hook `https://www.npmjs.com/package/use-webmcp-tool`; Explainer `https://github.com/webmachinelearning/webmcp/blob/main/README.md`; Angular `https://angular.dev/ai/webmcp`; Evals `https://developer.chrome.com/docs/ai/webmcp/evals`; Debug `https://developer.chrome.com/docs/devtools/application/webmcp`; Modern Web Guidance skill `https://github.com/GoogleChrome/modern-web-guidance`; Demos `https://github.com/GoogleChromeLabs/webmcp-tools/tree/main/demos` | Flag-gated free |
| **Render** | Workflows `https://render.com/workflows` + docs `https://render.com/docs/workflows`; Templates `https://render.com/templates`; Claim `https://credits-portal-mmdm.onrender.com/claim/openai-hackathon`; Credits docs `https://render.com/docs/credits` | **"Claim $50 in Render credits; initially available for up to 500 claims. Credits are valid for one year after being applied and can cover workspace costs, including plan fees, compute usage, and bandwidth."** |
| **Netlify** | `https://netlify.com/` — create account + publish + live URL; **Participant credits — The first 1,000 eligible builders to complete this form receive 3,000 Netlify credits each** at `https://forms.gle/xw75XGUQzCXEiALc7`; Starter `https://webmcp-starter.netlify.app/` | **"Available to new and existing Netlify users"**; form deadline Sep 1 12pm PT per Resources FAQ |
| **OpenAI (showcase/guide)** | Showcase `https://developers.openai.com/showcase?view=webmcp-apps`; Guide `http://learn.chatgpt.com/docs/webmcp` | Inspo only |

*Optional:* install the **Devpost Hackathons plugin** inside **Codex** (`https://chatgpt.com/plugins/plugin_asdk_app_6a330a7730c081919892632d5baaec58`) — quoted *"It can help you brainstorm ideas, plan your project, and prepare your submission without leaving Codex"* and *"Helper, not source of truth ... AI output may be inaccurate ... Entrant remains responsible"* — not required to enter or win.

**Full curated guide:** `https://webmcp.devpost.com/resources` — Documentation + Resources from hackathon supporters sections as summarized in §2; see §2 for prize/schedule/team/submission/judging tables (not duplicated here per spec).

### 4. Official resources — full verified link list (as published on `/resources`)

**Starter guidance (verbatim):**

> **"Start with the documentation and supporter resources below, then test your deployed app in ChatGPT's in-app browser or Google Chrome with WebMCP enabled via chrome://flags/#enable-webmcp-testing. Use starter templates and example apps for inspiration."**

**Documentation:**

- `webmachinelearning/webmcp` on GitHub — Specification source, explainers, open issues — `https://github.com/webmachinelearning/webmcp`
- WebMCP developer documentation — official from Google — `https://developer.chrome.com/docs/ai/webmcp`
- WebMCP origin trial — instructions for enabling in Chrome — `https://developer.chrome.com/blog/ai-webmcp-origin-trial`
- WebMCP tool security guide — prompt-injection & trust boundaries — `https://developer.chrome.com/docs/ai/webmcp/secure-tools`

**Resources from hackathon supporters (each block quoted/verified 2026-09-01):**

- *OpenAI:* WebMCP Showcase `https://developers.openai.com/showcase?view=webmcp-apps`; ChatGPT Sites `https://learn.chatgpt.com/docs/sites?surface=app`
- *Cloudflare:* overview `https://blog.cloudflare.com/webmcp/`; Browser Run WebMCP `https://developers.cloudflare.com/browser-run/features/webmcp/`; coffee-store demo `https://webmcp-coffee.jilles.fyi/`; challenge landing `https://webmcp-challenge.examples.workers.dev/`; Workers template `https://github.com/cloudflare/agents/tree/main/examples/webmcp-react`; Pages/Workers `https://developers.cloudflare.com/pages/`
- *Vercel:* storefront source `https://github.com/vercel/shop`; WebMCP PR `https://github.com/vercel/shop/pull/498`; live demo `https://template.vercel.shop/`; pricing `https://vercel.com/pricing`; $30 credits `https://credits.vercel.sh/redeem` code `OAIWEBMH-9E2F-MUT4`
- *Shopify:* WebMCP tools `https://shopify.dev/docs/api/web-mcp`; Agentic tools `https://shopify.dev/docs/agents`
- *Google Chrome:* `useWebMCPTool` hook `https://www.npmjs.com/package/use-webmcp-tool`; Explainer `https://github.com/webmachinelearning/webmcp/blob/main/README.md`; Angular `https://angular.dev/ai/webmcp`; evals `https://developer.chrome.com/docs/ai/webmcp/evals`; developer docs `https://developer.chrome.com/docs/ai/webmcp`; debug `https://developer.chrome.com/docs/devtools/application/webmcp`; Modern Web Guidance `https://github.com/GoogleChrome/modern-web-guidance`; demos `https://github.com/GoogleChromeLabs/webmcp-tools/tree/main/demos`
- *Render:* Workflows `https://render.com/workflows`; docs `https://render.com/docs/workflows`; templates `https://render.com/templates`; participant credits `https://credits-portal-mmdm.onrender.com/claim/openai-hackathon` ($50/500/yr); credits docs `https://render.com/docs/credits`
- *Netlify:* `https://netlify.com/`; Choose your path `https://docs.netlify.com/start/choose-your-path/`; WebMCP starter `https://webmcp-starter.netlify.app/`; participant form `https://forms.gle/xw75XGUQzCXEiALc7` (3,000 credits/1,000 builders)

**Support:**

- OpenAI Discord `https://discord.gg/openai`
- Participants tab `https://webmcp.devpost.com/participants`
- Discussion Board `https://webmcp.devpost.com/forum_topics`
- Hackathon manager email `shawni@devpost.com`
- Devpost Plugin `https://chatgpt.com/plugins/plugin_asdk_app_6a330a7730c081919892632d5baaec58`

### 5. Rules highlights — verbatim excerpts (see §2 for prize/schedule/team/submission/judging tables)

- **Dates and Timing (Rules §1):** *"Registration Period: August 25th, 2026 (11:00 am Pacific Time) – September 3rd, 2026 (1:00 pm Pacific Time) ('Registration Period'). Submission Period: August 25th, 2026 (11:00 am Pacific Time) – September 3rd, 2026 (1:00 pm Pacific Time) ('Submission Period'). Judging Period: September 4th, 2026 (10:00 am Pacific Time) – September 21st, 2026 (5:00 pm Pacific Time) ('Judging Period'). Winners Announced: On or around September 23rd, 2026 (2:00 pm Pacific Time)."*

- **Sponsor and Administrator (Rules §2):** *"Sponsor: OpenAI OpCo, LLC, 1455 3rd Street, San Francisco, CA 94158 Administrator: Devpost, Inc. ('Devpost'), 250 Broadway, Floor 24, New York, NY 10007"*

- **Eligibility — open to (Rules §3):** *"Individuals who are at least the age of majority where they reside ... Individuals who are residents of countries and territories that currently support access to OpenAI's API services ... Teams of Eligible Individuals ('Teams'); and Organizations based in countries and territories that currently support access to OpenAI's API services ... An Eligible Individual may join more than one Team or Organization and an Eligible Individual who is part of a Team or Organization may also enter the Hackathon on an individual basis. If a Team or Organization is entering the Hackathon, they must appoint and authorize one individual (the 'Representative') to represent, act, and enter a Submission, on their behalf."*

- **Eligibility — NOT open to (Rules §3):** *"Individuals or organizations who are not residents of, or Organizations domiciled in, a country, state, province or territory listed here: https://platform.openai.com/docs/supported-countries ... Individuals who are residents of, or Organizations domiciled in, a country, state, province or territory where the laws of the United States or local law prohibits participating or receiving a prize in the Hackathon (including, but not limited to, Brazil, China, Hong Kong, province of Quebec, Russia, Crimea, Cuba, Iran, North Korea, Syria Venezuela, regions of Donetsk and Luhansk, and any other country designated by the United States Treasury's Office of Foreign Assets Control) ... Organizations involved with the design, production, paid promotion, execution, or distribution of the Hackathon, including the Sponsor and Administrator ('Promotion Entities'). Employees, representatives and agents of such Promotion Entities ... Any Judge, or company/individual that employs a Judge ... Any other individual or organization whose participation would create ... a real or apparent conflict of interest"*

- **How To Enter — steps (Rules §4):** *"Register for the Hackathon on the Hackathon Website by clicking the 'Join Hackathon' button... Entrants will obtain access to the required developer tools/platform and complete a Project described below ... Get access to WebMCP. Download the ChatGPT desktop app and use its in-app browser, which supports WebMCP by default. Alternatively, download Google Chrome 149 or later, enable chrome://flags/#enable-webmcp-testing, and restart the browser. Make sure judges can access your working live project. Judges may test WebMCP tools using ChatGPT's in-app browser or Google Chrome with WebMCP enabled. Optionally, install the Devpost Plugin ... Optionally, Entrants may request 3,000 in free Netlify credits ... Free Netlify credits can only be requested by Entrants registered for the Hackathon. To request credits, complete the form at: https://forms.gle/xw75XGUQzCXEiALc7 by September 1st at 12pm PT. Netlify credits are not redeemable for cash and must be redeemed by October 3rd, 2026."*

- **Submission Requirements — what to submit (Rules §4):** *"Include a Project built with the required developer tools and meets the above Project Requirements. Provide a working live URL that judges can access using ChatGPT's in-app browser or Google Chrome with WebMCP enabled. You may host your application on ChatGPT Sites, Cloudflare, Vercel, Render, Netlify, or any other provider of your choice. You may also authenticate your application if you wish. If so, you can add the credentials on the Submission Form. Include a text description that explains Why your use case is a strong fit for WebMCP How it creates a better user experience Describe what people and agents can do together that was difficult or impossible before Briefly explain how you implemented WebMCP Provide a URL to your public code repository (on GitHub, GitLab and Bitbucket) that must contain: All necessary source code, assets, and instructions required for the project to be functional Must be open source by including an open source license file. This license should be detectable and visible at the top of the repository page (in the About section) ... Those repositories should have the following: document.modelContext.registerTool({ name: \"search_products\", description: \"Search the product catalog\", inputSchema: { /* ... */ } execute: async (input) => { /* ... */ } }); Include a demonstration video ... must be less than three (3) minutes ... must include a clear demo of your project functioning and with audio that covers what you built and how you used WebMCP must be uploaded to and made publicly visible on YouTube, and a link to the video must be provided ... and must not include third party trademarks, or copyrighted music or other material unless the Entrant has permission to use such material."*

- **Multiple Submissions (Rules §4):** *"An Entrant may submit more than one Submission, however, each Submission must be unique and substantially different from each of the Entrant's other Submissions, as determined by the Sponsor and Devpost in their sole discretion."*

- **Testing (Rules §4):** *"Access must be provided to an Entrant's working Project for judging and testing by providing a link to a website, functioning demo, or a test build. If Entrant's website is private, Entrant must include login credentials in its testing instructions. The Entrant must make the Project available free of charge and without any restriction, for testing, evaluation and use by the Sponsor, Administrator and Judges until the Judging Period ends. Judges are not required to test the Project and may choose to judge based solely on the text description, images, and video provided in the Submission."*

- **Submission Modifications (Rules §6):** *"Prior to the end of the Submission Period, you may save draft versions of your submission on Devpost to your portfolio before submitting the Submission materials to the Hackathon for evaluation. Once the Submission Period has ended, you may not make any changes or alterations to your Submission, but you may continue to update the Project in your Devpost portfolio."* + *"The Sponsor and Devpost may permit you to modify part of your Submission after the Submission Period for the purpose of adding, removing or replacing material that potentially infringes a third party mark or right, discloses personally identifiable information, or is otherwise inappropriate."*

- **Judging — methodology (Rules §7):** *"Sponsor and Administrator reserve the sole right to determine the eligibility and judging methodologies for all submissions. This process may utilize expert panels, peer review, automated AI-driven analysis, or any combination thereof to ensure efficient, fair, and objective evaluation."*

- **Tie Breaking (Rules §7):** *"if two or more Submissions are tied, the tied Submission with the highest score in the first applicable criterion listed above will be considered the higher scoring Submission. In the event any ties remain, this process will be repeated, as needed, by comparing the tied Submissions' scores on the next applicable criterion. If two or more Submissions are tied on all applicable criteria, the panel of Judges will vote on the tied Submissions."*

- **Intellectual Property (Rules §8):** *"All Submissions remain the intellectual property of the individuals or organizations that developed them. By submitting an entry, entrants agree that the Sponsor will have a non-exclusive license to use such entry for judging the entry. Entrants agree that the sponsor and Devpost shall have the right to promote the Submission and use the name, likeness, voice and image of all individuals contributing to a Submission, in any materials promoting or publicizing the Hackathon and its results, during the Hackathon Period and for three years thereafter."* + *"submitted content is not copyrighted, protected by trade secret or otherwise subject to third party intellectual property rights ... unless entrant is the owner of such rights or has permission"*

- **Prizes — verbatim (Rules §9):** *"Top 10 submissions receive the following prizes ... OpenAI • $3,000 USD in cash • Spotlight on @OpenAIDevs on Twitter • Codex Micro • Swag (for up to 3 team members) • Pro Account for 1 year for up to 3 team members — Cloudflare • $10,000 in Cloudflare credits — Vercel • $300 per month in Vercel credits and $50 per month in Gateway credits for twelve months ($3,600 + $600 per winner). — Render • $300 in Render credits — Netlify • $500 in cash from Netlify — Shopify • $250 in limited-edition Shopify Supply gear per winning submission. — Google Chrome • 3-month subscription to Google AI Ultra per winning team member (~$300 value/team member)."*

- **Prize general terms (Rules §9):** *"Each Project is eligible for one Prize. Substitutions & Changes: Prizes are non-transferable ... Verification Requirement: THE AWARD OF A PRIZE TO A POTENTIAL WINNER IS SUBJECT TO VERIFICATION ... Prize Delivery: Prizes will be payable to the Entrant, if an individual; to the Entrant's Representative, if a Team; or to the Organization ... within 60 days ... Fees & Taxes: Winners are responsible for any fees ... and for reporting and paying all applicable taxes ... Prize provider reserves the right to withhold a portion of the prize amount to comply with tax laws."*

- **Using AI to build (Resources → FAQs → Using AI):** *"AI assistants are welcome — judges care about the final project and the real problem it solves, not how the code was typed. 🟢 Do use AI to: scaffold, debug, and iterate faster; draft and tighten your README and project description; brainstorm edge cases 🔺 Don't use AI to: name your project (pick something specific); describe your project in vague, generic terms; fake or overstate what's actually running"*

- **Do I need a private repo option? (FAQ):** *"No — unlike some hackathons, this one requires a public repository with a visible open-source license. There's no private-repo-plus-shared-access path here."*

- **FAQs — General/Setup/Submissions** — all FAQs on `/resources` are part of the binding guidance (can I participate solo/team/org — Yes; team size — No cap; existing projects — eligible only if meaningfully extended after Aug 25 with dated evidence; judges may but not required to test; hosting — must be public URL testable in ChatGPT in-app browser or Chrome 149+ with flag; video — required <3 min with audio; no edits after deadline — *"don't touch anything: not your Devpost submission, not your repo, not your live site, until winners are announced"*; forking guidance; language English).

**Disclosure duties (pre-built code + AI assistance) — what to disclose:**

> The Rules do not define a separate "disclosure statement" field. The cross-event lablab disclosure pattern does not apply here — this is a Devpost event. However the **open-source + original-work + new/existing documentation** requirements effectively serve as the disclosure: pre-existing repos must *"provide clear documentation distinguishing prior work from new work, including evidence that it was meaningfully extended with WebMCP within the Submission Period (e.g., timestamped, dated commit history, or equivalent)."* The chassis IS pre-built scaffolding; its reuse is disclosed via the repo's license + commit history + README documentation, and will be generated as `disclosure.md` by `PROVO` from `assembly.manifest.json` for the submission's "testing instructions" hygiene.

**What was NOT verified / could not be scraped from the event site (listed explicitly):**

* Devpost's canonical Schedule helper API (`/challenge/31011/dates.json`) was not reachable via unauthenticated fetch — schedule above is transcribed from on-page HTML and Rules §1 instead (quoted both). No impact on binding dates.
* Discord posts / kickoff stream announcements: no public Discord invite besides OpenAI Discord (`https://discord.gg/openai`) is linked from the event; no kickoff-only builder-access details beyond the credit forms above were published as of 2026-09-01. Treat any new stream/Discord announcements as updates to re-check.
* Video hosting alternative (Vimeo) mentioned in Rules boilerplate for some Devpost events was **not** listed on this event's Overview — only **YouTube** is named for this event.

