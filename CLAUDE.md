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

| Module | Init function | Triggered by |
|--------|--------------|--------------|
| `js/flashcards.js` | `initFlashcards()`, `initMatching()` | `.flashcard-deck`, `.matching-game` present in loaded fragment |
| `js/subnetting.js` | `initSubnetting()` | `#subnet-form` present in loaded fragment |
| `js/ai-explain.js` | `initAIExplain()` | `.ai-explain-btn` present in loaded fragment |

All `init*` functions are no-ops if their target elements are absent, so they're always called unconditionally after a fragment load.

### State Persistence

| Key | Storage | Purpose |
|-----|---------|---------|
| `csp-theme` | localStorage | dark / light preference |
| `csp-sidebar-collapsed` | localStorage | desktop sidebar collapse (1/0) |
| `csp-ai-calls` | localStorage | rate-limit counter (max 20) |
| `csp-accordion-{path}-{idx}` | sessionStorage | accordion open states |
| `csp-deck-{path}-{deckIdx}` | sessionStorage | flashcard position |

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

## Working From Handoff Plans

Content remediation is driven by handoff documents. **They have been wrong repeatedly, in a consistent direction:** they infer gaps by comparing an objectives list against older notes instead of reading the live files, so they call for content that already exists.

- **Audit the live file before implementing any plan item — including items the plan states are missing.** Three consecutive revisions of the Domain 1 plan specified adding content that was already present: cellular, satellite, RJ11, NAT64, and in v3 the IPv4 address-class table, which the plan described as lacking Class E when all five classes were already there.
- **If an item turns out to be already covered, stop and report rather than duplicating it.** Extend what exists. Building a parallel component next to an equivalent one is the systemic failure mode on this platform — it is what produced the aggregate/per-objective drift that had to be cleaned up.
- **A grep hit is not coverage.** Matches are often `<!-- GAP: -->` placeholder comments. Extract the surrounding context and read it before concluding a topic is present or absent.
- **Cross-reference, do not copy.** The official objectives deliberately list the same topic under several objectives. Choose one authoritative location and point at it from the others.
- **Never reintroduce** `data-exam-weight`, `exam-star`, or the aggregate `content/netplus/domainN.html` files. All three were deliberately removed.
- **Depth is proportional to exam weight** — Domain 5 is 24% of the exam, Domain 4 is 14%.

## Verification

There is no build, lint, or test step, so nothing catches a mistake automatically. Before committing:

- **Render the page in a browser — do not review by diff alone.** Serve the repo, open the affected route, and look at it. Layout bugs (broken flex, mismatched grid columns, wrapped table rows) do not appear in a text diff. A headless screenshot via Playwright works well when no display is available; Chromium is preinstalled in the Claude Code web environment at `/opt/pw-browsers` — never run `playwright install`.
- **Check both themes and mobile.** Toggle `data-theme` between `dark` and `light` on `<html>`, and check at ~390px width. Confirm readable text resolves to `--text` in both themes, not `--muted` or `--hint`.
- **Re-test interactive components after editing their file.** The DNS matching game (`obj-3-4`), the attack-mitigation matching game (`obj-4-2`), and every flashcard deck are wired up after each fragment swap. A broken game is easy to miss in a diff.
- **Balance-check the fragment.** `<div>`/`</div>` and `<p>`/`</p>` counts must match — an unbalanced fragment corrupts the whole page once injected.
- **Diff against `origin/main`, not `main`.** The local `main` ref goes stale fast; `git diff main...HEAD` can make an 8-line change look like a 5,000-line rewrite. Use `git fetch origin main && git diff origin/main...HEAD`.
- **Check `study-plans.html` when content moves between objectives.** It contains `inline-nav` links into specific objective pages. These will not 404 — they will silently land on the wrong page.
- **Non-`main` branches do not trigger Vercel auto-deploy.** Check the deployment timestamp in the Vercel dashboard before concluding a change did not take effect.
