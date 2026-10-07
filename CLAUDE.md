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

**`tools/shot.js`** is the one dev utility — a render check that serves the repo and screenshots a route in dark, light, and mobile (see Verification). It is not a build step: the site remains plain static files with no runtime dependencies, and nothing under `tools/` is served or shipped. It needs Playwright available to node (`npm i -g playwright`) and is skippable if you can just open the page yourself.

## Architecture

### Hash-Based Router (`js/nav.js`)

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

**`css/base.css`** defines all design tokens as CSS custom properties on `:root`. Always use these tokens for colour — never hardcode a colour value. There are no spacing tokens; match the rem-based spacing of neighbouring components.

Key tokens: `--bg`, `--surface`, `--surface2`, `--surface3` (backgrounds); `--text`, `--muted`, `--hint` (text); `--blue/green/amber/red/purple/teal` with `-bg` and `-border` variants; `--radius`, `--radius-lg`.

Light mode is handled by `[data-theme="light"]` overrides on the same token names in `base.css`. New components that need theme support must use these tokens — avoid hardcoded `rgba()` colour values in component rules.

**`css/components.css`** contains all component styles. New visual components (diagrams, interactive widgets) are appended here. Use `data-*` attribute selectors for variants (e.g., `[data-layer="7"]`, `[data-group="web"]`) to avoid proliferating modifier classes.

**Never put `display: flex` on a container whose content is prose.** Flex promotes every contiguous text run *and* every inline element (`<strong>`, `<abbr>`, `<code>`) to its own flex item, so a sentence renders as vertical strips. This shipped once in `.note-nonexhaustive` and was invisible in the diff. Use normal inline flow with an `inline-block` lead-in badge instead. Flex is for laying out block children — cards, rows, grids — not for putting a label beside a sentence.

**Check who else uses a class before changing it.** Run `grep -rl 'class-name' content/` first. `obj-1-5.html` and `obj-2-3.html` share `.std-*`, so restyling either breaks the other. Changing a grid component's `grid-template-columns` is a three-part edit: the header rule, the row rule, **and** the mobile `@media` block — plus every row's cell count in the markup. A mismatch between cell count and column count silently reflows the whole table.

### Interactive Components

**`initFragmentComponents(path)` in `js/nav.js` is the single entry point.** It runs after every fragment swap and calls all of the following unconditionally. Adding a new interactive component means adding its `init*` call there — nothing self-registers.

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
- **Callouts:** `<div class="callout callout-{blue|teal|amber|green|red|purple}">` with a `<div class="callout-title">` child.
- **Acronyms:** Wrap first use of each acronym in `<abbr title="Full expansion">ABBR</abbr>`.
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

There is no build, lint, or test step, so nothing catches a mistake automatically. Before committing:

- **Render the page — do not review by diff alone.** Layout bugs (broken flex, mismatched grid columns, wrapped table rows) do not appear in a text diff. Use `tools/shot.js`, which serves the repo and captures the route in dark, light, and mobile in one command:

  ```bash
  node tools/shot.js netplus/domain1/obj-1-7 .addr-class-wrap   # one component
  node tools/shot.js netplus/domain1/obj-1-7                    # whole page
  ```

  Then **look at the PNGs** it writes to `tools/shots/` (gitignored) — running it is not the check, reading it is. With a selector it also prints the element's computed text and background colour, so the `--text` rule below is verifiable at a glance; it exits non-zero if the selector is missing. It needs Playwright available to node (`npm i -g playwright`). In the Claude Code web environment, Chromium is preinstalled at `/opt/pw-browsers` — don't run `playwright install` there.
- **Check both themes and mobile.** `shot.js` covers all three. Confirm readable text resolves to `--text` in both themes, not `--muted` or `--hint`.
- **Re-test interactive components after editing their file.** The DNS matching game (`obj-3-4`), the attack-mitigation matching game (`obj-4-2`), and every flashcard deck are wired up after each fragment swap. A broken game is easy to miss in a diff.
- **Balance-check the fragment.** `<div>`/`</div>` and `<p>`/`</p>` counts must match — an unbalanced fragment corrupts the whole page once injected.
- **Diff against `origin/main`, not `main`.** The local `main` ref goes stale fast; `git diff main...HEAD` can make an 8-line change look like a 5,000-line rewrite. Use `git fetch origin main && git diff origin/main...HEAD`.
- **Check `study-plans.html` when content moves between objectives.** It contains `inline-nav` links into specific objective pages. These will not 404 — they will silently land on the wrong page.
- **Only `main` deploys to production.** Branches get Vercel preview deployments (linked from the PR's Vercel check), not production. Check the production deployment's timestamp before concluding a change did not take effect.
