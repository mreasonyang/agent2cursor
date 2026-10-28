import { mkdir, readFile, writeFile, copyFile, rm } from "node:fs/promises";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { locales } from "./content.mjs";

const root = fileURLToPath(new URL(".", import.meta.url));
const out = `${root}dist`;
const origin = "https://agent2cursor.kyun.si";
const repo = "https://github.com/mreasonyang/agent2cursor";
const pkg = JSON.parse(await readFile(`${root}release.json`, "utf8"));
const escape = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const icon = (name) =>
  `<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round">${
    {
      star: '<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9Z"/>',
      arrow: '<path d="M5 12h14m-5-5 5 5-5 5"/>',
      external: '<path d="M7 17 17 7M7 7h10v10"/>',
      copy: '<rect x="8" y="8" width="12" height="13" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/>',
      github:
        '<path fill="currentColor" stroke="none" d="M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48v-1.86c-2.78.6-3.37-1.18-3.37-1.18-.45-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.61.07-.61 1 .07 1.53 1.03 1.53 1.03.89 1.53 2.34 1.09 2.91.83.09-.65.35-1.09.64-1.34-2.22-.25-4.55-1.11-4.55-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.65 0 0 .84-.27 2.75 1.03A9.6 9.6 0 0 1 12 6.83c.85 0 1.71.12 2.51.34 1.91-1.3 2.75-1.03 2.75-1.03.55 1.38.2 2.4.1 2.65.64.7 1.03 1.59 1.03 2.68 0 3.84-2.33 4.69-4.56 4.94.36.31.68.92.68 1.85v2.75c0 .27.18.58.69.48A10 10 0 0 0 12 2Z"/>',
    }[name]
  }</svg>`;
const mark =
  '<span class="brand-mark" aria-hidden="true"><span>›</span><span>_</span></span>';
await rm(out, { recursive: true, force: true });
await mkdir(`${out}/assets`, { recursive: true });
const assets = {};
for (const name of ["style.css", "client.js"]) {
  const data = await readFile(`${root}${name}`);
  const hashed = name.replace(
    ".",
    `.${createHash("sha256").update(data).digest("hex").slice(0, 10)}.`,
  );
  await writeFile(`${out}/assets/${hashed}`, data);
  assets[name] = `/assets/${hashed}`;
}
for (const name of ["agent2cursor-demo.gif", "agent2cursor-demo-poster.png"]) {
  await copyFile(`${root}../docs/assets/${name}`, `${out}/assets/${name}`);
}
const favicon = await readFile(`${root}favicon.svg`);
await writeFile(`${out}/favicon.svg`, favicon);
assets["favicon.svg"] = `/favicon.svg?v=${createHash("sha256").update(favicon).digest("hex").slice(0, 10)}`;
const external = (url, label, classes = "", extra = "") =>
  `<a class="${classes}" href="${url}" target="_blank" rel="noopener noreferrer" ${extra}>${label}</a>`;

