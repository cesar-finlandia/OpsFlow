# OpsFlow — Visual Identity & Design System

**Codename:** *Signal & Slate*
**Owner:** Design (this document is the source of truth for `src/ui/**` presentation)
**Scope:** every browser-visible surface of OpsFlow — the three screens (Batch / Shipping / Holds), the Tool Inspector, the Co-Execution Timeline, the confirmation gate, the savings meter, and the banners.
**Non-scope:** business rules (`src/engine/domain/*`), tool registration (`src/webmcp/*`), API routes (`api/**`), chassis internals (`src/platform/**` — never edited, `NFR-05`). This plan changes **tokens, markup classes and motion only**; no tool contract, no `EventEnvelope` shape, no test-visible string or DOM ordering is altered.

---

## 1. Who this is for

### 1.1 The primary user — "Maya"

From `design_documents/real-life-usecase-opsflow.md`: **Maya Torres, 29, freelance Operations Coordinator.** Twenty to forty orders a day across two Shopify stores. Not an engineer. Her current toolchain is six browser tabs and a Google Sheet. Her fear is not "the AI is not smart enough" — it is **"something committed while I wasn't looking, and I'm the only person who would notice."**

What that means for design, concretely:

| Maya's reality | Design consequence |
|---|---|
| Works fast, in the morning, under time pressure, often in a bright room | Light mode is a **first-class** theme, not an afterthought. Warm-neutral paper ground, not clinical white; no glare. |
| Also works late, closing out batches | Dark mode is a true dark-first palette, not an inverted light theme. |
| Is not an engineer, but reads SKUs, cents, weights and TTLs all day | Data typography (tabular numerals, mono for identifiers) is the backbone. Chrome is quiet; **numbers are loud**. |
| Needs to know *who* is acting — her, the agent, or a cached fallback | **Colour encodes agency.** This is the single strongest idea in the system (§3.1). |
| Must be able to stop something | The confirmation gate is the most visually emphatic moment in the app. Amber. Full stop. |
| One typo cost her a cancelled order | Nothing decorative may sit near a number. Ornament lives at the edges of the layout, never inside a data cell. |

### 1.2 The secondary audience — the evaluator

Hackathon judges open the live URL for under three minutes and score on **WebMCP Leverage, Execution, Potential Impact, Creativity & Ambition**. They are technical. They will open the Tool Inspector.

The identity must therefore do two jobs at once without splitting in half: read as **shippable ops software** to Maya, and as **instrument-grade engineering** to a judge. The resolution is *precision-instrument design* — the visual language of an oscilloscope, an aviation MFD, a trading terminal — rendered with 2026 web craft and real light-mode warmth rather than 1990s density.

### 1.3 What we are deliberately **not**

- **Not the default "AI product" look.** No purple-to-pink gradient, no glassmorphic blur stack, no neon-on-black hacker theme. The current `operator` chassis theme (electric lime `#a3e635` on `#09090b`) reads as a *developer tool*. Maya is not a developer, and lime-on-black at 9 a.m. is fatiguing. We keep the chassis theme's **density and discipline** and replace its palette and type.
- **Not a dashboard.** OpsFlow is a *console* — a place where a sequence of steps happens and a human intervenes. Layout is a vertical narrative (goal → steps → results → gate → commit), never a grid of unrelated KPI cards.
- **Not playful.** No 3-D card tilt, no confetti, no mascot. Money and inventory move here.

### 1.4 Design principles (in priority order — used to settle every trade-off below)

1. **Legibility outranks personality.** If an aesthetic choice costs a millisecond of number-reading, it loses.
2. **Colour means agency, not decoration.** See §3.1.
3. **Motion is a status report.** Every animation answers "what is happening, and is it done?" Nothing loops for its own sake.
4. **The gate is sacred.** Confirmation UI never shares its visual weight with anything else on screen.
5. **Honesty is visible.** Synthetic data, degraded replays and fallback planners get their own persistent visual channel. A cached result never looks live.
6. **Cold load is a feature.** `NFR-10` gives us < 1.5 s to five registered tools. The identity ships as CSS and inline SVG — no runtime animation library on the critical path (§8).

---

## 2. Brand foundation

### 2.1 Positioning line

> **OpsFlow — the console where the agent works and you decide.**

### 2.2 Logotype and the Signal mark

`OpsFlow` set in the display font at 640 weight, `-0.02em` tracking, sentence case. To its left, the **Signal mark**: a five-node polyline — one node per tool in the frozen chain — with the fourth node (`hold_order`) drawn as an *open ring* rather than a filled dot, because that is where a human hand enters.

```
  ●───●───●───◍───●
search filter quote HOLD confirm
                ↑ human gate = open ring, amber
```

The mark is not decoration; it is a legend for the entire product. A judge who understands the mark understands the trust model. It renders at 18 px in the header (drawing itself once on load) and is reused at 40 px as the empty-state glyph.

### 2.3 Voice in UI copy

Terse, operator register, no exclamation marks, no anthropomorphising ("the agent is thinking…" is banned; "step 2 of 5 · filter_variants" is correct). Every existing product string in `src/ui/**` is preserved verbatim — this plan adds *labels and structure* around them, never rewrites them.

---

## 3. Colour system

### 3.1 The core idea — colour encodes agency

Six semantic channels. A user learns them in ten seconds and then reads the whole console at a glance:

