# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development

**No build toolchain.** There is no `package.json`, bundler, or compilation step. Serve the repo root with any static file server:

```bash
npx serve .          # or
python3 -m http.server 8080
```

Open `http://localhost:8080`. Changes to HTML/CSS/JS are reflected on next page reload — no build required.

**API function** (`api/explain.js`) runs as a Vercel serverless function. For local testing it requires the `ANTHROPIC_API_KEY` environment variable and the Vercel CLI:

```bash
npx vercel dev
```

There are no lint, test, or type-check scripts.

**`tools/shot.js`** is the one dev utility — a render check that serves the repo and screenshots a route in dark, light, and mobile (see Verification). It is not a build step: the site remains plain static files with no runtime dependencies, and nothing under `tools/` is served or shipped. It needs Playwright available to node (`npm i -g playwright`) and is skippable if you can just open the page yourself.

## Architecture

### Single-Page Application Shell

`index.html` is the only real HTML page. It contains the header, sidebar, and an empty `#content-area` div. All other content is loaded dynamically as HTML fragments via `fetch()`.

### Hash-Based Router (`js/nav.js`)

`nav.js` is the central orchestrator. It handles:

- **Fragment loading:** A URL like `#/netplus/domain1/obj-1-1` causes a `fetch('./content/netplus/domain1/obj-1-1.html')` whose response is injected into `#content-area`. Loaded fragments are cached in a `Map` for the session.
- **Component initialization:** After every fragment load, `nav.js` calls `initSubnetting()`, `initFlashcards()`, `initMatching()`, and `initAIExplain()` from the other JS modules — this is why all interactive components must be initialized imperatively, not via DOMContentLoaded.
- **Sidebar state:** Domain collapsibles, desktop collapse toggle, mobile hamburger, and scroll-spy sub-nav are all managed here.
- **Injected chrome:** Breadcrumb, prev/next footer nav, and sticky domain sub-nav are injected by `nav.js` after the fragment loads — they are not present in the fragment files themselves.

Navigation is driven by `[data-path]` attributes on sidebar links. Adding a new page requires a `data-path` entry in the sidebar HTML in `index.html` and a corresponding file under `content/`.

### Content Fragments

Files under `content/` are plain HTML fragments (no `<html>`, `<head>`, or `<body>` tags). They are written as a series of semantic sections. The convention for objective pages:

```html
<div class="obj-section" id="obj-X-Y">
  <div class="section-eyebrow">Objective X.Y</div>
  <h2>Title</h2>
  <!-- content, callouts, tables, terminals, interactive components -->
  <div class="ai-explain-area">
    <button class="ai-explain-btn" data-topic="topic description">✦ Explain Differently</button>
  </div>
</div>
```

### CSS Architecture

**`css/base.css`** defines all design tokens as CSS custom properties on `:root`. Always use these tokens — never hardcode colours or spacing.

Key tokens: `--bg`, `--surface`, `--surface2`, `--surface3` (backgrounds); `--text`, `--muted`, `--hint` (text); `--blue/green/amber/red/purple/teal` with `-bg` and `-border` variants; `--radius`, `--radius-lg`.

Light mode is handled by `[data-theme="light"]` overrides on the same token names in `base.css`. New components that need theme support must use these tokens — avoid hardcoded `rgba()` colour values in component rules.

**`css/components.css`** contains all component styles. New visual components (diagrams, interactive widgets) are appended here. Use `data-*` attribute selectors for variants (e.g., `[data-layer="7"]`, `[data-group="web"]`) to avoid proliferating modifier classes.

**Never put `display: flex` on a container whose content is prose.** Flex promotes every contiguous text run *and* every inline element (`<strong>`, `<abbr>`, `<code>`) to its own flex item, so a sentence renders as vertical strips. This shipped once in `.note-nonexhaustive` and was invisible in the diff. Use normal inline flow with an `inline-block` lead-in badge instead. Flex is for laying out block children — cards, rows, grids — not for putting a label beside a sentence.

