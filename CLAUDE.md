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

**`tools/`** holds the dev utilities. `check.js` checks the content and CSS rules below (balanced tags, table wrappers, first-use `<abbr>`, navigation targets, inline styles, colour tokens); `smoke.js` clicks through every interactive component; `shot.js` screenshots one route in dark, light, and mobile; `snap.js` screenshots every route and compares two snapshot sets pixel by pixel. CI runs `check.js` and `smoke.js` on every PR (`.github/workflows/check.yml`). None of them is a build step: the site remains plain static files with no runtime dependencies, and nothing under `tools/` is served or shipped. All but `check.js` need Playwright available to node (`npm i -g playwright`).

## Architecture

### Hash-Based Router (`js/nav.js`)

**`js/catalog.js` is the list of every page.** `js/sidebar.js` renders each cert's sidebar from it (the `<aside>` in `index.html` is empty), breadcrumbs take the cert name from it, and the tools read its `ROUTES` to find every page. Adding a page means a catalog entry plus a file under `content/`; `check.js` fails on a route with no file or a file with no route. A renamed route keeps its old path working through `ALIASES`. Opening any route shows that cert's sidebar, so prev/next and breadcrumbs work on deep links.

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

**`css/base.css`** defines all design tokens as CSS custom properties on `:root`. Always use these tokens for colour — never hardcode a colour value. There are no spacing tokens; match the rem-based spacing of neighbouring components.

Key tokens: `--bg`, `--surface`, `--surface2`, `--surface3` (backgrounds); `--text`, `--muted`, `--hint` (text); `--blue/green/amber/red/purple/teal` with `-bg` and `-border` variants; `--radius`, `--radius-lg`.

Light mode is handled by `[data-theme="light"]` overrides on the same token names in `base.css`. New components that need theme support must use these tokens — avoid hardcoded `rgba()` colour values in component rules.

**`css/components.css`** contains all component styles. New visual components (diagrams, interactive widgets) are appended here. Use `data-*` attribute selectors for variants (e.g., `[data-layer="7"]`, `[data-group="web"]`) to avoid proliferating modifier classes.

**Never put `display: flex` on a container whose content is prose.** Flex promotes every contiguous text run *and* every inline element (`<strong>`, `<abbr>`, `<code>`) to its own flex item, so a sentence renders as vertical strips. This shipped once in `.note-nonexhaustive` and was invisible in the diff. Use normal inline flow with an `inline-block` lead-in badge instead. Flex is for laying out block children — cards, rows, grids — not for putting a label beside a sentence.

**Check who else uses a class before changing it.** Run `grep -rl 'class-name' content/` first. `obj-1-5.html` and `obj-2-3.html` share `.std-*`, so restyling either breaks the other. Changing a grid component's `grid-template-columns` is a three-part edit: the header rule, the row rule, **and** the mobile `@media` block — plus every row's cell count in the markup. A mismatch between cell count and column count silently reflows the whole table.

### Interactive Components

**`initFragmentComponents(path)` in `js/nav.js` is the single entry point.** It runs after every fragment swap and calls each function in the `COMPONENTS` array at the top of `nav.js`. Adding an interactive component means writing `js/components/<name>.js`, adding its init to `COMPONENTS`, and adding a scenario to `tools/smoke.js` — nothing self-registers. Each init runs in its own `try`/`catch`, so a throwing component logs an error instead of blanking the page.

Every fragment swap replaces the DOM, so inits attach listeners to fresh elements and never need to remove old ones.