| Channel | Meaning — "who is acting" | Hue | Where it appears |
|---|---|---|---|
| **Signal** (teal-cyan) | The **agent** is acting or has acted | ~190° | Running steps, primary action, active tab, timeline connector, tool-name accents |
| **Gate** (amber) | **You** must act — nothing has committed | ~38° | Confirm dialog, `hold_order` / `confirm_fulfillment` badges, TTL rings, `held` status |
| **Commit** (green) | Committed, real, done | ~152° | `done` badges, confirmed-fulfilment banner, savings delta |
| **Fault** (red) | Failed, expired, rejected | ~8° | Error alerts, expired holds, validation failures |
| **Replay** (iris/violet) | Data is **cached, local or synthetic** — true, but not live | ~258° | Degraded banner and chips, synthetic-data badge, deterministic-planner label |
| **Slate** (neutral) | Chrome, structure, ground | ~210° | Everything else |

**Why iris for degraded** rather than amber: amber already carries "a human must act". A replayed result needs no action — it needs a *caveat*. Giving degradation its own hue is what lets the timeline show a degraded-but-successful step without it reading as an error or a pending gate. This detail is what makes the resiliency story (`FR-18`) legible instead of alarming.

### 3.2 Light mode — "Paper"

Ground is a warm-neutral paper (`#F2F5F7`), not `#FFFFFF`. Cards are pure white and therefore *rise* off the ground without heavy shadows. Text tops out at `#0E1720` rather than black — full black on paper vibrates at 13 px.

```css
/* Neutrals — Slate */
--of-canvas:        #F2F5F7;   /* app ground */
--of-canvas-2:      #E8EDF1;   /* inset wells, table header */
--of-surface:       #FFFFFF;   /* cards, panels, dialog */
--of-surface-2:     #F7F9FB;   /* nested surface, code blocks */
--of-surface-3:     #ECF1F5;   /* hover fill */
--of-border:        #DCE3E9;   /* hairlines */
--of-border-strong: #B9C6D1;   /* input borders, dividers that must read */
--of-text:          #0E1720;   /* primary */
--of-text-2:        #4A5C6C;   /* secondary / labels */
--of-text-3:        #64768A;   /* meta, placeholders, timestamps */

/* Signal — agent */
--of-signal:        #0B7285;
--of-signal-hover:  #095E6E;
--of-signal-strong: #064F5D;
--of-signal-soft:   #DCEEF2;
--of-signal-on:     #FFFFFF;

/* Gate — human decision */
--of-gate:          #9A5800;
--of-gate-hover:    #834A00;
--of-gate-soft:     #FDF0DC;
--of-gate-on:       #2A1900;

/* Commit */
--of-commit:        #0F7A45;
--of-commit-soft:   #DDF2E6;

/* Fault */
--of-fault:         #B0231A;
--of-fault-soft:    #FCE5E2;

/* Replay — cached / synthetic */
--of-replay:        #5847C4;
--of-replay-soft:   #E9E7FB;

/* Focus */
--of-focus:         #0B7285;
--of-focus-halo:    rgba(11, 114, 133, 0.28);
```

Contrast: every `*-soft` pairing with its base hue clears **WCAG AA 4.5:1** for body text; `--of-text-3` on `--of-canvas` measures ≈ 5.0:1 and is used only at ≥ 12 px.

### 3.3 Dark mode — "Ink"

A dark *navy*-slate, not neutral black. `#0A0F14` has a faint blue cast that makes the teal read as light rather than as glow, and stops the whole UI looking like a terminal. Surfaces step *up* in lightness; there are no drop shadows in dark mode — depth comes from border plus a 1 px inset top highlight.

```css
/* Neutrals — Ink */
--of-canvas:        #0A0F14;
--of-canvas-2:      #0E151C;
--of-surface:       #121B23;
--of-surface-2:     #18232D;
--of-surface-3:     #1F2C38;
--of-border:        #24333F;
--of-border-strong: #3A4C5A;
--of-text:          #E7EEF4;
--of-text-2:        #9DB0BF;
--of-text-3:        #788C9E;

/* Signal */
--of-signal:        #35C4D6;
--of-signal-hover:  #5AD5E4;
--of-signal-strong: #7FE2ED;
--of-signal-soft:   #0B2D34;
--of-signal-on:     #04191D;

/* Gate */
--of-gate:          #F0A22E;
--of-gate-hover:    #F8B857;
--of-gate-soft:     #33230A;
--of-gate-on:       #241703;

/* Commit */
--of-commit:        #45D18A;
--of-commit-soft:   #0C2A1D;

/* Fault */
--of-fault:         #FF7F70;
--of-fault-soft:    #351210;

/* Replay */
--of-replay:        #A99BFF;
--of-replay-soft:   #1D1A38;

/* Focus */
--of-focus:         #35C4D6;
--of-focus-halo:    rgba(53, 196, 214, 0.30);
```

### 3.4 Alias tokens (theme-invariant — components reference only these)

Components never reference a raw hue. They reference roles, so a palette swap is a one-file change:

```
--of-app-bg, --of-panel-bg, --of-panel-border, --of-input-bg,
--of-accent, --of-accent-fg, --of-accent-soft,
--of-status-running, --of-status-done, --of-status-error,
--of-status-gate, --of-status-degraded,
--of-shadow-1, --of-shadow-2, --of-shadow-3,
--of-grid-line, --of-aurora-1, --of-aurora-2, --of-scrim
```

### 3.5 Bridge to the chassis token contract

The chassis (`src/platform/ui/tokens.css`, `themes/operator.css`) exposes `--ui-*`. We do not edit chassis files (`NFR-05`). Instead `src/ui/styles/tokens.css` is imported **after** `operator.css` and re-points the chassis tokens at ours at equal specificity, so chassis components (`StepStatusIndicator`, `CitationDisplay`) inherit the new identity for free:

