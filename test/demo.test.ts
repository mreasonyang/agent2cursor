import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { runInNewContext } from 'node:vm';
import { mergeBlockReason } from '../demos/full-send/bot/lib/merge-policy.ts';

const allowed = { enabled: '1', approved: true, purpose: 'production', configuredRepository: 'owner/repo', sessionRepository: 'owner/repo', currentHead: 'a'.repeat(40), expectedHead: 'a'.repeat(40), state: 'open', draft: false, mergeableState: 'clean' };

test('unconfigured demos disable GitHub channels while configured channels preserve scope and auth gates', async () => {
  for (const path of ['demos/full-send', 'demos/pr-review', 'deployments/pr-review']) {
    const source = await readFile(`${path}/bot/channels/github.ts`, 'utf8');
    // Evaluate the authored channel options with an identity SDK factory. This
    // exercises the real conditional configuration without a network or token.
    const body = source.replace(/^import .*;\r?\n/gm, '').replace('export default ', 'globalThis.channel = ');
    let authCalls = 0;
    let factoryCalls = 0;
    let snapshotCalls = 0;
    const auth = { policy: 'SDK default fixture' };
    const disabled = { kind: 'disabled-channel-fixture' };
    const options = (repository: string) => runInNewContext(body, {
      DEMO_REPOSITORY: repository,
      disableChannel: () => disabled,
      githubChannel: (value: unknown) => { factoryCalls += 1; return value; },
      defaultGitHubAuth: () => { authCalls += 1; return auth; },
      reviewWorkspaceFiles: async () => { snapshotCalls += 1; return { '.cc-to-cursor-agent/pr-review.json': '{}' }; },
    });
    const local = options('OWNER/REPO');
    assert.equal(local, disabled, path);
    assert.equal(factoryCalls, 0, 'Unconfigured demo must never construct a GitHub channel');
    assert.equal(Object.hasOwn(local, 'cursorAccount'), false, path);
    const event = { action: 'opened', draft: false, number: 12, url: 'https://github.com/owner/repo/pull/12' };
    assert.equal(authCalls, 0, 'Unconfigured channel must not request dispatch authentication');

    const remote = options('owner/repo');
    assert.equal(factoryCalls, 1);
    assert.deepEqual([...remote.cursorAccount.repos], ['owner/repo']);
    assert.equal(remote.cursorAccount.permissions, path.endsWith('pr-review') ? 'read' : 'pr-write');
    assert.equal(remote.deliverReplies, false);
    assert.equal(remote.progress.reactions, false);
    assert.equal(remote.onComment({}, {}), null);
    assert.equal(Object.hasOwn(remote, 'auth'), false);
    const context = { repository: { fullName: 'owner/repo' } };
    assert.equal(remote.onPullRequest({ repository: { fullName: 'other/repo' } }, event), null);
    assert.equal(remote.onPullRequest(context, { ...event, draft: true }), null);
    assert.equal(remote.onPullRequest(context, { ...event, action: 'closed' }), null);
    assert.equal(authCalls, 0, 'Rejected events must not call dispatch authentication');
    for (const action of ['opened', 'reopened', 'ready_for_review']) {
      const dispatch = remote.onPullRequest(context, { ...event, action });
      assert.equal(dispatch.auth, auth);
      if (path.endsWith('pr-review')) {
        assert.equal(snapshotCalls, 0, 'PR fetch must be deferred until after the webhook response');
        assert.equal(typeof dispatch.workspaceFiles, 'function');
      }
    }
    assert.equal(authCalls, 3, 'Accepted events retain defaultGitHubAuth');
    if (path.endsWith('pr-review')) {
      await remote.onPullRequest(context, event).workspaceFiles();
      assert.equal(snapshotCalls, 1);
    }
  }
});

