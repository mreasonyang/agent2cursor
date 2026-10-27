# cc2agent README animation source

14-second, silent terminal demonstration from an actual local fixture conversion. `SOURCE.json` records commands, field outcomes and hashes. Paths and source excerpts are shortened for readability; animation timing is illustrative. Only structural SDK validation is claimed.

Built with HyperFrames 0.8.207, GSAP and Brave. The terminal mechanism follows the installed HyperFrames `code-terminal-run` primitive; the content and report layout are authored here. The current HyperFrames skill absorbed the earlier general-video workflow.

Prerequisites: Node/npm, Brave Browser, and `ffmpeg` on PATH. The helper invokes pinned HyperFrames through `npx`; set `HYPERFRAMES_BROWSER_PATH` when Brave is installed elsewhere. It renders MP4 first, then converts to a 960×540, 10 fps, 128-color GIF to avoid a direct GIF export defect and keep the README asset small.

```bash
npm run check
npm run render
```

The helper uses the installed Brave executable and disables HyperFrames orphan cleanup to avoid process-argument inspection. It prints bounded validation metadata. Rendering is local and uses no model, paid generation or publishing service. A first compile may fetch the declared fonts.

Final output is `../assets/cc2agent-demo.gif`; `cc2agent-demo-poster.png` is a decoded final frame. Work files and renderer caches stay in ignored `.hyperframes/`.

Studio can edit the composition. This task opened its preview in Brave; a running preview is not required for the committed GIF. No remote service was deployed. The HyperFrames desktop app adds conversational editing with Framey; the editable HTML also works without it.