```css
:root[data-theme="operator"] {
  --ui-color-bg: var(--of-canvas);
  --ui-color-fg: var(--of-text);
  --ui-color-accent: var(--of-signal);
  --ui-color-accent-soft: var(--of-signal-soft);
  --ui-color-degraded-bg: var(--of-replay-soft);
  --ui-radius: var(--of-radius-sm);
  --ui-font-family: var(--of-font-sans);
  --ui-spacing-unit: 4px;
  --ui-layout-max: 1240px;
}
```

`setTheme("operator")` in `src/main.tsx` stays exactly as it is. The chassis mechanism is preserved and *composed*, per DP-UI §3.5.

---

## 4. Dual-theme mechanics

### 4.1 Attribute model

Two independent attributes on `<html>`:

- `data-theme="operator"` — chassis identity slot, set by `setTheme()` at boot. **Unchanged.**
- `data-mode="light" | "dark"` — OpsFlow's colour mode, owned by `src/ui/theme/mode.ts`.

Resolution order: explicit choice in `localStorage["opsflow.theme.v1"]` → `prefers-color-scheme` → **dark** (the console default, and what the demo video records).

### 4.2 No flash of wrong theme

A short synchronous inline script in `index.html`, before any stylesheet, reads storage and stamps `data-mode` plus `<meta name="color-scheme">`. It runs before first paint and costs no network round-trip. `color-scheme` is also set on `:root` so native scrollbars, form controls and the browser's own canvas match the theme.

### 4.3 The toggle (required cue #2)

**Placement:** global header, immediately right of the Tool-Inspector button, visible on every screen — the header is the only chrome that persists across the three tabs.

**Behaviour:**
- One button, `aria-pressed` reflecting dark, `aria-label` = "Switch to light theme" / "Switch to dark theme", plus `title`. Keyboard reachable in header order; `Enter` / `Space`.
- **Icon:** a single inline SVG, not two swapped images. A circle whose interior is masked by a second offset circle — sliding the mask morphs the sun into a crescent moon — while eight rays scale and rotate out. The whole morph is a ~420 ms transform/opacity animation, GPU-cheap, zero layout.
- **Transition:** where `document.startViewTransition` exists, the swap plays as a **circular `clip-path` wipe originating at the toggle** (0 → far corner, ~480 ms). Otherwise tokens cross-fade via a 200 ms `background-color`/`color` transition on `:root`, enabled by a temporary `.of-mode-anim` class removed on `transitionend` so it never taxes normal interaction.
- **Reduced motion:** both the wipe and the icon morph collapse to an instant swap.

**Why a button and not a three-state segmented control:** Maya switches on ambient light, not on preference archaeology. Two states, one click, "system" honoured until she first expresses an opinion.

---

## 5. Typography

### 5.1 Families

| Role | Family | Fallback stack | Why |
|---|---|---|---|
| **UI / display** | **Geist Sans Variable** | `"Geist Sans Variable", "Inter var", Inter, "Segoe UI Variable Text", -apple-system, "Segoe UI", Roboto, sans-serif` | Variable 100–900. Engineered for dense product UI: large x-height, unambiguous `1/l/I` and `0/O`, tight default tracking that holds at 12–13 px. Neutral enough to read as infrastructure, distinctive enough not to read as a framework default. Deploy target is Vercel, so it is a first-party, self-hostable, OFL-clean choice. |
| **Data / identifiers** | **Geist Mono Variable** | `"Geist Mono Variable", "JetBrains Mono", ui-monospace, "SF Mono", "Cascadia Mono", Menlo, monospace` | SKUs, hold IDs, JSON payloads, schema blocks, elapsed-ms readouts. Same skeleton as the sans, so the two never fight inside a table row. |

**Alternatives considered:** *Inter* (safe, ubiquitous, marginally more generic — kept as the first fallback so a clean clone with no font assets still looks intentional); *IBM Plex Sans/Mono* (warmer industrial pedigree, excellent, but ~6 % wider in dense tables); *Söhne / Suisse* (licensed — disqualified for an open-source submission).

**Loading rules (`NFR-10`, `NFR-11`):** fonts are self-hosted `woff2` under `assets/fonts/`, `font-display: swap`, subset to `latin`, preloading only the axes used. **A clean clone with no font files must still render correctly** — hence the fallback stacks above resolve to a *real variable* system font on every major OS (`Segoe UI Variable` on Windows, `SF Pro` via `-apple-system` on macOS/iOS, `Roboto Flex` on Android). No Google Fonts request is on the critical path.

### 5.2 Scale

Base **14 px** (console density, inherited from the operator theme), 1.25 modular ratio with hand-tuned micro steps at the bottom where the ratio is too coarse.

