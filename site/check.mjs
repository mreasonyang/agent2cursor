import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { locales } from './content.mjs';
const root = fileURLToPath(new URL('./dist/', import.meta.url));
const repo = 'https://github.com/mreasonyang/agent2cursor';
for (const key of ['en', 'zh']) {
  const html = await readFile(`${root}${key}/index.html`, 'utf8');
  assert(html.includes(`lang="${locales[key].lang}"`));
  assert(html.includes(`rel="canonical" href="https://agent2cursor.kyun.si/${key}/"`));
  assert.equal((html.match(/<h1>/g) || []).length, 1);
  assert.equal((html.match(/data-github/g) || []).length, 5, 'GitHub must be prominent in navigation, hero, closing and footer');
  assert(html.includes('hreflang="zh-CN"') && html.includes('hreflang="en"'));
  assert(html.includes(`--lang ${key}`));
  assert(html.includes(locales[key].reportFile));
  assert(!/undefined|\[object Object\]/.test(html));
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
  assert.equal(ids.length, new Set(ids).size, 'IDs must be unique');
  for (const [, id] of html.matchAll(/href="#([^"]+)"/g)) assert(ids.includes(id), `Missing anchor: ${id}`);
  for (const [, url] of html.matchAll(/(?:src|href)="(\/[^"#?]*)"/g)) {
    const path = url.endsWith('/') ? `${url}index.html` : url;
    await readFile(`${root}${path.slice(1)}`);
  }
  for (const [, tag] of html.matchAll(/(<a\b[^>]*target="_blank"[^>]*>)/g)) assert(tag.includes('rel="noopener noreferrer"'));
  assert(html.includes(`href="${repo}"`));
}
assert.deepEqual(Object.keys(locales.en).sort(), Object.keys(locales.zh).sort(), 'Translations must have matching keys');
assert.equal(locales.en.faqs.length, locales.zh.faqs.length);
assert.equal(locales.en.features.length, locales.zh.features.length);
assert((await readFile(`${root}index.html`, 'utf8')).includes('data-entry="true"'));
assert((await readFile(`${root}404.html`, 'utf8')).includes('noindex'));
assert((await readFile(`${root}_headers`, 'utf8')).includes("script-src 'self'"));
assert((await readdir(`${root}assets`)).some(name=>/^client\.[a-f0-9]{10}\.js$/.test(name)));
console.log('PASS: locale parity, SEO, local assets, anchors, GitHub entry points, command language, 404 and headers');
