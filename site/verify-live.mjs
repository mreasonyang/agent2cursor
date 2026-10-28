import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, readdir, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const run = promisify(execFile);
const root = fileURLToPath(new URL('./', import.meta.url));
const base = new URL(process.argv[2] || 'https://agent2cursor.kyun.si');
if (base.protocol !== 'https:' || base.username || base.password) throw new Error('Use a public HTTPS origin without credentials');
const common = ['--silent', '--compressed', '--max-time', '25'];
async function request(path) {
  try {
    const { stdout } = await run('curl', [...common, '--location', '--write-out', '\n%{http_code}', new URL(path, base).href], { encoding: 'buffer', maxBuffer: 4 * 1024 * 1024 });
    const split = stdout.lastIndexOf(10);
    return { body: stdout.subarray(0, split), status: Number(stdout.subarray(split + 1).toString()) };
  } catch {
    return { body: Buffer.alloc(0), status: 0 };
  }
}
const names = ['index.html', 'en/index.html', 'zh/index.html', 'robots.txt', 'sitemap.xml', 'favicon.svg', ...(await readdir(`${root}dist/assets`)).map(name => `assets/${name}`)];
const files = [];
for (let i = 0; i < names.length; i += 4) {
  files.push(...await Promise.all(names.slice(i, i + 4).map(async path => {
    const { body, status } = await request(`/${path.replace('index.html', '')}`);
    const expected = await readFile(`${root}dist/${path}`);
    return { path, status, matches: body.equals(expected), sha256: createHash('sha256').update(body).digest('hex') };
  })));
}
const notFound = await Promise.all(['/_website-check-missing', '/assets/_website-check-missing.js'].map(async path => ({ path, status: (await request(path)).status })));
const { stdout: headerText } = await run('curl', [...common, '--head', new URL('/en/', base).href]);
const headerNames = ['cache-control', 'content-security-policy', 'x-content-type-options', 'x-frame-options', 'referrer-policy', 'permissions-policy'];
const headers = Object.fromEntries(headerText.split(/\r?\n/).map(line => {
  const index = line.indexOf(':'); return [line.slice(0, index).toLowerCase(), line.slice(index + 1).trim()];
}).filter(([key]) => headerNames.includes(key)));
const insecure = new URL('/en/', base); insecure.protocol = 'http:';
const { stdout: redirect } = await run('curl', [...common, '--output', '/dev/null', '--write-out', '%{http_code} %{redirect_url}', insecure.href]);
const { stdout: commit } = await run('git', ['rev-parse', 'HEAD'], { cwd: root });
const passed = files.every(file => file.status === 200 && file.matches) && notFound.every(file => file.status === 404) && headers['cache-control']?.includes('no-transform') && headers['content-security-policy']?.includes("script-src 'self'") && /^30[1278] https:/.test(redirect);
const report = { checkedAt: new Date().toISOString(), origin: base.origin, commit: commit.trim(), passed, files, notFound, headers, httpRedirect: redirect.trim() };
await mkdir(`${root}evidence`, { recursive: true });
await writeFile(`${root}evidence/live-files.json`, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ passed, matchedFiles: files.filter(file => file.matches).length, totalFiles: files.length, notFound, headers, httpRedirect: redirect.trim() }, null, 2));
if (!passed) process.exitCode = 1;