test('merge gate blocks default, evals, unapproved calls, scope drift and stale heads', () => {
  assert.equal(mergeBlockReason(allowed), undefined);
  for (const patch of [
    { enabled: undefined }, { enabled: 'true' }, { approved: false }, { purpose: 'eval' },
    { configuredRepository: 'OWNER/REPO' }, { sessionRepository: 'other/repo' },
    { currentHead: 'b'.repeat(40) }, { expectedHead: 'not-a-sha' },
    { state: 'closed' }, { draft: true }, { mergeableState: 'behind' }, { mergeableState: 'unknown' },
  ]) assert.ok(mergeBlockReason({ ...allowed, ...patch }), JSON.stringify(patch));
});

test('demo roots exclude shell and review write tools; authored merge tool has approval and SHA gates', async () => {
  const full = await readFile('demos/full-send/bot/agent.ts', 'utf8');
  const review = await readFile('demos/pr-review/bot/agent.ts', 'utf8');
  assert.doesNotMatch(full, /"shell"/);
  assert.doesNotMatch(review, /"(?:shell|edit|delete)"/);
  for (const source of [full, review]) assert.match(source, /sandbox: true/);
  const merge = await readFile('demos/full-send/bot/tools/merge_pr.ts', 'utf8');
  assert.match(merge, /needsApproval: true/);
  assert.match(merge, /effect: "write"/);
  assert.match(merge, /dryRunResult:.*merged: false/);
  assert.match(merge, /sha: expectedHead/);
  assert.doesNotMatch(merge, /process\.env\[(?:[^\]]+)\]|exec\(|spawn\(|--admin|force/);
  const stub = await readFile('demos/full-send/bot/tools/pr_wait_script.ts', 'utf8');
  assert.match(stub, /enabled:false/);
  assert.doesNotMatch(stub, /child_process|exec\(|spawn\(|python3/);
});

test('every pinned tstack snapshot byte matches provenance and nine skills are present', async () => {
  const manifest = JSON.parse(await readFile('fixtures/tstack/PROVENANCE.json', 'utf8'));
  assert.equal(manifest.commit, '7de017b3fc9d50c03cf3ecb98fb71e0ca65a78bd');
  assert.equal((await readdir('fixtures/tstack/skills')).length, 9);
  for (const [path, expected] of Object.entries(manifest.sha256)) {
    const bytes = await readFile(`fixtures/tstack/${path}`);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), expected, path);
  }
  const license = await readFile('fixtures/tstack/LICENSE', 'utf8');
  for (const name of ['full-send', 'pr-review']) {
    assert.equal(await readFile(`demos/${name}/LICENSE-tstack`, 'utf8'), license);
    const provenance = JSON.parse(await readFile(`demos/${name}/TSTACK-PROVENANCE.json`, 'utf8'));
    assert.deepEqual(provenance.upstreamSnapshot, manifest);
    assert.match(provenance.hashScope, /not a hash manifest of this adapted demo/);
    assert.ok(provenance.modifications.length >= 4);
    assert.equal(provenance.demo, name);
    for (const skill of await readdir(`demos/${name}/bot/skills`)) {
      const text = await readFile(`demos/${name}/bot/skills/${skill}/SKILL.md`, 'utf8');
      assert.match(text, /Copyright \(c\) 2026 Theo Browne/);
      assert.match(text, /7de017b3fc9d50c03cf3ecb98fb71e0ca65a78bd/);
      assert.match(text, /Changes:/);
    }
  }
});

test('review demo honestly declares same-model fallback and all three delegates in eval', async () => {
  const skill = await readFile('demos/pr-review/bot/skills/council/SKILL.md', 'utf8');
  assert.match(skill, /降级/);
  assert.match(skill, /同一模型/);
  const suite = await readFile('demos/pr-review/evals/pr-review.eval.ts', 'utf8');
  for (const id of ['reviewer-a', 'reviewer-b', 'reviewer-c']) {
    assert.ok(suite.includes(`t.calledSubagent("${id}", { status: "completed" })`));
    assert.ok(suite.includes(`includes(/^\\|[^\\n]*${id}[^\\n]*\\|/m)`));
    assert.doesNotMatch(await readFile(`demos/pr-review/bot/subagents/${id}/agent.ts`, 'utf8'), /model\s*:/);
  }
});
