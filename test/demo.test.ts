import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { mergeBlockReason } from '../demos/full-send/bot/lib/merge-policy.ts';

const allowed = { enabled: '1', approved: true, purpose: 'production', configuredRepository: 'owner/repo', sessionRepository: 'owner/repo', currentHead: 'a'.repeat(40), expectedHead: 'a'.repeat(40), state: 'open', draft: false, mergeableState: 'clean' };

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
    assert.ok(suite.includes(`t.calledSubagent("${id}")`));
    assert.doesNotMatch(await readFile(`demos/pr-review/bot/subagents/${id}/agent.ts`, 'utf8'), /model\s*:/);
  }
});
