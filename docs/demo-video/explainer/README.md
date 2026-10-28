# Website explainer

The website uses these 30-second Chinese and English explainers. They follow one code-review Agent from an existing Claude Code / Codex setup into an editable Cursor Agent SDK project, show preserved instructions and migration limits, then point to GitHub.

`compose.mjs` owns the copy, layout and deterministic GSAP timelines. It generates the editable `en/` and `zh/` HyperFrames projects. The design uses large text for phone viewing and intentionally carries the full explanation without sound, so it remains understandable with website playback muted.

From the repository root, with Node, Brave and FFmpeg installed:

```bash
node docs/demo-video/explainer/compose.mjs
node docs/demo-video/explainer/run.mjs check zh
node docs/demo-video/explainer/run.mjs check en
node docs/demo-video/explainer/run.mjs snapshot zh
node docs/demo-video/explainer/run.mjs snapshot en
node docs/demo-video/explainer/run.mjs preview zh
# After reviewing the preview and phone/transition snapshots:
node docs/demo-video/explainer/run.mjs render zh
node docs/demo-video/explainer/run.mjs render en
node docs/demo-video/explainer/run.mjs stop zh
```

The helper pins HyperFrames 0.8.207, uses Brave, disables process-argument-based orphan cleanup, and emits bounded diagnostics. English preview uses port 18775; Chinese uses 18774. Rendering writes `site/media/agent2cursor-intro-{locale}.mp4`. Decode a poster at 2.5 seconds into the matching `.jpg` path. `site/build.mjs` fingerprints both assets for cache-safe deployment.

The two instruction excerpts come from `fixtures/claude/agents/code-reviewer.md`. The displayed file tree and report rows are shortened illustrations, backed by a fresh local conversion. They do not claim that a model was run or that source tool permissions carry over. `SOURCE.json` binds the delivered media to its source and conversion evidence. Validation snapshots and renderer work files stay under ignored `.hyperframes/` directories.

The original 14-second terminal animation, GIF and provenance remain in the parent directory for the technical README demonstration.
