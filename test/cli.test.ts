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
const codex = path.join(root, "fixtures/codex/project");

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

test("CLI converts Codex TOML and skills with model mapping, complete reports and permission warnings", async (t) => {
  const directory = await temp(t);
  const out = path.join(directory, "codex-agent");
  const flags = ["--lang", "en", "--model-map", "codex-source-model=target-model"];
  const inspection = await run(["inspect", codex, ...flags, "--json"]);
  assert.equal(inspection.code, 0, inspection.stderr);
  const inspected = JSON.parse(inspection.stdout);
  assert.deepEqual(inspected.counts, { agents: 2, skills: 1, dependencies: 0, scripts: 0 });
  assert.match(inspected.permissionWarning, /Codex permission\/capability configuration/);
  assert.match(inspected.permissionWarning, /invocation policy is not enforced/);
  const dry = await run(["convert", codex, ...flags, "--out", out, "--dry-run", "--json"]);
  assert.equal(dry.code, 0, dry.stderr);
  await assert.rejects(lstat(out), { code: "ENOENT" });
  const conversion = await run(["convert", codex, ...flags, "--out", out, "--no-validate", "--json"]);
  assert.equal(conversion.code, 0, conversion.stderr);
  assert.deepEqual(JSON.parse(conversion.stdout).findings, inspected.findings);
  const agent = await readFile(path.join(out, "bot/subagents/codex-reviewer/agent.ts"), "utf8");
  assert.match(agent, /model: "target-model"/);
  assert.doesNotMatch(agent, /^\s*(?:features|skills|model_reasoning_effort):/m);
  const report = await readFile(path.join(out, "MIGRATION.en.md"), "utf8");
  assert.match(report, /developer_instructions/);
  assert.match(report, /policy.allow_implicit_invocation/);
  assert.match(report, /dependencies.tools.0.transport/);
  const repeated = await run(["convert", codex, "--out", out, "--no-validate", "--json"]);
  assert.equal(repeated.code, 1);
  assert.match(JSON.parse(repeated.stderr).error, /already exists/);
  const human = await run(["convert", codex, "--dry-run"]);
  assert.equal(human.code, 0);
  assert.match(human.stdout.split("\n")[0]!, /Codex 权限\/能力配置未迁移/);
});

test("CLI rejects invalid Codex TOML without leaking parser excerpts or creating output", async (t) => {
  const directory = await temp(t);
  const file = path.join(directory, "invalid.toml");
  const out = path.join(directory, "not-written");
  for (const text of ['name = ["SYNTHETIC_ONLY"', 'name = "test"\ndescription = "test"\ndeveloper_instructions = "test"\n[metadata]\napiKey = "SYNTHETIC_ONLY"']) {
    await writeFile(file, text);
    const result = await run(["convert", file, "--out", out, "--json"]);
    assert.equal(result.code, 1);
    assert.doesNotMatch(result.stdout + result.stderr, /SYNTHETIC_ONLY/);
    assert.match(JSON.parse(result.stderr).error, /Invalid Codex agent TOML|Sensitive frontmatter field/);
    await assert.rejects(lstat(out), { code: "ENOENT" });
  }
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

test("default script conversion succeeds with a missing-dependency report while doctor stays nonzero", async (t) => {
  const directory = await temp(t);
  const source = path.join(directory, "skill");
  await mkdir(path.join(source, "scripts"), { recursive: true });
  await writeFile(path.join(source, "SKILL.md"), "---\nname: scripted\ndescription: Review the provided text.\n---\nUse the reference, never run scripts.\n");
  const sentinel = path.join(directory, "source-executed");
  await writeFile(path.join(source, "scripts/check.js"), `require('node:fs').writeFileSync(${JSON.stringify(sentinel)}, 'bad');`);
  const out = path.join(directory, "converted");
  const converted = await run(["convert", source, "--out", out, "--json"]);
  assert.equal(converted.code, 0, converted.stderr);
  const result = JSON.parse(converted.stdout);
  assert.equal(result.validation.status, "dependencies-missing");
  assert.deepEqual(result.validation.missingDependencies, ["@grok/agent-sdk", "zod"]);
  const report = await readFile(path.join(out, "MIGRATION.zh-CN.md"), "utf8");
  assert.match(report, /待安装依赖（未校验）/u);
  assert.match(report, /缺少项目依赖 @grok\/agent-sdk, zod/u);
  assert.doesNotMatch(report, /SDK validation failed|状态: 通过/u);
  const doctor = await run(["doctor", "--dir", out, "--json"]);
  assert.equal(doctor.code, 1);
  assert.equal(JSON.parse(doctor.stdout).validation.status, "dependencies-missing");
  await assert.rejects(lstat(sentinel), { code: "ENOENT" });
  const demo = await run(["demo", "full-send", "--out", path.join(directory, "demo")]);
  assert.equal(demo.code, 0);
  assert.match(demo.stdout, /dependencies-missing.*zod/u);
});

test("permission loss leads the CLI and report without emitting ineffective child restrictions", async (t) => {
  const directory = await temp(t);
  const source = path.join(directory, "restricted.md");
  for (const field of ["tools: [Read]", "disallowedTools: [Bash, Edit, Write]", "permissionMode: plan"]) {
    await writeFile(source, `---\nname: restricted\ndescription: Review code\n${field}\n---\nDo not edit.\n`);
    const out = path.join(directory, field.split(":")[0]!);
    const converted = await run(["convert", source, "--out", out, "--no-validate"]);
    assert.equal(converted.code, 0);
    assert.match(converted.stdout.split("\n")[0]!, /子代理限制未生效.*不代表只读/u);
    const report = await readFile(path.join(out, "MIGRATION.zh-CN.md"), "utf8");
    assert.match(report.split("\n")[2]!, /子代理限制未生效/u);
    const child = (await readFile(path.join(out, "bot/subagents/restricted/agent.ts"), "utf8"))
      .split("\n").filter(line => !line.trim().startsWith("//")).join("\n");
    assert.doesNotMatch(child, /tools:|disallowedTools:|permissionMode:/u);
  }
  const inspected = await run(["inspect", source, "--lang", "en", "--json"]);
  assert.match(JSON.parse(inspected.stdout).permissionWarning, /restrictions are not enforced.*does not establish read-only/u);
});

test("inspect reports the same appended-body disposition as conversion", async (t) => {
  const directory = await temp(t);
  const source = path.join(directory, "preloaded.md");
  await writeFile(source, "---\nname: preloaded\ndescription: Review code\nskills: [missing-skill]\n---\nKeep this body.\n");
  const inspected = JSON.parse((await run(["inspect", source, "--json"])).stdout);
  const converted = JSON.parse((await run(["convert", source, "--out", path.join(directory, "out"), "--no-validate", "--json"])).stdout);
  const bodies = (data: typeof inspected) => data.findings.filter((f: { field: string }) => f.field === "$body");
  assert.deepEqual(bodies(inspected), bodies(converted));
  assert.equal(bodies(inspected).length, 1);
  assert.equal(bodies(inspected)[0].status, "degraded");
  assert.match(bodies(inspected)[0].message, /正文末尾追加/u);
});