| Token | px | rem | Line-height | Weight | Tracking | Used for |
|---|---|---|---|---|---|---|
| `--of-text-micro` | 10 | 0.625 | 1.4 | 600 | `+0.10em` | Chip text, ring captions |
| `--of-text-label` | 11 | 0.6875 | 1.45 | 600 | `+0.08em` uppercase | Column headers, panel titles, form labels, badges |
| `--of-text-meta` | 12 | 0.75 | 1.5 | 450 | `+0.005em` | Timestamps, hints, secondary meta, elapsed ms |
| `--of-text-body-sm` | 13 | 0.8125 | 1.55 | 450 | 0 | Table cells, JSON blocks, banner body |
| `--of-text-body` | 14 | 0.875 | 1.55 | 450 | 0 | Default UI text, inputs, buttons |
| `--of-text-lead` | 16 | 1.0 | 1.5 | 500 | `-0.005em` | Goal input, dialog body |
| `--of-text-h3` | 18 | 1.125 | 1.35 | 600 | `-0.01em` | Card titles, dialog title |
| `--of-text-h2` | 22 | 1.375 | 1.3 | 600 | `-0.015em` | Screen headings |
| `--of-text-h1` | 26 | 1.625 | 1.2 | 640 | `-0.02em` | Logotype |
| `--of-text-metric` | 34 | 2.125 | 1.05 | 600 | `-0.025em` | Quote total |
| `--of-text-metric-lg` | 44 | 2.75 | 1.0 | 650 | `-0.03em` | Savings-meter delta |

### 5.3 Data typography rules (non-negotiable)

1. `font-variant-numeric: tabular-nums` on **every** element that can contain a number — table cells, meters, timers, prices, elapsed ms. Digits must not jitter as a countdown ticks.
2. `font-feature-settings: "ss01", "cv05"` (slashed zero, disambiguated `l`) wherever an identifier is shown.
3. Prices and weights right-aligned; identifiers and text left-aligned. Alignment is set once per column, never per cell.
4. Mono is reserved for machine-authored strings: SKUs, hold IDs, fulfilment IDs, tool names, JSON. Human prose is never mono.
5. Uppercase + tracking is reserved for the `label` step. Never uppercase a value.
6. Minimum type size anywhere: **10 px**, and only for chips.

---

## 6. Space, shape, elevation

### 6.1 Spacing scale — 4 px base

| Token | px | Use |
|---|---|---|
| `--of-space-1` | 4 | Icon-to-text, chip padding-y |
| `--of-space-2` | 8 | Control padding-y, tight stacks |
| `--of-space-3` | 12 | Control padding-x, table cell padding |
| `--of-space-4` | 16 | Card padding, standard stack gap |
| `--of-space-5` | 20 | Panel padding |
| `--of-space-6` | 24 | Section gap |
| `--of-space-8` | 32 | Screen-level gap |
| `--of-space-10` | 40 | Header offset |
| `--of-space-12` | 48 | Empty-state padding |
| `--of-space-16` | 64 | Page top/bottom |

Every margin, padding and gap in the app is one of these. No arbitrary pixel values.

### 6.2 Radii

| Token | px | Use |
|---|---|---|
| `--of-radius-xs` | 3 | Chips, badges, inline code |
| `--of-radius-sm` | 5 | Inputs, buttons |
| `--of-radius-md` | 8 | Cards, panels, banners |
| `--of-radius-lg` | 12 | Dialog, hero panels |
| `--of-radius-full` | 999 | Pills, status dots, TTL ring |

The chassis operator theme uses `radius: 1px` (hard rectangles). We move to 5/8 px: still crisp and instrument-like, but no longer reading as a 2013 terminal. The *density* of the operator theme is what we keep; the sharpness is what we soften, by exactly one notch.

### 6.3 Elevation

Light mode uses two-layer shadows tinted with the slate hue — never pure black, which looks dirty on warm paper:

```css
--of-shadow-1: 0 1px 2px rgba(14,23,32,.06), 0 1px 1px rgba(14,23,32,.04);
--of-shadow-2: 0 4px 12px rgba(14,23,32,.08), 0 1px 3px rgba(14,23,32,.06);
--of-shadow-3: 0 18px 48px rgba(14,23,32,.18), 0 2px 8px rgba(14,23,32,.10);  /* dialog */
```

Dark mode replaces shadow with **border + a 1 px inset top highlight** (`inset 0 1px 0 rgba(255,255,255,.04)`), because shadows are invisible on `#0A0F14`. The dialog is the one exception: it keeps a deep shadow to separate it from the blurred backdrop.

### 6.4 Layout

- Max width **1240 px**, centred, `--of-space-6` gutters, `--of-space-8` top / `--of-space-16` bottom.
- Vertical narrative order is **frozen** (DP-UI §3.1): banners → header → tabs → screen → timeline → savings meter → inspector → dialog.
- Desktop ≥ 1120 px: the active screen and the Co-Execution Timeline sit side by side (`minmax(0,1fr) 380px`), so a judge sees the agent's steps *next to* the result they produced — the single most important adjacency in the product.
- Below 1120 px: the timeline stacks under the screen (current behaviour, unchanged).
- Below 720 px: tabs scroll horizontally; tables scroll inside their own container so the page never scrolls sideways.

---

## 7. Motion & the working widgets

### 7.1 Motion tokens

| Token | Value | Use |
|---|---|---|
| `--of-dur-1` | 120 ms | Hover, colour change |
| `--of-dur-2` | 200 ms | Chip/badge appear, tab switch |
| `--of-dur-3` | 320 ms | Card enter, timeline row enter |
| `--of-dur-4` | 480 ms | Dialog, theme wipe |
| `--of-ease-out` | `cubic-bezier(.22,1,.36,1)` | Things arriving |
| `--of-ease-in-out` | `cubic-bezier(.65,0,.35,1)` | Things moving between states |
| `--of-ease-spring` | `cubic-bezier(.34,1.56,.64,1)` | Confirmation and commit — the one place overshoot is allowed |

