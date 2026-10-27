import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { chmod, lstat, mkdir, mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const root = path.resolve(".");
const cli = path.join(root, "src/cli.ts");
const agents = path.join(root, "fixtures/claude");
const fullSend = path.join(root, "fixtures/tstack/skills/full-send");

async function temp(t: { after: (fn: () => Promise<void>) => void }): Promise<string> {
  const directory = await mkdtemp(path.join(await realpath(os.tmpdir()), "cc-to-cursor-agent-cli-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  return directory;
}
function run(args: string[]): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    execFile(process.execPath, ["--import", "tsx", cli, ...args], { cwd: root, timeout: 20_000, maxBuffer: 2 * 1024 * 1024 }, (error, stdout, stderr) => {
      resolve({ code: error ? typeof error.code === "number" ? error.code : 1 : 0, stdout, stderr });
    });
  });
}

test("CLI dry-run plans real conversion without creating output", async (t) => {
  const directory = await temp(t);
  const out = path.join(directory, "unwritten");
  const result = await run(["convert", agents, "--out", out, "--dry-run", "--json"]);
  assert.equal(result.code, 0, result.stderr);
  const data = JSON.parse(result.stdout);
  assert.equal(data.dryRun, true);
  assert.equal(data.counts.agents, 4);
  assert.ok(data.files.includes("MIGRATION.zh-CN.md"));
  assert.equal(data.validation.status, "skipped");
  await assert.rejects(lstat(out), { code: "ENOENT" });
});

test("CLI inspect JSON has complete findings and tstack dependency inventory", async () => {
  const result = await run(["inspect", fullSend, "--with-deps", "--json"]);
  assert.equal(result.code, 0, result.stderr);
  const data = JSON.parse(result.stdout);
  assert.deepEqual(data.counts, { agents: 0, skills: 5, dependencies: 4, scripts: 1 });
  assert.deepEqual(data.tools, ["pr_wait"]);
  assert.ok(data.findings.some((finding: { field: string }) => finding.field === "$dependencies"));
  assert.equal(data.files, undefined);
});

test("CLI emits explicit model/root-tool choices and an English report", async (t) => {
  const directory = await temp(t);
  const out = path.join(directory, "english-agent");
  const result = await run(["convert", agents, "--out", out, "--name", "test-project", "--model-map", "sonnet=chosen-model", "--root-tools", "read,grep,glob,ls,task", "--lang", "en", "--no-validate", "--json"]);
  assert.equal(result.code, 0, result.stderr);
  const data = JSON.parse(result.stdout);
  assert.equal(data.validation.status, "skipped");
  const rootAgent = await readFile(path.join(out, "bot/agent.ts"), "utf8");
  const reviewer = await readFile(path.join(out, "bot/subagents/code-reviewer/agent.ts"), "utf8");
  assert.match(rootAgent, /tools: \["read","grep","glob","ls","task"\]/);
  assert.match(reviewer, /model: "chosen-model"/);
  assert.match(await readFile(path.join(out, "MIGRATION.en.md"), "utf8"), /^# Migration report: test-project/);
  await assert.rejects(lstat(path.join(out, "MIGRATION.zh-CN.md")), { code: "ENOENT" });
  const generatedPackage = JSON.parse(await readFile(path.join(out, "package.json"), "utf8"));
  assert.equal(generatedPackage.dependencies["@grok/agent-sdk"], "0.3.0");
});

test("CLI refuses overwrite and leaves the existing directory intact", async (t) => {
  const out = await temp(t);
  await writeFile(path.join(out, "sentinel.txt"), "retain existing output");
  const result = await run(["convert", agents, "--out", out, "--no-validate", "--json"]);
  assert.equal(result.code, 1);
  assert.match(JSON.parse(result.stderr).error, /already exists/);
  assert.equal(await readFile(path.join(out, "sentinel.txt"), "utf8"), "retain existing output");
  await assert.rejects(lstat(path.join(out, "package.json")), { code: "ENOENT" });
});

test("CLI doctor uses installed CLI and reports metadata without raw diagnostics", async (t) => {
  const out = await temp(t);
  const sdk = path.join(out, "node_modules/.bin/agent-sdk");
  await mkdir(path.dirname(sdk), { recursive: true });
  await writeFile(sdk, `#!${process.execPath}\nif (process.argv[2] !== 'validate' || !process.argv.includes('--json')) process.exit(8);\nconsole.error('SYNTHETIC_PRIVATE_DIAGNOSTIC');\nconsole.log(JSON.stringify({ ok: true, agents: [{ diagnostics: [{ severity: 'warning', message: 'SYNTHETIC_PRIVATE_DIAGNOSTIC' }] }] }));\n`);
  await chmod(sdk, 0o755);
  const result = await run(["doctor", "--dir", out, "--json"]);
  assert.equal(result.code, 0, result.stderr);
  const data = JSON.parse(result.stdout);
  assert.equal(data.sdkInstalled, true);
  assert.equal(data.validation.status, "passed");
  assert.match(data.validation.message, /0 errors, 1 warnings/);
  assert.equal((result.stdout + result.stderr).includes("SYNTHETIC_PRIVATE_DIAGNOSTIC"), false);
});

test("CLI doctor fails validation errors even when SDK process exits zero", async (t) => {
  const out = await temp(t);
  const sdk = path.join(out, "node_modules/.bin/agent-sdk");
  await mkdir(path.dirname(sdk), { recursive: true });
  await writeFile(sdk, `#!${process.execPath}\nconsole.log(JSON.stringify({ ok: false, agents: [{ diagnostics: [{ severity: 'error', message: 'SYNTHETIC_PRIVATE_DETAIL' }] }] }));\n`);
  await chmod(sdk, 0o755);
  const result = await run(["doctor", "--dir", out, "--json"]);
  assert.equal(result.code, 1);
  assert.equal(JSON.parse(result.stdout).validation.status, "failed");
  assert.equal((result.stdout + result.stderr).includes("SYNTHETIC_PRIVATE_DETAIL"), false);
});

test("CLI demo extraction retains tstack MIT and deployable source files", async (t) => {
  const directory = await temp(t);
  const out = path.join(directory, "demo");
  const result = await run(["demo", "full-send", "--out", out, "--no-validate", "--json"]);
  assert.equal(result.code, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).demo, "full-send");
  assert.match(await readFile(path.join(out, "LICENSE-tstack"), "utf8"), /Copyright \(c\) 2026 Theo Browne/);
  await lstat(path.join(out, "bot/channels/github.ts"));
  await lstat(path.join(out, "bot/tools/merge_pr.ts"));
  await lstat(path.join(out, "evals/evals.config.ts"));
  const repeated = await run(["demo", "full-send", "--out", out, "--no-validate", "--json"]);
  assert.equal(repeated.code, 1);
});

test("CLI rejects malformed model maps and unknown root tool names", async () => {
  for (const flags of [["--model-map", "sonnet"], ["--root-tools", "Read"], ["--lang", "invalid"]]) {
    const result = await run(["convert", agents, "--dry-run", ...flags, "--json"]);
    assert.equal(result.code, 1);
  }
});
