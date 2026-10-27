# Artifact review

Reviewed 2026-10-27; branding re-rendered and inspected after the rename to `cc-to-cursor-agent`. This animation presents one actual local fixture conversion; its pacing is authored and does not measure conversion performance.

- HyperFrames 0.8.207 structural/motion/contrast check: zero errors, zero warnings; 108 contrast checks. The informational no-audio finding is intentional for a README GIF.
- Inspected source/output/report snapshots and the final GIF decoded at 11 seconds. All four input frontmatter fields are visible in the report, and both evidence-boundary footer captions remain intact.
- Export: 14 seconds, 960×540 pixels, 10 fps, 140 frames, 360,551 bytes (352 KiB). The final reproducible helper was exercised, and its GIF decoded for the visual inspection.
- During initial production, direct HyperFrames GIF export produced a corrupted lower region despite a successful exit code. The delivered artifact instead uses the visually verified MP4 render, then FFmpeg palette conversion. `run.mjs render` reproduces this route.
- No live model execution, credential access, GitHub write, deployment or publication is represented. The `validate` result is the separate structural check recorded in `SOURCE.json`.

The renderer uses Brave and sets `HYPERFRAMES_NO_ORPHAN_CLEANUP=1` to avoid the CLI's process-argument collector. Raw renderer diagnostics are not printed or committed.