function page(key, entry = false) {
  const t = locales[key];
  const doc = `${repo}/blob/main/${key === "zh" ? "README.zh-CN.md" : "README.md"}`;
  const install = `npm install --global @kyun.si/agent2cursor@${pkg.version}`;
  const commands = [
    `agent2cursor inspect .claude/agents --lang ${key}`,
    `agent2cursor convert .claude/agents --out ./my-agent --lang ${key}`,
    "cd my-agent\nnpm install\nnpm run validate\nnpx agent-sdk eval --dir . --list",
  ];
  const copyButton = (id) =>
    `<button class="copy" type="button" data-copy="${id}" aria-label="${t.copy}: ${id}">${icon("copy")}<span>${t.copy}</span></button>`;
  const star = (classes = "") =>
    external(
      repo,
      `${icon("star")}<span>${t.star}</span>${icon("external")}`,
      `button star-link ${classes}`,
      "data-github",
    );
  return `<!doctype html>
<html lang="${t.lang}" data-locale="${key}"${entry ? ' data-entry="true"' : ""}>
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="theme-color" content="#fafafa">
<title>${t.title}</title><meta name="description" content="${escape(t.description)}">
<link rel="canonical" href="${origin}/${key}/"><link rel="alternate" hreflang="en" href="${origin}/en/"><link rel="alternate" hreflang="zh-CN" href="${origin}/zh/"><link rel="alternate" hreflang="x-default" href="${origin}/">
<meta property="og:type" content="website"><meta property="og:site_name" content="agent2cursor"><meta property="og:locale" content="${t.locale}"><meta property="og:title" content="${t.title}"><meta property="og:description" content="${escape(t.description)}"><meta property="og:url" content="${origin}/${key}/"><meta property="og:image" content="${origin}/assets/agent2cursor-demo-poster.png"><meta property="og:image:width" content="960"><meta property="og:image:height" content="540"><meta property="og:image:alt" content="${t.diagram}">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${t.title}"><meta name="twitter:description" content="${escape(t.description)}"><meta name="twitter:image" content="${origin}/assets/agent2cursor-demo-poster.png"><meta name="twitter:image:alt" content="${t.diagram}">
<link rel="icon" href="${assets["favicon.svg"]}" type="image/svg+xml"><link rel="stylesheet" href="${assets["style.css"]}"><script src="${assets["client.js"]}" defer></script>
</head>
<body data-copy-label="${t.copy}" data-copied-label="${t.copied}" data-copy-failed="${t.copyFailed}">
<a class="skip" href="#main">${t.skip}</a>
<header class="header"><div class="nav wrap"><a class="brand" href="/${key}/" aria-label="agent2cursor">${mark}<span>agent<span class="brand-two">2</span>cursor</span></a>
<nav class="section-nav" aria-label="${t.nav.join(" / ")}"><a href="#how">${t.nav[0]}</a><a href="#start">${t.nav[1]}</a><a href="#faq">${t.nav[2]}</a></nav>
<div class="nav-actions"><nav class="languages" aria-label="${t.language}"><a href="/en/" lang="en" data-language="en"${key === "en" ? ' aria-current="page"' : ""}>EN</a><span aria-hidden="true">/</span><a href="/zh/" lang="zh-CN" data-language="zh"${key === "zh" ? ' aria-current="page"' : ""}>中文</a></nav>${star("nav-star")}</div></div></header>
<main id="main">
<section class="hero wrap"><div class="hero-copy"><p class="eyebrow"><span class="live-dot"></span>${t.eyebrow}</p><h1>${t.headline[0]}<br><em>${t.headline[1]}</em></h1><p class="hero-intro">${t.intro}</p><div class="hero-actions"><a class="button primary" href="#start">${t.start}${icon("arrow")}</a>${star("hero-star")}</div><p class="repo-hint">${icon("github")}${t.repoHint}</p>
<div class="install"><div class="install-label"><span>${t.install}</span><span>v${pkg.version}</span></div><div class="install-command"><code id="install">${install}</code>${copyButton("install")}</div></div><ul class="facts">${t.facts.map((f) => `<li>${f}</li>`).join("")}</ul></div>
<div class="hero-visual" role="img" aria-label="${t.diagram}"><div class="visual-top"><span class="mono">${t.input}</span><span class="tiny-symbol">↘</span></div><div class="source-row"><div class="source-item"><span class="source-logo claude">✳</span><div><b>Claude Code</b><code>.md</code></div></div><div class="source-item"><span class="source-logo codex">⌘</span><div><b>Codex</b><code>.toml</code></div></div><div class="source-item"><span class="source-logo skills">⊞</span><div><b>Skills</b><code>SKILL.md</code></div></div></div>
<div class="route-lines"><i></i><i></i><i></i></div><div class="converter">${mark}<strong>agent2cursor</strong><span>↓</span></div><div class="output-project"><div class="project-header"><span class="folder-icon">⌑</span><div><strong>my-agent/</strong><span>${t.editable}</span></div><span class="type-badge">TS</span></div><div class="project-files"><code><span>├─</span> bot/agent.ts</code><code><span>├─</span> bot/subagents/</code><code><span>├─</span> bot/skills/</code><code><span>└─</span> evals/</code></div></div>
<div class="report-card"><div class="report-heading"><span class="report-icon">≡</span><strong>${t.reportTitle}</strong><span class="report-check">✓</span></div><div class="report-line"><code>instructions</code><span class="status mapped">${t.mapped}</span></div><div class="report-line"><code>model</code><span class="status review">${t.inherit}</span></div><div class="report-line"><code>tools</code><span class="status review">${t.tools}</span></div><div class="report-bottom">${t.report}<span>↗</span></div></div><p class="visual-caption mono">${t.illustration}</p></div></section>
<div class="compatibility"><div class="wrap"><span class="mono">${t.strip}</span><div><b>Claude Code</b><span>+</span><b>Codex</b><span>+</span><b>Agent Skills</b><span>→</span><b class="strip-output">Cursor Agent SDK</b></div></div></div>
<section class="section wrap" id="how"><div class="section-heading"><p class="eyebrow">${t.howKicker}</p><h2>${t.howTitle}</h2><p>${t.howIntro}</p></div><div class="how-grid"><div class="feature-list">${t.features.map((f) => `<article class="feature"><span class="feature-number mono">${f[0]}</span><div><h3>${f[1]}</h3><p>${f[2]}</p></div></article>`).join("")}</div><div class="code-window"><div class="window-bar"><span class="window-dots" aria-hidden="true">● ● ●</span><span>${t.sample}</span></div><pre><code><span class="code-muted">my-agent/</span>
<span class="code-muted">├─</span> <span class="code-accent">bot/</span>
<span class="code-muted">│  ├─</span> agent.ts
<span class="code-muted">│  ├─</span> instructions.md
<span class="code-muted">│  ├─</span> <span class="code-accent">subagents/</span>
<span class="code-muted">│  │  └─</span> code-reviewer/
<span class="code-muted">│  │     ├─</span> agent.ts
<span class="code-muted">│  │     └─</span> instructions.md
<span class="code-muted">│  ├─</span> skills/
<span class="code-muted">│  └─</span> tools/
<span class="code-muted">├─</span> evals/
<span class="code-muted">├─</span> <span class="code-yellow">${t.reportFile}</span>
<span class="code-muted">└─</span> package.json</code></pre><div class="code-note">${t.sampleNote}</div></div></div>
<details class="demo"><summary>${t.demoTitle}<span aria-hidden="true">↗</span></summary><div class="demo-content"><img src="/assets/agent2cursor-demo-poster.png" width="960" height="540" loading="lazy" alt="${t.diagram}" id="demo-image"><div class="demo-bottom"><p>${t.demoCaption}</p><button type="button" class="button demo-play" data-play="${t.play}" data-pause="${t.pause}" aria-pressed="false">${t.play}</button></div></div></details></section>
<section class="quick-section" id="start"><div class="wrap"><div class="section-heading"><p class="eyebrow">${t.quickKicker}</p><h2>${t.quickTitle}</h2><p>${t.quickIntro}</p></div><div class="input-tabs" role="tablist" aria-label="${t.tabsLabel}">${t.tabs.map((tab, i) => `<button type="button" role="tab" id="tab-${i}" data-input="${["claude", "codex", "skills"][i]}" aria-controls="commands" aria-selected="${i === 0}" tabindex="${i === 0 ? "0" : "-1"}">${tab}</button>`).join("")}</div><div class="steps" role="tabpanel" id="commands" aria-labelledby="tab-0">${t.steps.map((step, i) => `<article class="step"><div class="step-description"><span class="step-number mono">0${i + 1}</span><div><h3>${step}</h3><p>${t.stepNotes[i]}</p></div></div><div class="command-block"><div class="command-toolbar"><span class="mono">${i === 2 ? "my-agent/" : "terminal"}</span>${copyButton(`command-${i}`)}</div><pre><code id="command-${i}">${escape(commands[i])}</code></pre></div></article>`).join("")}</div><div class="guide-link"><p>${t.modelNote}</p>${external(doc, `${t.docs}${icon("external")}`, "text-link")}</div><aside class="boundary"><span aria-hidden="true">↳</span><div><h3>${t.boundaryTitle}</h3><p>${t.boundaryBody}</p>${external(`${doc}#${key === "zh" ? "核心限制与验收状态" : "limitations-and-verification-status"}`, t.boundaryLink, "text-link")}</div></aside></div></section>
<section class="section wrap faq-section" id="faq"><div class="section-heading"><p class="eyebrow">${t.faqKicker}</p><h2>${t.faqTitle}</h2></div><div class="faq-list">${t.faqs.map((f) => `<details><summary>${f[0]}<span aria-hidden="true">+</span></summary><p>${f[1]}</p></details>`).join("")}</div></section>
<section class="closing wrap"><div class="closing-star" aria-hidden="true">${icon("star")}</div><div><p class="eyebrow">${t.closingKicker}</p><h2>${t.closingTitle}</h2><p>${t.closingBody}</p><div class="closing-actions">${star("closing-button")}${external(repo, `${t.closingSecondary}${icon("arrow")}`, "text-link", "data-github")}</div></div></section>
</main><footer class="wrap footer"><a href="/${key}/" class="brand">${mark}<span>agent<span class="brand-two">2</span>cursor</span></a><div><p>${t.footer} ${external("https://kyun.si", "Eason Yang")}</p><p class="disclaimer">${t.footerDisclaimer}</p></div><nav aria-label="${t.footerLicense} / GitHub / npm">${external(`${repo}/blob/main/LICENSE`, t.footerLicense)}${external("https://www.npmjs.com/package/@kyun.si/agent2cursor", t.footerNpm)}${external(repo, `${icon("github")}GitHub`, "", "data-github")}</nav></footer><div class="toast" role="status" aria-live="polite"></div>
</body></html>`;
}
for (const key of Object.keys(locales)) {
  await mkdir(`${out}/${key}`, { recursive: true });
  await writeFile(`${out}/${key}/index.html`, page(key));
}
await writeFile(`${out}/index.html`, page("en", true));
await writeFile(
  `${out}/404.html`,
  `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>404 · agent2cursor</title><link rel="stylesheet" href="${assets["style.css"]}"><main class="wrap section"><p class="eyebrow">404 / agent2cursor</p><h1>Page not found<br><em>页面不存在</em></h1><p><a class="button primary" href="/en/">English homepage →</a> <a class="button" href="/zh/">返回中文首页 →</a></p></main></html>`,
);
await writeFile(
  `${out}/robots.txt`,
  `User-agent: *\nAllow: /\nSitemap: ${origin}/sitemap.xml\n`,
);
await writeFile(
  `${out}/sitemap.xml`,
  `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">${Object.keys(
    locales,
  )
    .map(
      (key) =>
        `<url><loc>${origin}/${key}/</loc><xhtml:link rel="alternate" hreflang="en" href="${origin}/en/"/><xhtml:link rel="alternate" hreflang="zh-CN" href="${origin}/zh/"/><xhtml:link rel="alternate" hreflang="x-default" href="${origin}/"/></url>`,
    )
    .join("")}</urlset>`,
);
await writeFile(`${out}/_redirects`, "/en /en/ 301\n/zh /zh/ 301\n");
// Keep npm's package@version syntax intact: it can look like an email to edge transforms.
await writeFile(
  `${out}/_headers`,
  `/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n  X-Frame-Options: DENY\n  Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'\n  Permissions-Policy: camera=(), microphone=(), geolocation=()\n  Cache-Control: public, max-age=0, must-revalidate, no-transform\n/assets/*\n  Cache-Control: public, max-age=86400, no-transform\n`,
);
console.log(
  "Built bilingual site: site/dist (en, zh, language entry, 404, SEO and static assets)",
);