| Init function | Module | Triggered by |
|---|---|---|
| `initAccordions(path)` | `components/accordions.js` | `.accordion-header` + next-sibling `.accordion-body` |
| `initToggleGroups()` | `components/toggle-groups.js` | `.toggle-group .toggle-btn[data-target]` |
| `initFlashcards(path)` | `components/flashcards.js` | `.flashcard-deck` / `.flashcard` |
| `initMatching()` | `components/matching.js` | `.matching-game` |
| `initAIExplain()` | `components/ai-explain.js` | `.ai-explain-btn` |
| `initFlips()` | `components/flips.js` | `.osi-flip-card`, `.arch-flip-card`, `.flip-card`, `.ids-ips-flip-card`, `.protocol-ref-row` — one `VARIANTS` row each |
| `initDayTabs()` | `components/day-tabs.js` | `.cram-day-tabs` / `.cram-day-btn` |
| `initChecklist()` | `components/checklist.js` | `.checklist[data-store]` |
| `initBinaryBits()` | `components/binary-bits.js` | `#bit-grid`, `#bit-total`, `.binary-bit-cell` |
| `initGuidedSubnetting()` | `components/guided-subnetting.js` | `#subnet-guide`, `#sg-body` |
| `initPbq()` | `components/pbq.js` | `.pbq` holding `.pbq-field` / `.pbq-slot` + `.pbq-bank` — graded by `data-check` (a `CHECKS` key) against `data-answer` |
| `initPbqProgress()` | `components/pbq.js` | `[data-pbqs]` cards on the PBQ overview; passes are stored by each `.pbq`'s `data-pbq` id |
| `initPbqGenerators()` | `components/pbq-generators.js` | `.pbq[data-generator]` — a `GENERATORS` entry rewrites the PBQ's `data-gen` hooks |
| `initPbqExam()` | `components/pbq-exam.js` | `.pbq-exam[data-pages]` — draws random `.pbq`s from those lab pages |
| `initPbqTerminals()` | `components/pbq-terminal.js` | `.pbq-term` with one `.pbq-term-host` per device, each answering its `<template data-cmd>` children |
| `initSubnetTools()` | `components/subnet-calc.js` | `.subnet-calc`, `.vlsm`, `.subnet-drill` |

Links inside fragments (`.inline-nav`, `.quicknav-card`, `.cert-home-card`) call the router, so they are wired in `initFragmentComponents` itself.

All `init*` functions are no-ops if their target elements are absent, so they're always called unconditionally after a fragment load. **If you edit a fragment containing any selector above, re-test that component in a browser** — a broken handler is invisible in a text diff.

### State Persistence

Storage keys are `csp-` prefixed, with one exception: `.checklist[data-store]` uses its `data-store` attribute value verbatim as the storage key, so these keys are *not* `csp-` prefixed (`az900v2-cloud`, `az900v2-arch`, …). New checklists should keep following the existing `data-store` values in their own content area rather than inventing a parallel scheme.

## Design Philosophy

**Avoid generic fonts.** Body text uses the system UI stack defined in `css/base.css`. Do not introduce Inter, Roboto, or Space Grotesk; if a component needs a display font, choose one with actual character.

**No cookie-cutter component patterns.** No washed-out muted palettes, no grey-on-grey, no low-contrast milky tones. In new components, also avoid the stock defaults: italic accent words in headlines, numbered "01 / 02 / 03" section labels, monospace labels, and pill-shaped buttons.

**Contrast and color rules:**
- Background: true near-black (`#0d0d0d` or similar) — not `#1a1a1a` grey soup
- Body text: high-contrast white or near-white (`#f0f0f0`+) — use `--text`, never `--muted` for content users must read
- Accent colors: fully saturated and visually punchy — every accent must be distinct and immediately recognizable
- `--muted` (`#888` dark, `#495057` light) is for genuinely secondary/decorative text only (timestamps, separators, "click to flip" hints) — never for labels, values, notes, or anything a student needs to read
- Never use `opacity` to fade readable text — use an explicit color token instead

Much of the existing CSS predates these rules: `components.css` still has ~120 hardcoded hex/`rgba()` colours, `--muted` on body copy, and opacity-faded text. Don't copy a nearby rule as precedent without checking it against the rules above.

## Content Conventions

