import { spawn } from 'node:child_process';
import { mkdir, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const cwd = dirname(fileURLToPath(import.meta.url));
const action = process.argv[2] ?? 'check';
if (!['check', 'render'].includes(action)) throw new Error('Use check or render');
const cli = process.argv[3] ?? 'npx';
const args = cli === 'npx' ? ['--yes', 'hyperframes@0.8.207'] : [];
const env = {
  ...process.env,
  HYPERFRAMES_BROWSER_PATH: process.env.HYPERFRAMES_BROWSER_PATH
    ?? '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
  // The CLI orphan collector reads process arguments. Keep it disabled.
  HYPERFRAMES_NO_ORPHAN_CLEANUP: '1',
};

function run(command, argv) {
  return new Promise((accept, reject) => {
    const child = spawn(command, argv, { cwd, env, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    child.stdout.on('data', chunk => { stdout += chunk; });
    // Do not surface raw tool logs, which may contain local diagnostics.
    child.stderr.on('data', () => {});
    child.on('error', error => reject(new Error(`Unable to start ${command}: ${error.code ?? 'error'}`)));
    child.on('close', code => accept({ code, stdout }));
  });
}

const flags = action === 'render'
  ? ['render', '--format', 'mp4', '--fps', '15', '--workers', '1', '--output', '.hyperframes/cc2agent-demo.mp4']
  : ['check', '--json'];
const result = await run(cli, [...args, ...flags]);
if (action === 'check') {
  const begin = result.stdout.indexOf('{\n  "ok"');
  if (begin >= 0) {
    const report = JSON.parse(result.stdout.slice(begin));
    console.log(JSON.stringify({
      ok: report.ok,
      findings: Object.entries(report).flatMap(([area, value]) => value && Array.isArray(value.findings)
        ? value.findings.map(f => ({ area, code: f.code, severity: f.severity, selector: f.selector, message: f.message })) : []),
      contrast: report.contrast?.checked,
    }));
    process.exitCode = result.code === 0 && report.ok ? 0 : 1;
  } else {
    console.log(JSON.stringify({ ok: false, reason: 'No structured check result', exitCode: result.code }));
    process.exitCode = 1;
  }
} else if (result.code !== 0) {
  console.log(JSON.stringify({ ok: false, stage: 'hyperframes-render', exitCode: result.code }));
  process.exitCode = 1;
} else {
  await mkdir(resolve(cwd, '../assets'), { recursive: true });
  const gif = '../assets/cc2agent-demo.gif';
  const convert = await run('ffmpeg', [
    '-v', 'error', '-i', '.hyperframes/cc2agent-demo.mp4', '-filter_complex',
    '[0:v]fps=10,scale=960:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=128[p];[b][p]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle',
    '-gifflags', '+transdiff', '-loop', '0', '-y', gif,
  ]);
  const poster = convert.code === 0 ? await run('ffmpeg', [
    '-v', 'error', '-i', gif, '-ss', '11', '-frames:v', '1', '-y', '../assets/cc2agent-demo-poster.png',
  ]) : { code: 1 };
  const ok = convert.code === 0 && poster.code === 0;
  console.log(JSON.stringify({
    ok, stage: 'gif-and-poster', output: 'docs/assets/cc2agent-demo.gif',
    bytes: ok ? (await stat(resolve(cwd, gif))).size : undefined,
    summary: result.stdout.split('\n').filter(line => /capture ·|capture.*gpu.*compile/.test(line)).slice(-1),
  }));
  process.exitCode = ok ? 0 : 1;
}
