# article-kit/ — generated evidence pack

This directory is **generated** by `benchmark/analyze.py`; do not edit by hand. Run:

```bash
cd benchmark && python analyze.py        # reads ../consolidated-results.json
```

It produces:

| File | What it is |
|------|------------|
| `findings.md` | Structured natural-language findings: context, per-indicator winners, native-vs-JVM ratios, http-vs-queue deltas, a numbers table, and the chart list. The narrative source for the article. |
| `data-summary.json` | Compact, clean version of the data (median values only), ready to paste into an AI prompt. |
| `captions.md` | What each chart shows, so the AI can reference them by name. |
| `environment.md` | The environment block formatted for the methodology section. |
| `prompt-template.md` | A pre-filled prompt the author pastes into any AI to generate the article draft. |
| `images/` | Copies of the charts from `benchmark/plots/output/`. |

`analyze.py` **never** writes the article and **never** calls an API — it only produces
the material. The author feeds it to the AI of their choice. No secrets, no credentials.
