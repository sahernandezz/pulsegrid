# PulseGrid · frontend (showcase)

The vitrine. **Reads `consolidated-results.json` and nothing else** — no backend, no live
Prometheus, no k6. Deployable as a static site.

**Stack:** React + Vite + Tailwind CSS + Recharts + Framer Motion.
**Aesthetic:** dark "observability instrument" — blueprint grid, grain, a pulse/EKG motif,
Bricolage Grotesque display + IBM Plex Mono for all measured numbers.

## Views
- **Variant matrix** — every variant × the core indicators, best-per-column highlighted,
  paradigm/packaging badges, and proper "not supported" handling (muted row + reason).
- **Filters** — by ingest mode (http/queue), stack, paradigm, packaging.
- **At a glance** — throughput, cold start (log), idle RSS, latency distribution (Recharts).
- **Per-variant detail** — click any row: full metrics, the individual runs, and a link to
  that variant's source on GitHub (the evidence).
- **Environment** — the exact, identical conditions every variant ran under.

## Data
`consolidated-results.json` lives at the repo root (produced by the runner). The
`sync-data` script copies it into `public/` and runs automatically before `dev`/`build`.
Set the GitHub repo URL in `src/lib/data.js` (`REPO_URL`) so the code links resolve.

When `sample: true`, a prominent banner marks the data as illustrative.

## Run
```bash
npm install
npm run dev        # http://localhost:5173  (syncs data first)
npm run build      # static site in dist/
npm run preview
```