**Global rule:**

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: .001ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: .001ms !important;
  }
}
```

with hand-written static fallbacks for the two widgets that carry information through motion (§7.2, §7.6) — under reduced motion they display a textual/step-count state instead of an animated one. **Information is never carried by motion alone.**

### 7.2 The Agent Activity widget (required cue #3) — the centrepiece

Clicking **Run batch** starts a chain of network and tool calls with no immediate result. This is the moment the "is this trustworthy?" question is decided, so it gets a purpose-built widget rather than a spinner.

`<AgentActivity>` replaces the bare `Agent running… step N of M` line and renders:

1. **A five-node route rail** (inline SVG, full width, ~28 px tall) — one node per tool in the frozen chain. Nodes are 6 px dots; the connector is a 2 px path. Completed segments are stroked in **Signal**; the segment in flight carries a **travelling 12 px dash** at ~1.1 s per cycle — a literal packet moving down the wire. Gate nodes (`hold_order`, `confirm_fulfillment`) are open rings in **Gate** amber; when the plan reaches one, the ring pulses (scale 1 → 1.18, opacity 1 → .35, 1.4 s) until the human clicks.
2. **A status line** — `Step 2 of 5 · filter_variants` in mono, plus the plan's own `rationale` string in sans. Real data off the `agent.plan` envelope, not a canned phrase.
3. **An elapsed counter** in tabular mono, ticking at 100 ms, so the widget proves it is live even on a slow step.
4. **A three-dot in-flight pulse** with staggered `animation-delay` (0 / 160 / 320 ms) beside the current tool name.

Accessibility: the widget is `aria-live="polite"`, its status line is the accessible text, the SVG is `aria-hidden`. Under reduced motion the dash stops and the current node simply fills.

**Why this beats a spinner:** a spinner says "wait". This says *what* is running, *which* of how many steps, *why*, *how long so far*, and *where the human gate is coming*. It is a one-glance answer to the exact anxiety in §1.1.

### 7.3 Skeleton loading

The Batch table's placeholder rows keep their existing three-row structure and gain a **shimmer**: a 1200 ms linear-gradient sweep at 110° across `--of-surface-3`, staggered 90 ms per row. Cells render as rounded bars sized to the column's expected content width (the SKU bar is mono-width; the price bar is short and right-aligned), so the skeleton previews the layout instead of just blinking.

### 7.4 Timeline motion (`FR-14`)

- Each new envelope row enters with `translateY(6px) → 0` plus opacity over `--of-dur-3`, and the vertical rail draws downward (`scaleY` from a top origin) as it appears — the timeline visibly grows.
- Status dot: `running` = Signal dot with an expanding halo (1.6 s, infinite); `done` = Commit dot with a check drawn via `stroke-dashoffset` in 260 ms; `error` = Fault dot with a three-cycle 8 px shake; `degraded` = Replay dot with a slow 2.4 s breathe.
- Payload `<pre>` blocks are clamped by default and expand on click with a height transition — dense by default, inspectable on demand.

### 7.5 The confirmation gate (`FR-05` / `FR-06`) — the emotional peak

- Backdrop: `rgba(6,10,14,.55)` + `backdrop-filter: blur(6px) saturate(.85)`, fading in over 160 ms. The blur is what makes the rest of the app visibly *stop*.
- Dialog: `scale(.96) translateY(8px) → 1/0` on `--of-ease-spring`, 240 ms.
- A **4 px amber rail** runs down the dialog's leading edge — the only element in the app allowed a full-saturation Gate fill.
- The tool name is mono; the argument JSON sits in a scrollable well. **The literal validated arguments stay literal** — no summarisation, per the product's trust model.
- Escape / backdrop click plays a 140 ms fade-out with no overshoot — a cancel should never feel celebratory.

### 7.6 Hold TTL ring (`HoldsScreen`)

Each held row renders a 20 px SVG progress ring whose `stroke-dashoffset` tracks the countdown, coloured Gate amber, crossing to Fault red under 60 s remaining with a 1 s pulse. The `mm:ss` text (existing string, unchanged) sits beside it. When a hold expires the ring desaturates to `--of-text-3` and the row dims.

### 7.7 Savings meter (`FR-15`)

- Two horizontal bars — **manual baseline 25 min** in `--of-text-3` and **this batch** in Signal — growing from 0 on mount over ~700 ms.
- The saved-minutes figure counts up at `--of-text-metric-lg` via `requestAnimationFrame` over ~900 ms on an ease-out curve, `tabular-nums` so the width never jumps.
- The existing sentence is preserved verbatim underneath as the accessible readout.

### 7.8 Ambient texture (required cue #4)

Two layers, decorative only, composited as a **single static `background-attachment: fixed` stack on `<body>`** — no pseudo-elements, no masks, no animation:

1. **Lattice** — a 1 px `repeating-linear-gradient` grid at 32 px pitch, `--of-grid-line` at ~5 %, veiled by a canvas-coloured `radial-gradient` so it survives only at the edges and never sits behind a data cell. It gives the ground the feel of engineering paper.
2. **Aurora** — two very large, very soft radial gradients (Signal top-left, Replay bottom-right) at 6–10 % opacity. In dark mode this is what stops `#0A0F14` reading as dead; in light mode it is barely perceptible warmth.

**Why static, and why one layer.** A drifting version was built first — two animated, masked, `position: fixed` pseudo-elements — and cut. A continuously animated, masked, full-viewport layer repaints every frame for the sake of a decorative gradient, and this is a console whose main thread is busy executing agent tool calls; principle §1.4.3 (*nothing loops for its own sake*) settles it. A single static stack costs one paint and, standing still, is indistinguishable from the animated version while the reader is actually reading. A fractal-noise grain layer was evaluated for the same slot and cut for the same reason: the aurora already carries the texture, and an extra blended full-viewport layer buys banding relief this palette does not need.

