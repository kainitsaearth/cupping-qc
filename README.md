# Cupping QC — 4th Street Roastery

Offline-first PWA for coffee quality control. No build step, no dependencies, no backend.

## Two modes

**Table cupping** — 2–6 different coffees, full 8-attribute SCA CVA scoring.
Produces a cup score on the 58.00–100.00 scale.

**Batch screening** — one or more lots/profiles, many batches each. Direct
PASS / Pulled Shot / FAIL verdicts with a required defect cause on failures.
Produces **no CVA score** — three of eight attributes cannot yield one.

## Scoring

Per SCA Standard 104-2024:

```
Score = 0.65625 × Σ(8 affective sections, each 1–9) + 52.75
        − 2 × non-uniform cups − 4 × defective cups     (nearest 0.25)
```

Asserted on load in the browser console: all 9s = 100.00, all 1s = 58.00.

## Files

| File | Role |
|---|---|
| `index.html` | Markup and screens |
| `styles.css` | All styling; light/dark via `prefers-color-scheme` |
| `store.js` | IndexedDB — the only module that touches the database |
| `export.js` | Markdown generation and delivery |
| `app.js` | State, render cycle, screens |
| `sw.js` | Service worker (offline shell) |

## Architecture notes

- **All state changes go through `mutate()`** in `app.js`, which redraws and
  autosaves. Never mutate `state` directly — that reintroduces the stale-view
  bug class where a view and its gate disagreed.
- `render()` is a full redraw; `renderDerived()` skips input surfaces so
  sliders and text fields survive continuous interaction.
- Incomplete work is never presented as complete: unscored samples show `—`,
  fails without a cause block export, and unknown rest counts as under-rested.

## Local development

```bash
python -m http.server 8000
```

Then open <http://localhost:8000>. Service workers require HTTPS or
localhost — opening `index.html` from the file system works, but without
offline install.

## Deploy

Push to GitHub and enable Pages on the default branch, root folder.
**Bump `CACHE` in `sw.js`** when shipping changes or clients keep the old copy.