**Check who else uses a class before changing it.** Run `grep -rl 'class-name' content/` first. `obj-1-5.html` and `obj-2-3.html` share `.std-*`, so restyling either breaks the other. Changing a grid component's `grid-template-columns` is a three-part edit: the header rule, the row rule, **and** the mobile `@media` block — plus every row's cell count in the markup. A mismatch between cell count and column count silently reflows the whole table.

### Interactive Components

**`initFragmentComponents(path)` (`js/nav.js:292`) is the single entry point.** It runs after every fragment swap and calls all of the following unconditionally. Adding a new interactive component means adding its `init*` call there — nothing self-registers.

Only four components live in their own modules; **the other nine are defined inside `nav.js` itself**, which is easy to miss when looking for a component's implementation.

| Init function | Defined in | Triggered by |
|---|---|---|
| `initSubnetting()` | `js/subnetting.js` | `#subnet-form` |
| `initFlashcards(path)` | `js/flashcards.js` | `.flashcard-deck` / `.flashcard` |
| `initMatching()` | `js/flashcards.js` | `.matching-game` |
| `initAIExplain()` | `js/ai-explain.js` | `.ai-explain-btn` |
| `initProtocolRefFlips()` | `js/nav.js` | `.protocol-ref-row` |
| `initDayTabs()` | `js/nav.js` | `.cram-day-tabs` / `.cram-day-btn` |
| `initChecklist()` | `js/nav.js` | `.checklist[data-store]` |
| `initBinaryBits()` | `js/nav.js` | `#bit-grid`, `#bit-total`, `.binary-bit-cell` |
| `initIDSIPSFlips()` | `js/nav.js` | `.ids-ips-flip-card` (delegates to `initFlipCards`) |
| `initOSIFlips()` | `js/nav.js` | `.osi-flip-card` |
| `initArchFlips()` | `js/nav.js` | `.arch-flip-card` |
| `initFlipCards(sel, hintSel)` | `js/nav.js` | generic flip helper; called directly for `.flip-card` |
| `initGuidedSubnetting()` | `js/nav.js` | `#subnet-guide`, `#sg-body` |

All `init*` functions are no-ops if their target elements are absent, so they're always called unconditionally after a fragment load. **If you edit a fragment containing any selector above, re-test that component in a browser** — a broken handler is invisible in a text diff.

### State Persistence

| Key | Storage | Purpose |
|-----|---------|---------|
| `csp-theme` | localStorage | dark / light preference |
| `csp-sidebar-collapsed` | localStorage | desktop sidebar collapse (1/0) |
| `csp-ai-calls` | localStorage | rate-limit counter (max 20) |
| `csp-accordion-{path}-{idx}` | sessionStorage | accordion open states |
| `csp-deck-{path}-{deckIdx}` | sessionStorage | flashcard position |
| whatever `data-store` says | localStorage | checklist tick state, as a JSON object |

**Note the exception:** `.checklist[data-store]` uses its `data-store` attribute value verbatim as the storage key, so these keys are *not* `csp-` prefixed (`az900v2-cloud`, `az900v2-arch`, …). New checklists should keep following the existing `data-store` values in their own content area rather than inventing a parallel scheme.

### API (`api/explain.js`)

Vercel serverless function. Accepts `POST /api/explain` with JSON body `{ topic: string }`. Calls `claude-sonnet-4-20250514` with `max_tokens: 300`. Requires `ANTHROPIC_API_KEY` env var; optionally `ALLOWED_ORIGIN` for CORS.

## Design Philosophy

**Avoid generic fonts.** Do not use Inter, Roboto, or Space Grotesk. Choose a font with actual character.

**No cookie-cutter component patterns.** Avoid the default AI design aesthetic: no washed-out muted palettes, no grey-on-grey, no low-contrast milky tones.

**Contrast and color rules:**
- Background: true near-black (`#0d0d0d` or similar) — not `#1a1a1a` grey soup
- Body text: high-contrast white or near-white (`#f0f0f0`+) — use `--text`, never `--muted` for content users must read
- Accent colors: fully saturated and visually punchy — every accent must be distinct and immediately recognizable
- `--muted` (`#888`) is for genuinely secondary/decorative text only (timestamps, separators, "click to flip" hints) — never for labels, values, notes, or anything a student needs to read
- Never use `opacity` to fade readable text — use an explicit color token instead

