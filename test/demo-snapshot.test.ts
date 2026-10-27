import test from 'node:test';
import assert from 'node:assert/strict';
import { cp, mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { reviewWorkspaceFiles, SNAPSHOT_LIMITS, SNAPSHOT_PATH } from '../demos/pr-review/bot/lib/pr-snapshot.ts';

const head = 'a'.repeat(40);
const base = 'b'.repeat(40);
const event = { number: 1, headSha: head, baseSha: base };
const metadata = (changedFiles = 1) => ({ head: { sha: head }, base: { sha: base, repo: { full_name: 'owner/repo' } }, state: 'open', draft: false, changed_files: changedFiles });
function fixture(files = [{ filename: 'src/a.ts', status: 'modified', patch: '- return n*p;\n+ return n+p;' }], before = metadata(files.length), after = before) {
  const requests: { method: string; args: Record<string, any> }[] = [];
  let gets = 0; let authCalls = 0;
  const context = {
    repository: { fullName: 'owner/repo' },
    github: { async getOctokit() { authCalls += 1; return { rest: { pulls: {
      async get(args: Record<string, any>) { requests.push({ method: 'get', args }); return { data: gets++ === 0 ? before : after }; },
      async listFiles(args: Record<string, any>) { requests.push({ method: 'listFiles', args }); return { data: files }; },
    } } }; } },
  } as unknown as Parameters<typeof reviewWorkspaceFiles>[0];
  return { context, requests, authCalls: () => authCalls };
}
async function snapshot(context: Parameters<typeof reviewWorkspaceFiles>[0], repository = 'owner/repo', timeout = 20_000) {
  const files = await reviewWorkspaceFiles(context, event, repository, timeout);
  assert.deepEqual(Object.keys(files), [SNAPSHOT_PATH]);
  assert.equal(typeof files[SNAPSHOT_PATH], 'string');
  const text = files[SNAPSHOT_PATH] as string;
  assert.ok(text.length <= SNAPSHOT_LIMITS.characters);
  return { text, value: JSON.parse(text) };
}

test('PR snapshot uses scoped GET-only requests and checks the event revision before and after reading files', async () => {
  const api = fixture();
  const { value } = await snapshot(api.context);
  assert.equal(value.status, 'ready');
  assert.equal(value.headSha, head);
  assert.equal(value.baseSha, base);
  assert.equal(value.files[0].patch, '- return n*p;\n+ return n+p;');
  assert.deepEqual(api.requests.map(request => request.method), ['get', 'listFiles', 'get']);
  for (const { args } of api.requests) {
    assert.equal(args.owner, 'owner'); assert.equal(args.repo, 'repo'); assert.equal(args.pull_number, 1);
    assert.ok(args.request.signal instanceof AbortSignal); assert.equal(args.request.timeout, 20_000);
  }
  assert.equal(api.requests[1].args.page, 1);
  assert.equal(api.requests[1].args.per_page, 100);
});

test('PR snapshot rejects mismatched scope and revisions without exposing partial diff', async () => {
  const scope = fixture();
  assert.equal((await snapshot(scope.context, 'other/repo')).value.reason, 'invalid_scope_or_event');
  assert.equal(scope.authCalls(), 0);
  const stale = fixture(undefined, { ...metadata(), head: { sha: 'c'.repeat(40) } });
  assert.equal((await snapshot(stale.context)).value.reason, 'event_revision_mismatch');
  assert.equal(stale.requests.length, 1);
  const moved = fixture(undefined, metadata(), { ...metadata(), head: { sha: 'c'.repeat(40) } });
  const result = await snapshot(moved.context);
  assert.equal(result.value.reason, 'pull_request_changed_during_snapshot');
  assert.equal(result.value.files, undefined);
});

test('PR snapshot bounds file count, each patch and the entire serialized document, marking omissions', async () => {
  const api = fixture(Array.from({ length: 110 }, (_, index) => ({ filename: `src/${index}.ts`, status: 'modified', patch: '"\\\n'.repeat(10_000) })), metadata(150));
  const { value } = await snapshot(api.context);
  assert.equal(value.status, 'partial');
  assert.ok(value.files.length <= 100);
  assert.ok(value.files.every((file: { patch: string }) => file.patch.length <= 12_000));
  assert.ok(value.warnings.includes('file_limit_or_incomplete_response'));
  assert.ok(value.warnings.includes('total_character_limit'));
  assert.ok(value.warnings.includes('patches_truncated'));
  const absent = fixture([{ filename: '../../payload.md', status: 'modified', patch: undefined! }]);
  const missing = await snapshot(absent.context);
  assert.equal(missing.value.status, 'partial');
  assert.ok(missing.value.warnings.includes('patch_unavailable_for_some_files'));
});

test('snapshot errors and timeouts fail closed without returning diagnostic details', async () => {
  const api = fixture();
  api.context.github.getOctokit = async () => { throw new Error('private diagnostic sentinel'); };
  const failure = await snapshot(api.context);
  assert.equal(failure.value.status, 'blocked');
  assert.equal(failure.value.reason, 'snapshot_unavailable');
  assert.doesNotMatch(failure.text, /private diagnostic sentinel/);
  api.context.github.getOctokit = () => new Promise(() => {});
  const timed = await snapshot(api.context, 'owner/repo', 5);
  assert.equal(timed.value.reason, 'snapshot_timeout');
});

test('demo builder templates and shipped snapshot implementation remain identical', async () => {
  const template = await readFile('scripts/demo-templates/pr-snapshot.ts', 'utf8');
  assert.equal(await readFile('demos/pr-review/bot/lib/pr-snapshot.ts', 'utf8'), template);
  assert.equal(await readFile('demos/pr-review/bot/channels/github.ts', 'utf8'), await readFile('scripts/demo-templates/github-pr-review.ts', 'utf8'));
  assert.equal(await readFile('demos/full-send/bot/channels/github.ts', 'utf8'), await readFile('scripts/demo-templates/github-full-send.ts', 'utf8'));
});

test('demo builder creates fresh channel directories and reproduces the tested source and provenance', async () => {
  const out = await mkdtemp(join(tmpdir(), 'cc-to-cursor-agent-demo-builder-'));
  try {
    await mkdir(join(out, 'scripts'), { recursive: true });
    await mkdir(join(out, 'fixtures'), { recursive: true });
    await cp('scripts/build-demos.mjs', join(out, 'scripts/build-demos.mjs'));
    await cp('scripts/demo-templates', join(out, 'scripts/demo-templates'), { recursive: true });
    await cp('fixtures/tstack', join(out, 'fixtures/tstack'), { recursive: true });
    const result = spawnSync(process.execPath, [join(out, 'scripts/build-demos.mjs')], { encoding: 'utf8', timeout: 10_000 });
    assert.equal(result.status, 0, 'Isolated demo builder failed (diagnostics withheld)');
    for (const path of [
      'demos/full-send/bot/channels/github.ts', 'demos/full-send/TSTACK-PROVENANCE.json',
      'demos/pr-review/bot/channels/github.ts', 'demos/pr-review/bot/lib/pr-snapshot.ts',
      'demos/pr-review/evals/pr-review.eval.ts', 'demos/pr-review/TSTACK-PROVENANCE.json',
    ]) assert.equal(await readFile(join(out, path), 'utf8'), await readFile(path, 'utf8'), path);
  } finally { await rm(out, { recursive: true, force: true }); }
});
