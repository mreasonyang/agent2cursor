# agent2cursor website

The bilingual static website lives at https://agent2cursor.kyun.si. English and Chinese have separate rendered pages at `/en/` and `/zh/`; `/` chooses the saved language or browser language. All essential content is present without JavaScript. Language links, FAQ disclosures and GitHub links work without JavaScript. Interactive examples only update displayed commands; they never execute a conversion in the browser.

```sh
node site/build.mjs
node site/check.mjs
python3 -m http.server 18773 --bind 127.0.0.1 --directory site/dist
```

After deployment, run `node site/verify-live.mjs`. It compares all public assets with the local build, checks real 404s, HTTPS redirection and response headers, and writes a metadata-only receipt under ignored `site/evidence/`. It requires `curl` and keeps certificate verification enabled. `Cache-Control: no-transform` prevents Cloudflare email obfuscation from mistaking the copyable npm `package@version` for an email address.

Edit translations in `content.mjs`, structure in `build.mjs`, presentation in `style.css`, and progressive interactions in `client.js`. Update `release.json` only after verifying that version is publicly available on npm; repository release preparation must not publish unavailable installation commands. The build uses Node built-ins only. CSS, JavaScript and explainer media filenames include content hashes. The 30-second explainer uses a native video player, loads after an explicit click, and pauses when its disclosure closes. Each locale selects its matching video and poster; editable sources and provenance live in `../docs/demo-video/explainer/`.

Cloudflare Pages uses the GitHub repository `mreasonyang/agent2cursor`, production branch `main`, build command `node site/build.mjs && node site/check.mjs`, and output directory `site/dist`. Use Node 22.13 or newer. Bind the custom domain `agent2cursor.kyun.si` in Pages before pointing its CNAME to the project's `pages.dev` hostname. Website hosting is separate from deploying a generated Cursor agent.

No analytics, cookies, third-party fonts, or external browser scripts. A local language preference is the only stored browser state. GitHub links open the public repository; users choose whether to star it themselves.

The original 14-second silent H.264 demo is also kept in `media/agent2cursor-demo.mp4` and served at `/assets/agent2cursor-demo.mp4` for direct playback on phones. Its animation source and conversion provenance remain in `../docs/demo-video/`.
