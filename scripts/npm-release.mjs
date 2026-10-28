import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cp, lstat, mkdir, mkdtemp, readFile, readdir, realpath, rm, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const registry = 'https://registry.npmjs.org/';
const releaseRoot = join(root, '.validation/npm-release');
const [action, ...flags] = process.argv.slice(2);
assert.ok(['pack', 'publish'].includes(action), 'Use pack or publish');
assert.ok(flags.length === 0 || (action === 'publish' && flags.length === 1 && flags[0] === '--dry-run'), 'Only publish accepts --dry-run');
const pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
assert.equal(pkg.name, '@kyun.si/agent2cursor');
assert.deepEqual(pkg.publishConfig, { access: 'public', registry });
const revision = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' });
assert.equal(revision.status, 0, 'Git revision unavailable');
const sourceRevision = revision.stdout.trim();
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const json = value => JSON.stringify(value, null, 2) + '\n';

async function hashes(paths) {
  const result = {};
  async function visit(path) {
    const entry = await lstat(path);
    assert.ok(!entry.isSymbolicLink(), `Release input must not be a symlink: ${relative(root, path)}`);
    if (entry.isDirectory()) {
      for (const name of (await readdir(path)).sort()) await visit(join(path, name));
    } else {
      assert.ok(entry.isFile(), 'Release inputs must be regular files');
      result[relative(root, path)] = sha256(await readFile(path));
    }
  }
  for (const path of paths) await visit(join(root, path));
  return Object.fromEntries(Object.entries(result).sort(([a], [b]) => a.localeCompare(b)));
}

const inputs = ['package.json', 'package-lock.json', 'tsconfig.json', 'src', 'scripts/npm-release.mjs', ...pkg.files];
await mkdir(releaseRoot, { recursive: true });
if (action === 'pack') {
  const sourceSha256 = await hashes(inputs);
  const output = await mkdtemp(join(releaseRoot, `${pkg.version}-`));
  const stage = await mkdtemp(join(releaseRoot, 'stage-'));
  try {
    for (const path of pkg.files) await cp(join(root, path), join(stage, path), { recursive: true });
    const { scripts, devDependencies, private: sourcePrivate, files, ...metadata } = pkg;
    await writeFile(join(stage, 'package.json'), json({ ...metadata, gitHead: sourceRevision }));
    const packed = spawnSync('npm', ['pack', '--ignore-scripts', '--json', '--pack-destination', output],
      { cwd: stage, encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 });
    assert.equal(packed.status, 0, 'npm pack failed; raw diagnostics withheld');
    const item = JSON.parse(packed.stdout)[0];
    assert.equal(item.name, pkg.name);
    assert.equal(item.version, pkg.version);
    assert.equal(item.filename, `kyun.si-agent2cursor-${pkg.version}.tgz`);
    const artifact = join(output, item.filename);
    const bytes = await readFile(artifact);
    const manifest = { name: pkg.name, version: pkg.version, registry, sourceRevision,
      artifact: relative(root, artifact), bytes: bytes.length, sha256: sha256(bytes),
      integrity: `sha512-${createHash('sha512').update(bytes).digest('base64')}`, sourceSha256 };
    await writeFile(join(output, 'manifest.json'), json(manifest));
    await writeFile(join(releaseRoot, 'latest.json'), json(manifest));
    console.log(json({ name: manifest.name, version: manifest.version, artifact: manifest.artifact,
      bytes: manifest.bytes, sha256: manifest.sha256, sourceRevision }));
  } finally {
    await rm(stage, { recursive: true, force: true });
  }
} else {
  const manifest = JSON.parse(await readFile(join(releaseRoot, 'latest.json'), 'utf8'));
  assert.equal(manifest.name, pkg.name);
  assert.equal(manifest.version, pkg.version);
  assert.equal(manifest.registry, registry);
  assert.equal(manifest.sourceRevision, sourceRevision, 'Git revision changed; rebuild the release package');
  assert.deepEqual(manifest.sourceSha256, await hashes(inputs), 'Release inputs changed; rebuild and verify the package');
  const artifact = resolve(root, manifest.artifact);
  assert.ok(artifact.startsWith(releaseRoot + '/'), 'Release archive must stay inside the release directory');
  assert.equal(await realpath(artifact), artifact, 'Release archive must not traverse symlinks');
  assert.ok((await lstat(artifact)).isFile(), 'Release archive must be a regular file');
  const bytes = await readFile(artifact);
  assert.equal(bytes.length, manifest.bytes);
  assert.equal(sha256(bytes), manifest.sha256, 'Release archive changed; rebuild and verify it');
  const result = spawnSync('npm', ['publish', artifact, '--access=public', '--ignore-scripts', `--registry=${registry}`, ...flags],
    { cwd: root, stdio: 'inherit' });
  if (result.error) throw new Error(`Unable to start npm: ${result.error.code ?? 'error'}`);
  process.exitCode = result.status ?? 1;
}