- **Terminals:** Use `.terminal` + `.terminal-bar` + `.terminal-body`. Host-side prompts use `<span class="tpw">PS C:\&gt;</span>` (PowerShell). Cisco IOS prompts use `<span class="tpc">Switch1#</span>`. Syntax classes: `.th` (highlight), `.ts` (success), `.te` (error), `.tn` (annotation/comment).
- **AI Explain buttons:** every `.ai-explain-btn` needs a `data-topic`. `api/explain.js` answers only the topics listed in `api/topics.js`, so the key can't be used as a general-purpose model; after adding or editing a topic, run `node tools/check.js --fix` to regenerate that list (CI fails until you do).
- **Callouts:** `<div class="callout callout-{blue|teal|amber|green|red|purple}">` with a `<div class="callout-title">` child.
- **Acronyms:** Wrap first use of each acronym in `<abbr title="Full expansion">ABBR</abbr>`. `node tools/check.js --fix` wraps any first use it can resolve from the expansions already used in the same certification's pages; an acronym with two meanings there (STP) is reported for you to wrap by hand.
- **Tables:** Always wrap in `<div class="table-wrap">` for horizontal scroll on mobile. The AZ-900 page uses the equivalent `.cmp-wrap`; don't introduce another wrapper class.
- **Accordions:** `<div class="accordion-header">` followed by `<div class="accordion-body">` — toggled by `nav.js`.
- **Non-exhaustive notes:** Content may be included that the official CompTIA objectives do not enumerate — CompTIA states its lists are non-exhaustive — but every such item must carry a visible student-facing note. Place one note per affected section, immediately after the table or block it applies to:

  ```html
  <p class="note-nonexhaustive"><span class="note-nonexhaustive-tag">Not in official objectives</span> Objective X.Y lists <em>…what is listed…</em>. <strong>Foo</strong> and <strong>bar</strong> are not enumerated. …why they are kept…</p>
  ```

  The note explains why content **stays** — it is never a justification for deleting content. Say what the objective does list, name what is not enumerated, and give the reason for including it. Do not restyle the component per-page; it is deliberately quieter than a `.callout`.
- **Never reintroduce** `data-exam-weight`, `exam-star`, or the aggregate `content/netplus/domainN.html` files. All three were deliberately removed.
- **Depth is proportional to exam weight** — Domain 5 is 24% of the exam, Domain 4 is 14%.
- **Implementing a handoff plan?** Load the `handoff-plans` skill first — the plans have been wrong repeatedly.

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

There is no build step, and CI only runs `check.js` and `smoke.js`. Rendering problems are still yours to catch. Before committing:

- **Run `node tools/check.js` and `node tools/smoke.js`.** CI runs both; running them first saves a round trip.

- **Render the page — do not review by diff alone.** Layout bugs (broken flex, mismatched grid columns, wrapped table rows) do not appear in a text diff. Use `tools/shot.js`, which serves the repo and captures the route in dark, light, and mobile in one command:

  ```bash
  node tools/shot.js netplus/domain1/obj-1-7 .addr-class-wrap   # one component
  node tools/shot.js netplus/domain1/obj-1-7                    # whole page
  ```

  Then **look at the PNGs** it writes to `tools/shots/` (gitignored) — running it is not the check, reading it is. With a selector it also prints the element's computed text and background colour, so the `--text` rule below is verifiable at a glance; it exits non-zero if the selector is missing. It needs Playwright available to node (`npm i -g playwright`). In the Claude Code web environment, Chromium is preinstalled at `/opt/pw-browsers` — don't run `playwright install` there.
- **Prove a refactor or CSS cleanup changed nothing.** Take a baseline from `origin/main` in a worktree and compare it with the working tree — `compare` exits non-zero on any pixel difference and writes red-highlighted diff images:

  ```bash
  git worktree add ../csp-main origin/main
  node tools/snap.js take /tmp/snap-main --root ../csp-main
  node tools/snap.js take /tmp/snap-head
  node tools/snap.js compare /tmp/snap-main /tmp/snap-head
  ```
- **Check both themes and mobile.** `shot.js` covers all three. Confirm readable text resolves to `--text` in both themes, not `--muted` or `--hint`.
- **Keep `smoke.js` covering every interactive component.** It drives each one once (flip, match, toggle, persist, navigate). When you add a component or change what one does, add or update its scenario in `SCENARIOS` — a broken game is easy to miss in a diff, and a component with no scenario is untested.
- **Diff against `origin/main`, not `main`.** The local `main` ref goes stale fast; `git diff main...HEAD` can make an 8-line change look like a 5,000-line rewrite. Use `git fetch origin main && git diff origin/main...HEAD`.
- **Check `study-plans.html` when content moves between objectives.** It contains `inline-nav` links into specific objective pages. These will not 404 — they will silently land on the wrong page.
- **Only `main` deploys to production.** Branches get Vercel preview deployments (linked from the PR's Vercel check), not production. Check the production deployment's timestamp before concluding a change did not take effect.