Section transitions between the tab bar and the active screen use a **1 px Signal-to-transparent hairline gradient** rather than a flat border.

### 7.9 Micro-interactions

- Buttons: `translateY(-1px)` + shadow step on hover, `translateY(0)` + inset on `:active`, 120 ms.
- Primary button: a slow `background-position` sheen (2.5 s) only while `:hover`, never idle.
- Tabs: the active indicator is a 2 px Signal underline that **slides** between tabs (single shared element, `transform`, 240 ms) instead of appearing per-tab.
- Table rows: 90 ms background fade on hover; the checkbox scales 1 → 1.12 → 1 on check.
- Chips: 200 ms `scale(.9) → 1` entrance, so a "low stock" flag catches the eye once and then stops moving.
- Focus: 2 px `--of-focus` ring plus a 4 px `--of-focus-halo` glow, `outline-offset: 2px`, `:focus-visible` only.

---

## 8. Component library & stack recommendations (required cue #5)

### 8.1 What ships **now**, and why it is deliberately dependency-free

`NFR-10` budgets **< 1.5 s from cold load to five registered tools** on a judge's machine, and that budget is asserted in the E2E suite (`01-load-and-register.spec.ts`). `NFR-11` requires a clean clone to build with no secrets and no surprises. Framer Motion (~34 kB gz) plus Recharts (~95 kB gz with its D3 deps) on the critical path is a real risk against a hard, measured timing gate.

**Therefore the implementation of this plan is 100 % CSS + inline SVG, with zero new runtime dependencies.** Every widget in §7 is achievable with `@keyframes`, `stroke-dashoffset`, `clip-path`, custom properties, and `requestAnimationFrame` for two count-ups. That is not a compromise: hand-authored SVG line animation is *better* than a library for the route rail, because the rail is five nodes with a fixed topology.

### 8.2 The recommended stack when OpsFlow grows past the hackathon

Ordered by what I would actually adopt first:

| # | Library | Version line | What it buys OpsFlow | Where it goes |
|---|---|---|---|---|
| 1 | **Motion for React** (`motion`, formerly Framer Motion) | 12.x | `<AnimatePresence>` for envelope rows streaming into the timeline, layout animations when the results table re-sorts, and the `hold_order` dialog spring. Its hybrid engine runs transform/opacity off the main thread — which matters precisely when the agent is hammering the main thread with tool execution. | `CoExecutionTimeline`, `ConfirmDialog`, `AgentActivity` |
| 2 | **Radix UI Primitives** | 1.x | `Dialog` (focus trap, scroll lock, `aria-modal`), `Tabs` (roving tabindex), `Tooltip`, `Popover`. OpsFlow hand-rolls the focus trap and roving tabindex today — both correct, and both exactly the code that rots. Radix is unstyled, so the token system applies unchanged. | `ConfirmDialog`, `App` tab shell |
| 3 | **Lucide React** | 0.5xx | ~1500 consistent 24 px stroke icons, tree-shaken per import. Matches the 1.75 px stroke weight of the inline set shipped now. | Global |
| 4 | **Recharts** | 3.x | Only when OpsFlow adds a batch-history view: cycle-time trend, holds per day, surcharge attribution. Declarative, composable, SVG, themeable from CSS variables. For anything more bespoke, **visx** (`@visx/*`) instead — primitives, not charts. | Future `Analytics` screen |
| 5 | **TanStack Table v8 + TanStack Virtual** | 8.x / 3.x | Headless. The moment a batch exceeds ~200 variant rows, sorting/filtering/virtualisation stops being hand-writable. Headless means the markup — and therefore the E2E selectors — stays ours. | `BatchScreen` results table |
| 6 | **Tailwind CSS v4 + `class-variance-authority` + `tailwind-merge`** | 4.x | If the team grows. v4's `@theme` maps 1:1 onto §3's token layer, so this document survives the migration verbatim. **Not adopted now** — a hand-authored CSS layer loads faster and is easier for one author to hold in their head than a build-time utility pipeline. | Whole app |
| 7 | **Sonner** | 2.x | Toasts for non-blocking outcomes ("hold released", "quote copied"). Never for confirmations — those stay modal. | Global |
| 8 | **`@number-flow/react`** | 0.5.x | Digit-by-digit animated numerals for the savings meter and quote total, with correct `tabular-nums` and reduced-motion handling built in. Replaces the hand-rolled count-up. | `SavingsMeter`, quote card |
| 9 | **Rive** (`@rive-app/react-canvas`) | 4.x | *Only* for the empty state and the demo-video hero: a small state-machine animation of the five-node chain. Rive over Lottie — smaller files, real state machines, and it can be driven by the actual step index. | `BatchScreen` empty state |

### 8.3 Explicitly evaluated and **rejected**

| Library | Verdict |
|---|---|
| **Atropos.js** (3-D parallax card tilt) | **No.** Genuinely lovely, and wrong here. Tilting a card that contains a hold quantity and a dollar figure under the cursor makes precise reading harder and signals "marketing site" — the opposite of the trust posture in §1.1. *Recommended instead for the pitch deck / landing page in `deck/`*, where the audience is a judge, not an operator. |
| **Lenis / smooth-scroll** | No. Hijacking scroll in a console where an operator is scanning a table for a SKU is user-hostile. |
| **tsParticles / vanta.js** | No. The ambient layer in §7.8 achieves the same texture in ~20 lines of CSS and 0 kB of JS. |
| **MUI / Ant Design / Chakra** | No. Each brings its own opinionated identity, which would fight everything in this document, plus 90–300 kB. Headless (Radix) + tokens is the correct axis. |
| **Three.js / React-Three-Fiber** | No. Nothing in a fulfilment console is 3-D. |

