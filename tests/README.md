# Browser tests

End-to-end tests for `index.html`, driven through [puppeteer-core](https://pptr.dev) against a real Chrome. The page is opened straight from disk (`file://`), so there is no server to start.

## Run them

```sh
cd tests
npm install
npm test                    # every suite, one summary line each
node run-all.mjs frame      # only suites whose file name contains "frame"
node fretboard.test.mjs     # one suite, with every check listed
```

Needs Node 20+ and Chrome. The runner looks in the usual places; if yours is elsewhere, set `CHROME_PATH` to its executable. The full run takes several minutes.

## What is covered

| Suite | Covers |
|---|---|
| `circle.test.mjs` | Circle of fifths: chord picking, ring readout, note colours, layout at three widths |
| `themes.test.mjs` | Theme switching and fallback for old ids, fonts (no OS fallback), palette on the fretboard |
| `fretboard.test.mjs` | Autosave, undo/redo, duplicate, saved versions, share links, file import/export, hostile input |
| `fretboard-controls.test.mjs` | Live patterns, Add mode, tuning keeping pitches, the click tools, Invert, Move pattern, collapse in place |
| `fretboard-frame-zoom.test.mjs` | Frame (drag, slide, resize), zoom and pan, fit-to-width, highlight, crop on export |
| `print-export.test.mjs` | Print pages and PDF (page count and size), PNG and SVG export, legend, auto-title |
| `clear-png.test.mjs` | Clear and solid PNG backgrounds, read from real alpha values |
| `clear-svg.test.mjs` | The same for SVG, and that printed pages stay solid |

## Notes

- **A crash is a failure.** `run-all.mjs` only counts a suite as passing if it printed an `N/N passed` line with no `FAIL` lines. A suite that dies part-way has no summary and is reported as failed.
- **Autosave takes about 400 ms.** A test that reads saved data right after an action has to wait longer than that, or it races the save.
- **Adding a suite:** create `something.test.mjs` that prints `PASS ...` / `FAIL ...` lines and ends with `N/N passed`. Use `INDEX`, `launch` and `scratch` from `lib.mjs`; downloads go to a temp folder, never the repo.