## Content Conventions

- **Terminals:** Use `.terminal` + `.terminal-bar` + `.terminal-body`. Host-side prompts use `<span class="tpw">PS C:\&gt;</span>` (PowerShell). Cisco IOS prompts use `<span class="tpc">Switch1#</span>`. Syntax classes: `.th` (highlight), `.ts` (success), `.te` (error), `.tn` (annotation/comment).
- **Callouts:** `<div class="callout callout-{blue|amber|green|red|purple}">` with a `<div class="callout-title">` child.
- **Acronyms:** Wrap first use of each acronym in `<abbr title="Full expansion">ABBR</abbr>`.
- **Tables:** Always wrap in `<div class="table-wrap">` for horizontal scroll on mobile.
- **Accordions:** `<div class="accordion-header">` followed by `<div class="accordion-body">` — toggled by `nav.js`.
- **Non-exhaustive notes:** Content may be included that the official CompTIA objectives do not enumerate — CompTIA states its lists are non-exhaustive — but every such item must carry a visible student-facing note. Place one note per affected section, immediately after the table or block it applies to:

  ```html
  <p class="note-nonexhaustive"><span class="note-nonexhaustive-tag">Not in official objectives</span> Objective X.Y lists <em>…what is listed…</em>. <strong>Foo</strong> and <strong>bar</strong> are not enumerated. …why they are kept…</p>
  ```

  The note explains why content **stays** — it is never a justification for deleting content. Say what the objective does list, name what is not enumerated, and give the reason for including it. Do not restyle the component per-page; it is deliberately quieter than a `.callout`.

## Finishing Work

**Every unit of work ends with the same sequence. Run it automatically — do not stop to ask whether to review, and do not stop to ask whether to merge.**

1. **Self-review the diff.** `git fetch origin main && git diff origin/main...HEAD`. Read every hunk as if it were someone else's pull request. Confirm the change is scoped to what was actually asked, that nothing unrelated crept in, and that there are no debug leftovers, stale comments, or duplicated content.
2. **Verify** — work the Verification checklist below. Render the affected routes, check both themes and ~390px, re-test any interactive component whose fragment you touched, balance-check the tags.
3. **Fix whatever the review and verification turned up, then re-review the result.** Never carry a known defect into a PR.
4. **Commit and push** to the working branch.
5. **Open a PR** if one is not already open for that branch.
6. **Wait for CI to be green.**
7. **Double-check.** Re-read the pushed diff one last time against the original request. Confirm every acceptance criterion is actually met, and that the PR body describes what shipped rather than what was planned.
8. **Merge to `main`,** then report what shipped.

Steps 1–3 are a real review, not a formality: the two defects that reached a PR in this repo — a flex container that shattered a paragraph into columns, and a plan item implemented against a stale description of the file — would both have been caught by reading the diff and rendering the page.

### Stop and ask instead of merging when

Ordinary content and component work merges automatically. Hold and ask first only if:

- CI is red, or a render check shows a regression you cannot confidently fix
- The change **deletes content, renames files, or changes routes** — the structural layout is settled and reversing a bad route change is expensive
- The review surfaced a decision that is genuinely the user's: a handoff-plan item that appears wrong, a scope question, or contradictory sources
- The change touches credential or CORS handling in `api/explain.js`

## Verification

There is no build, lint, or test step, so nothing catches a mistake automatically. Before committing:

