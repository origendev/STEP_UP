# StepUp — Placement Hub

The original single `stepup.html` file split into modules, one per page.

## Running it

The router loads page HTML with `fetch()`, which browsers block on `file://`.
So **don't** double-click `index.html` — serve the folder instead.

In VS Code:
1. Install the **Live Server** extension (Ritwick Dey).
2. Right click `index.html` → **Open with Live Server**.

Or from a terminal in this folder:
```
python -m http.server 5500     # then open http://localhost:5500
```

## Structure

```
stepup/
├── index.html              app shell only: topbar + <main id="app">
├── css/
│   ├── base.css            colour tokens, dark mode, reset, fonts
│   ├── layout.css          topbar, page shell, shared grids, breakpoints
│   ├── components.css      cards, badges, buttons, dropdowns, progress bars
│   └── pages/
│       ├── home.css
│       ├── profile.css
│       ├── jobs.css
│       ├── demands.css
│       ├── skills.css
│       └── progress.css
├── pages/                  HTML for each page (markup only, no <script>)
│   ├── home.html
│   ├── profile.html
│   ├── jobs.html
│   ├── demands.html
│   ├── skills.html
│   └── progress.html
├── js/
│   ├── app.js              entry point: registers pages, starts the router
│   ├── core/
│   │   ├── router.js       hash routing, fetches partials, calls mount()
│   │   ├── theme.js        light / dark / system toggle (saved to localStorage)
│   │   └── dom.js          $, $$, esc, renderList helpers
│   ├── pages/              one file per page, each exports mount()
│   │   ├── home.js
│   │   ├── profile.js
│   │   ├── jobs.js
│   │   ├── demands.js
│   │   ├── skills.js
│   │   └── progress.js
│   └── data/               content, kept out of the UI code
│       ├── home.data.js
│       ├── jobs.data.js
│       ├── profile.data.js
│       ├── demands.data.js
│       └── progress.data.js
└── README.md
```

## How a page works

1. The router fetches `pages/<name>.html` and drops it into `#app`.
2. It then calls that page's `mount()` from `js/pages/<name>.js`.
3. `mount()` queries the freshly injected DOM, renders lists from
   `js/data/*.data.js`, and binds event listeners.

Because `mount()` runs on every visit, never cache DOM references at
module top level — look them up inside `mount()`.

## Adding a new page

1. `pages/reports.html` — markup, root element `<div class="view" id="view-reports">`
2. `css/pages/reports.css` — link it from `index.html`
3. `js/pages/reports.js` — `export function mount(){ ... }`
4. In `js/app.js`: import it and `router.register('reports', mountReports)`
5. In `index.html`: `<button class="navlink" data-tab="reports">Reports</button>`

## What changed from the original

- Dark mode: fixed an invalid `@media` block nested inside a selector list
  (around the old `.navlink.active` rule) that broke the rest of that ruleset.
- Theme choice now persists across refreshes via `localStorage`.
- Pages get real URLs (`#/jobs`), so refresh and the back button work.
- Repeated markup (job rows, documents, demands, timeline, funnel) is now
  generated from data files instead of being hand-written in HTML.
- The document-level "close dropdowns" listener registers once instead of
  once per page visit.
- Inline `style="..."` on repeated elements moved into CSS classes
  (`.snapshot-row`, `.profile-details`, `.doc-body`, `.readiness-label`).
