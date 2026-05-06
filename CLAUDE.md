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

## Content Conventions

- **Terminals:** Use `.terminal` + `.terminal-bar` + `.terminal-body`. Host-side prompts use `<span class="tpw">PS C:\&gt;</span>` (PowerShell). Cisco IOS prompts use `<span class="tpc">Switch1#</span>`. Syntax classes: `.th` (highlight), `.ts` (success), `.te` (error), `.tn` (annotation/comment).
- **Callouts:** `<div class="callout callout-{blue|amber|green|red|purple}">` with a `<div class="callout-title">` child.
- **Acronyms:** Wrap first use of each acronym in `<abbr title="Full expansion">ABBR</abbr>`.
- **Tables:** Always wrap in `<div class="table-wrap">` for horizontal scroll on mobile.
- **Accordions:** `<div class="accordion-header">` followed by `<div class="accordion-body">` — toggled by `nav.js`.
