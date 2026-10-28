import { spawn } from 'node:child_process';
import { mkdir, stat, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const base = fileURLToPath(new URL('.', import.meta.url));
const [action = 'check', locale = 'zh'] = process.argv.slice(2);
if (!['check', 'snapshot', 'render', 'preview', 'stop'].includes(action) || !['en', 'zh'].includes(locale)) {
  throw new Error('Use check|snapshot|render|preview|stop en|zh');
}
const cwd = resolve(base, locale);
const output = resolve(base, '../../../site/media', `agent2cursor-intro-${locale}.mp4`);
const browser = '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser';
const env = { ...process.env, HYPERFRAMES_BROWSER_PATH: browser, HYPERFRAMES_NO_ORPHAN_CLEANUP: '1' };
const commands = {
  check: ['check', '--json', '--snapshots', '--at', '0,2,5.5,8.5,12,15,18,21.5,24.5,28'],
  snapshot: ['snapshot', '--review', '--json'],
  render: ['render', '--format', 'mp4', '--fps', '30', '--workers', '1', '--output', output],
  preview: ['preview', '--foreground', '--json', '--port', locale === 'zh' ? '18774' : '18775', '--browser-path', browser],
  stop: ['preview', '--stop', '--port', locale === 'zh' ? '18774' : '18775'],
};
await mkdir(resolve(cwd, '.hyperframes'), { recursive: true });
const child = spawn('npx', ['--yes', 'hyperframes@0.8.207', ...commands[action]], { cwd, env, stdio: ['ignore', 'pipe', 'pipe'] });
let stdout = '';
child.stdout.on('data', chunk => {
  stdout += chunk;
  if (action === 'preview') {
    const url = chunk.toString().match(/http:\/\/(?:localhost|127\.0\.0\.1):\d+[^\s"\u001b]*/);
    if (url) console.log(JSON.stringify({ preview: url[0] }));
  }
});
child.stderr.on('data', () => {});
child.on('error', error => console.log(JSON.stringify({ ok: false, action, locale, error: error.code || 'start-failed' })));
process.on('SIGINT', () => child.kill('SIGINT'));
process.on('SIGTERM', () => child.kill('SIGTERM'));
child.on('close', async code => {
  let report;
  for (let i = stdout.indexOf('{'); i >= 0; i = stdout.indexOf('{', i + 1)) {
    try { report = JSON.parse(stdout.slice(i)); break; } catch {}
  }
  if (action === 'check' && report) {
    const findings = Object.entries(report).flatMap(([area, value]) => value && Array.isArray(value.findings)
      ? value.findings.map(f => ({ area, code: f.code, severity: f.severity, selector: f.selector, message: f.message, time: f.time })) : []);
    const result = { ok: report.ok, browserSkipped: report.browserSkipped, locale, findings, snapshots: report.snapshots, contrast: report.contrast?.checked };
    await writeFile(resolve(cwd, '.hyperframes/checked.json'), JSON.stringify(result, null, 2));
    console.log(JSON.stringify(result));
    process.exitCode = code === 0 && report.ok ? 0 : 1;
  } else if (action === 'snapshot' && report) {
    await writeFile(resolve(cwd, '.hyperframes/review-paths.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify({ ok: report.ok, locale, outputDir: report.outputDir, contactSheets: report.contactSheets, review: report.review?.sheets }));
    process.exitCode = code;
  } else {
    const exists = action === 'render' && code === 0 ? await stat(output) : null;
    console.log(JSON.stringify({ ok: code === 0, action, locale, exitCode: code, output: exists ? output : undefined, bytes: exists?.size, catchUpRequired: /run[^\n]*catch-up/i.test(stdout) }));
    process.exitCode = code;
  }
});
