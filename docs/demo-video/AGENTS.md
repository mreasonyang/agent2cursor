# README animation maintenance

The editable animation is `index.html` plus `compositions/demo.html`. `run.mjs` uses pinned HyperFrames 0.8.207 and FFmpeg to produce the GIF and poster in `../assets/`. `SOURCE.json` records their provenance.

- Read the HyperFrames skill before changing animation behavior.
- Keep the composition deterministic and seekable; preserve the declared duration, timeline registration and data attributes.
- Use Brave or the built-in browser. Keep the helper’s orphan-cleanup protection enabled and do not inspect process launch arguments or print raw renderer diagnostics.
- `npm run check` validates animation changes; `npm run render` renders locally. Follow the user’s explicit instructions when reusing existing validation instead of rerunning it.
- Preserve the final GIF, poster and provenance. Renderer caches remain ignored. Do not regenerate planning briefs or production diaries as part of routine maintenance.