- **Render the page — do not review by diff alone.** Layout bugs (broken flex, mismatched grid columns, wrapped table rows) do not appear in a text diff. Use `tools/shot.js`, which serves the repo and captures the route in dark, light, and mobile in one command:

  ```bash
  node tools/shot.js netplus/domain1/obj-1-7 .addr-class-wrap   # one component
  node tools/shot.js netplus/domain1/obj-1-7                    # whole page
  ```

  Then **look at the PNGs** it writes to `tools/shots/` (gitignored) — running it is not the check, reading it is. With a selector it also prints the element's computed text and background colour, so the `--text` rule below is verifiable at a glance; it exits non-zero if the selector is missing. It needs Playwright available to node (`npm i -g playwright`). Chromium is preinstalled in the Claude Code web environment at `/opt/pw-browsers` — never run `playwright install`.
- **Check both themes and mobile.** `shot.js` covers all three. Confirm readable text resolves to `--text` in both themes, not `--muted` or `--hint`.
- **Re-test interactive components after editing their file.** The DNS matching game (`obj-3-4`), the attack-mitigation matching game (`obj-4-2`), and every flashcard deck are wired up after each fragment swap. A broken game is easy to miss in a diff.
- **Balance-check the fragment.** `<div>`/`</div>` and `<p>`/`</p>` counts must match — an unbalanced fragment corrupts the whole page once injected.
- **Diff against `origin/main`, not `main`.** The local `main` ref goes stale fast; `git diff main...HEAD` can make an 8-line change look like a 5,000-line rewrite. Use `git fetch origin main && git diff origin/main...HEAD`.
- **Check `study-plans.html` when content moves between objectives.** It contains `inline-nav` links into specific objective pages. These will not 404 — they will silently land on the wrong page.
- **Non-`main` branches do not trigger Vercel auto-deploy.** Check the deployment timestamp in the Vercel dashboard before concluding a change did not take effect.

## Working From Handoff Plans

Content remediation is driven by handoff documents. **They have been wrong repeatedly, in a consistent direction:** they infer gaps by comparing an objectives list against older notes instead of reading the live files, so they call for content that already exists.

- **Audit the live file before implementing any plan item — including items the plan states are missing.** Three consecutive revisions of the Domain 1 plan specified adding content that was already present: cellular, satellite, RJ11, NAT64, and in v3 the IPv4 address-class table, which the plan described as lacking Class E when all five classes were already there.
- **If an item turns out to be already covered, stop and report rather than duplicating it.** Extend what exists. Building a parallel component next to an equivalent one is the systemic failure mode on this platform — it is what produced the aggregate/per-objective drift that had to be cleaned up.
- **A grep hit is not coverage.** Matches are often `<!-- GAP: -->` placeholder comments. Extract the surrounding context and read it before concluding a topic is present or absent.
- **Cross-reference, do not copy.** The official objectives deliberately list the same topic under several objectives. Choose one authoritative location and point at it from the others.
- **Never reintroduce** `data-exam-weight`, `exam-star`, or the aggregate `content/netplus/domainN.html` files. All three were deliberately removed.
- **Depth is proportional to exam weight** — Domain 5 is 24% of the exam, Domain 4 is 14%.

**Remaining work is marked in place.** `<!-- GAP: topic — see content remediation plan -->` comments sit at the exact insertion point for content that is genuinely missing. They are the authoritative to-do list, and they are the reason a plain grep gives false positives — the topic name appears in the file while the content does not. Current placement:

**No GAP comments remain in the repo** (`grep -rn 'GAP:' content/` returns nothing). Both files that carried them are done:

| File | GAPs | Status |
|---|---|---|
| `content/netplus/domain3/obj-3-1.html` | 5 | Closed. BCP, system life cycle, knowledge base article, and MOU were filled; clean-desk policy was dropped as out of scope — it appears in neither the objectives nor the v6.0 acronym list |
| `content/netplus/domain3/obj-3-3.html` | 3 | Closed — active-active vs active-passive, tabletop exercises, validation tests |

Domain 5 is complete — `obj-5-5.html`'s 17 GAPs were closed by populating the section, and 5.1–5.3 were closed against the Domain 5 handoff v2. Domain 3 is complete against the Domain 3 handoff v3 (all five phases).

Remaining domains have handoff plans but no GAP markers, so the plans themselves are the to-do list — audit the live file before implementing any item.

Delete a GAP comment only when you have replaced it with the content it names.