### 8.4 Supporting tooling (non-runtime, adopt any time)

`@axe-core/playwright` (wire into `tests/e2e/08-a11y-keyboard.spec.ts` for automated WCAG assertions) · `@fontsource-variable/geist` (self-hosted font packaging) · `stylelint` + `stylelint-config-standard` (enforce "tokens only, no raw hex" via `declaration-property-value-allowed-list`) · Playwright `toHaveScreenshot` for light/dark visual regression on all three screens.

---

## 9. Section-by-section application

| Surface | Colour | Type | Motion | Notes |
|---|---|---|---|---|
| **Header** | Sticky, `--of-surface` at ~82 % + `backdrop-filter: blur(10px)`, bottom hairline | Logotype `--of-text-h1` 640; tagline `--of-text-meta` in `--of-text-3` | Signal mark draws once on load | Holds the Signal mark, tagline, **synthetic-data badge (Replay)**, Inspect-tools button and the **theme toggle** (rightmost) |
| **Synthetic badge** (`NFR-04`) | Replay soft bg, Replay text and border | `--of-text-label` uppercase | none | Persistent honesty channel. The full sentence is preserved verbatim as `aria-label`; a short visual label keeps the header from wrapping |
| **WebMCP banner** (`FR-17`) | Signal soft bg, 3 px Signal left rail | `--of-text-body-sm` | Slide-down 240 ms | Copy unchanged |
| **Degraded banner** (`FR-18`) | **Replay** soft bg and border | `--of-text-body-sm` | 2.4 s breathe on its leading dot | Never red. Degraded ≠ broken |
| **Tab bar** | Inactive `--of-text-2`; active `--of-signal` | `--of-text-label` uppercase, tracked | Sliding 2 px Signal underline | ARIA roles, ids and arrow-key handling **unchanged** |
| **Batch — goal bar** | Input `--of-input-bg`, 1 px `--of-border-strong`; focus → Signal ring + halo | `--of-text-lead`; placeholder `--of-text-3` | Focus ring 120 ms | The largest input in the app; the product's front door |
| **Batch — Run button** | Signal fill, `--of-signal-on` text | `--of-text-body` 600 | Hover sheen; on click the AgentActivity widget takes over below | Label strings unchanged |
| **Batch — activity** | Signal rail, Gate gate-nodes | Mono tool name + sans rationale | §7.2 route rail, travelling dash, elapsed counter | Replaces a bare text line |
| **Batch — results table** | Header `--of-canvas-2`, hover `--of-surface-3`; low-stock chip = Gate | SKU mono; price/stock tabular, right-aligned | Row fade-in stagger; skeleton shimmer while running | **Column order and `tbody` structure frozen** — E2E asserts `tbody td:first` contains `OPS-` |
| **Shipping — quote card** | `--of-surface` + `--of-shadow-1`; total in Signal | Total `--of-text-metric` tabular; surcharges `--of-text-body-sm` | Total counts up ~900 ms; breakdown `<ol>` expands | `.opsflow-quote`, the `<ol><li>` explain list and the Show-breakdown button are asserted by E2E — structure frozen |
| **Shipping — declarative form** (`MAN-02`) | Bordered panel with a Signal `WEBMCP · DECLARATIVE` ribbon | Labels `--of-text-label`; hint `--of-text-meta` | In-button spinner on submit | This form *is* a scoring artifact and should look like the deliberate, annotated thing it is. `toolname` / `tooldescription` untouched |
| **Holds — table** | Chips: held = Gate, confirmed = Commit, released/expired = neutral | Hold ID mono; TTL tabular | TTL ring (§7.6); confirmed row flashes Commit-soft once | Inline `style` chips become classed chips; **text values (`held`/`confirmed`/`released`) unchanged** |
| **Holds — committed banner** | Commit soft bg + Commit left rail | `--of-text-body-sm` | Spring-in 320 ms | `role="status"` and the full sentence preserved verbatim |
| **Co-Execution Timeline** (`FR-14`) | Panel `--of-surface`; rail `--of-border`; dots per §3.1 | Step id mono `--of-text-meta`; elapsed tabular `--of-text-3` | §7.4 | The judge's favourite panel. Gets the desktop side-rail slot |
| **Savings meter** (`FR-15`) | Panel with Signal left rail | Delta `--of-text-metric-lg` | §7.7 dual bars + count-up | `.opsflow-meter` class preserved (E2E) |
| **Tool Inspector** (`FR-10`) | Per-tool card; `readOnly` badge = Signal, `confirm-required` badge = **Gate** | Tool name mono `--of-text-h3`; schema `<pre>` mono 12 | Cards stagger in 40 ms apart | `[data-tool]` attributes and the five-card count preserved. The badge colouring alone communicates the trust model to a judge in one second |
| **Confirm dialog** (`FR-05`/`06`) | `--of-surface`, `--of-shadow-3`, 4 px Gate leading rail | Title `--of-text-h3` with mono tool name; args mono 13 | §7.5 | `role`, `aria-modal`, `aria-labelledby`, `data-testid`s and focus order unchanged |
| **Empty states** | `--of-text-2` on a dashed-border well | `--of-text-body-sm` | A 40 px static Signal mark above the text | Existing strings verbatim |
| **Error alerts** | Fault soft bg, Fault border and text | `--of-text-body-sm`; code in mono | 8 px, three-cycle shake on mount | `role="alert"` preserved |

