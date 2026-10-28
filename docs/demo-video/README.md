# agent2cursor README animation source

The website's bilingual 30-second introduction is maintained separately in [explainer/](explainer/README.md).

14-second, silent terminal demonstration from an actual local fixture conversion. `SOURCE.json` records commands, field outcomes and hashes. Paths and source excerpts are shortened for readability; animation timing is illustrative. Only structural SDK validation is claimed.

Built with HyperFrames 0.8.207, GSAP and Brave. `index.html` mounts `compositions/demo.html`; these are the maintained animation sources. The terminal mechanism follows the HyperFrames `code-terminal-run` primitive, with project-specific content and report layout.

Prerequisites: Node/npm, Brave Browser, and `ffmpeg` on PATH. The helper invokes pinned HyperFrames through `npx`; set `HYPERFRAMES_BROWSER_PATH` when Brave is installed elsewhere. It renders MP4 first, then converts to a 960×540, 10 fps, 128-color GIF to avoid a direct GIF export defect and keep the README asset small.

```bash
npm run check
npm run render
```

The helper uses the installed Brave executable and disables HyperFrames orphan cleanup to avoid process-argument inspection. It prints bounded validation metadata. Rendering is local and uses no model, paid generation or publishing service. A first compile may fetch the declared fonts.

Final output is `../assets/agent2cursor-demo.gif`; `agent2cursor-demo-poster.png` is a decoded final frame. Work files and renderer caches stay in ignored `.hyperframes/`.

The HTML remains editable in the HyperFrames desktop app or a text editor. A running preview is not required for the committed GIF. `SOURCE.json` retains the delivered asset's checksum and conversion provenance.