---

## 10. Accessibility contract

- **Contrast:** all text/background pairs ≥ **4.5:1** (AA); component borders and status dots ≥ **3:1**. Both modes verified.
- **Never colour alone:** every status carries a shape or a word as well as a hue — the timeline's `running` dot has a halo, `done` a check, `error` a cross; hold chips carry their literal text.
- **Focus:** `:focus-visible` only, 2 px ring + halo, never removed, `outline-offset: 2px` so it clears rounded corners.
- **Motion:** `prefers-reduced-motion: reduce` neutralises every animation; both informational widgets have static equivalents (§7.1).
- **Live regions:** the timeline and the activity widget are `aria-live="polite"`. **No new `role="status"` element is introduced** — the E2E suite queries `getByRole("status")` in strict mode and a second match would break `05-holds-lifecycle`.
- **Keyboard:** tab roving, arrow-key tab switching, dialog focus trap and focus restore behave exactly as today; the theme toggle is inserted in header source order.
- **Forced colors:** `@media (forced-colors: active)` swaps decorative fills to system colours and hides the ambient layers.

---

## 11. Implementation map

```
index.html                              ← inline no-flash mode script + meta color-scheme
src/ui/styles.css                       ← entry; imports chassis operator.css then the four layers
src/ui/styles/tokens.css                ← §3 palettes (light + dark), §5 type, §6 space/radius/shadow, §7.1 motion; chassis --ui-* bridge
src/ui/styles/base.css                  ← reset, ambient layers (§7.8), focus, scrollbars, forced-colors
src/ui/styles/components.css            ← §9 component styling
src/ui/styles/motion.css                ← @keyframes + reduced-motion block
src/ui/theme/mode.ts                    ← light/dark resolver, localStorage, View Transition wipe
src/ui/components/ThemeToggle.tsx       ← §4.3 sun↔moon morph toggle
src/ui/components/Icons.tsx             ← inline SVG set incl. the Signal mark
src/ui/components/AgentActivity.tsx     ← §7.2 route-rail working widget
src/ui/components/StatusDot.tsx         ← §7.4 shared status glyph
src/ui/components/TtlRing.tsx           ← §7.6 countdown ring
src/ui/components/CountUp.tsx           ← rAF count-up used by the meter and the quote total
```

Files **modified** (classes and wrappers only — no logic, no strings, no DOM reordering): `App.tsx`, `BatchScreen.tsx`, `ShippingScreen.tsx`, `HoldsScreen.tsx`, `ConfirmDialog.tsx`, `CoExecutionTimeline.tsx`, `SavingsMeter.tsx`, `ToolInspector.tsx`, `WebMcpBanner.tsx`, `DegradedBanner.tsx`.

Files **never touched:** everything under `src/platform/**` (chassis, `NFR-05`), `src/webmcp/**`, `src/engine/**`, `api/**`, `data/**`.

### 11.1 Compatibility guardrails (the test surface this plan must not break)

1. `data-testid`: `goal-input`, `co-timeline`, `tool-inspector`, `confirm-action`, `confirm-backdrop`, `tool-<name>` — all preserved.
2. Class hooks asserted by Playwright: `.opsflow-banner*`, `.opsflow-meter`, `.opsflow-quote`, `[data-tool]`, `form[toolname]` — all preserved.
3. Table structure: `tbody td:first-child` is the SKU; no column inserted before it. Holds row order `Hold ID | Items | Status | TTL | Actions` unchanged.
4. Exactly three `role="tab"` elements. The theme toggle is a plain `<button>`.
5. Exactly one `<h1>`, reading `OpsFlow`.
6. No new `role="status"` / `role="alert"` element (strict-mode locators).
7. No `<iframe>` anywhere (`NFR-12`).
8. Every product string in `src/ui/**` byte-identical.
9. Zero new runtime dependencies → bundle and `NFR-10` cold-load budget unaffected.

**One test line changed, and why.** `tests/e2e/09-production-bundle.static.spec.ts` asserted `getComputedStyle(".opsflow").display === "flex"` as its proxy for "a stylesheet reached the built page". The console root is now `grid`, because the identity gives the Co-Execution Timeline a desktop side rail (§6.4). The assertion was widened to `["flex", "grid"]` — it still fails loudly if the stylesheet does not ship, which is the property that test exists to protect. No product behaviour, string, role, or `data-testid` was touched. Everything else in `npm test` (164 tests) and `npm run test:e2e` (62 tests) passes unmodified, including the `NFR-10` cold-load gate.

---

## 12. Verification checklist

- [ ] Light and dark both render every screen with no `color-scheme` mismatch on native controls.
- [ ] Toggle persists across reload; honours `prefers-color-scheme` before the first explicit choice; no flash on hard reload in either mode.
- [ ] `prefers-reduced-motion: reduce` — nothing animates; the activity widget still reports its step.
- [ ] `npm test` and `npm run test:e2e` pass unchanged.
- [ ] Cold load to five registered tools still < 1.5 s (`01-load-and-register.spec.ts`).
- [ ] Axe: zero serious/critical violations on all three screens, both modes.
- [ ] 320 px viewport: no horizontal page scroll; tables scroll inside their own container.
- [ ] Confirm dialog: focus lands on the primary action, the trap holds, Escape restores focus.
