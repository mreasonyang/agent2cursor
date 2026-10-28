import assert from "node:assert/strict";
import { chmod, mkdtemp, mkdir, readFile, realpath, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import type { ConvertOptions } from "../src/ir.js";
import { scanInputs } from "../src/scan/index.js";
import { fieldPaths, parseMarkdown } from "../src/scan/frontmatter.js";
import { listSafeFiles, readSafeText } from "../src/scan/safety.js";
import { TSTACK_DEPENDENCIES, parseTstackDependencies } from "../src/scan/tstack.js";

const options: ConvertOptions = { name: "test-agent", lang: "zh", withDeps: false, keepModel: false, modelMap: {} };
const fixtures = path.resolve("fixtures");
async function temporary(t: { after: (fn: () => Promise<void>) => void }): Promise<string> {
  const directory = await mkdtemp(path.join(await realpath(os.tmpdir()), "agent2cursor-scan-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  return directory;
}
async function put(directory: string, relative: string, content: string): Promise<string> {
  const file = path.join(directory, relative);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, content);
  return file;
}

test("four agent patterns recurse, strip models by default, and account for every nested field", async () => {
  const ir = await scanInputs([path.join(fixtures, "claude")], options);
  assert.equal(ir.agents.length, 4);
  assert.equal(ir.skills.length, 0);
  for (const agent of ir.agents) {
    assert.equal(agent.model, undefined);
    const covered = new Set(agent.findings.map((finding) => finding.field));
    for (const field of fieldPaths(agent.frontmatter)) assert.ok(covered.has(field), `${agent.id}:${field}`);
  }
  const db = ir.agents.find((agent) => agent.id === "db-reader")!;
  assert.equal(db.findings.find((finding) => finding.field === "hooks.PreToolUse.0.hooks.0.command")?.status, "dropped");
  assert.ok(ir.findings.some((finding) => finding.field === "$prompt.AskUserQuestion"));
  assert.ok(db.findings.find((finding) => finding.field === "tools")?.messageEn.includes("do not assume root allowlists"));
});

test("explicit model mapping and inheritance overrides keep-model", async () => {
  const ir = await scanInputs([path.join(fixtures, "claude/agents")], { ...options, keepModel: true, modelMap: { sonnet: "explicit-target" } });
  assert.equal(ir.agents.find((agent) => agent.id === "code-reviewer")?.model, "explicit-target");
  assert.equal(ir.agents.find((agent) => agent.id === "data-scientist")?.model, "haiku");
  assert.equal(ir.agents.find((agent) => agent.id === "debugger")?.model, undefined);
});

test("real tstack snapshot yields nine skills, pr_wait, metadata triggers, and exact README graph", async () => {
  const root = path.join(fixtures, "tstack");
  const graph = parseTstackDependencies(await readFile(path.join(root, "README.md"), "utf8"));
  for (const [id, deps] of Object.entries(TSTACK_DEPENDENCIES)) assert.deepEqual(graph[id] ?? [], deps, id);
  const ir = await scanInputs([root], { ...options, withDeps: true });
  assert.equal(ir.skills.length, 9);
  assert.deepEqual(ir.scripts.map((script) => script.id), ["pr_wait"]);
  assert.match(ir.skills.find((skill) => skill.id === "full-send")!.trigger!, /Use \$full-send/);
  assert.ok(ir.findings.some((finding) => finding.field === "$prompt.watch_pull_request"));
});

test("full-send dependency closure and overlapping inputs deduplicate", async () => {
  const full = path.join(fixtures, "tstack/skills/full-send");
  const ir = await scanInputs([full, path.join(full, "SKILL.md")], { ...options, withDeps: true });
  assert.deepEqual(ir.skills.map((skill) => skill.id), ["babysit-pr", "file-pr", "full-send", "leaving-pr-comments", "sol-loop"]);
  assert.equal(ir.skills.filter((skill) => skill.dependency).length, 4);
});

test("generic directories ignore README and loose agent files must be explicit", async (t) => {
  const directory = await temporary(t);
  const agent = await put(directory, "review.md", "---\nname: review\ndescription: Review code\n---\nRead files.");
  await put(directory, "README.md", "# Documentation");
  await assert.rejects(scanInputs([directory], options), /No Claude agents/);
  const ir = await scanInputs([agent], options);
  assert.equal(ir.agents.length, 1);
});

test("missing required metadata generates explicit degraded findings", async (t) => {
  const directory = await temporary(t);
  const file = await put(directory, "test-skill/SKILL.md", "# Instructions\nRun the analysis.");
  const ir = await scanInputs([file], options);
  assert.equal(ir.skills[0]?.id, "test-skill");
  assert.ok(ir.skills[0]?.description);
  assert.deepEqual(ir.skills[0]?.findings.filter((finding) => ["name", "description"].includes(finding.field)).map((finding) => finding.status), ["degraded", "degraded"]);
});

test("unknown metadata survives while every field is covered", async (t) => {
  const directory = await temporary(t);
  const file = await put(directory, "test/SKILL.md", "---\nname: test\ndescription: Test\nallowed-tools: Read\nlicense: MIT\nmetadata:\n  owner: Example\n  nested:\n    count: 2\n---\nMonitor progress.");
  const ir = await scanInputs([file], options);
  const skill = ir.skills[0]!;
  assert.deepEqual(skill.frontmatter.metadata, { owner: "Example", nested: { count: 2 } });
  for (const field of fieldPaths(skill.frontmatter)) assert.ok(skill.findings.some((finding) => finding.field === field), field);
  assert.equal(skill.findings.find((finding) => finding.field === "allowed-tools")?.status, "degraded");
});

test("normalized and case-insensitive name collisions fail instead of overwriting", async (t) => {
  const directory = await temporary(t);
  const first = await put(directory, "one.md", "---\nname: Code Reviewer\ndescription: One\n---\nOne");
  const second = await put(directory, "two.md", "---\nname: code-reviewer\ndescription: Two\n---\nTwo");
  await assert.rejects(scanInputs([first, second], options), /Name collision/);
});

test("recursive scripts are discovered without being executed", async (t) => {
  const directory = await temporary(t);
  const skill = path.join(directory, "check");
  await put(skill, "SKILL.md", "---\nname: check\ndescription: Check\n---\nCheck things.");
  const script = await put(skill, "scripts/nested/check.py", "raise RuntimeError('MUST NOT EXECUTE')\n");
  await chmod(script, 0o755);
  const ir = await scanInputs([skill], options);
  assert.equal(ir.scripts[0]?.id, "nested_check");
  assert.equal(ir.scripts[0]?.relativePath, "scripts/nested/check.py");
  assert.equal(ir.findings.find((finding) => finding.field === "$permissions")?.status, "degraded");
});

test("symlinks and sensitive asset filenames fail closed", async (t) => {
  const directory = await temporary(t);
  const skill = path.join(directory, "safe");
  await put(skill, "SKILL.md", "---\nname: safe\ndescription: Safe\n---\nInstructions");
  const external = await put(directory, "outside.txt", "synthetic test data");
  await symlink(external, path.join(skill, "reference.txt"));
  await assert.rejects(scanInputs([skill], options), /Symbolic links/);
  await rm(path.join(skill, "reference.txt"));
  await put(skill, ".env", "SYNTHETIC_PLACEHOLDER=not-real");
  await assert.rejects(scanInputs([skill], options), /Sensitive input path/);
});

test("credential keys, unsafe YAML, and invalid YAML are rejected without echoing source values", () => {
  for (const yaml of ["token: SYNTHETIC_ONLY", "metadata:\n  apiKey: SYNTHETIC_ONLY", "hooks:\n  command: !unsafe SYNTHETIC_ONLY", "name: one\nname: two", "name: &id test\nother: *id"]) {
    assert.throws(() => parseMarkdown(`---\n${yaml}\n---\nbody`, "example.md"), (error: unknown) => error instanceof Error && !error.message.includes("SYNTHETIC_ONLY"));
  }
});

test("bounded input and skipped dependencies are explicit", async (t) => {
  const directory = await temporary(t);
  const file = await put(directory, "large.md", "x".repeat(1024 * 1024 + 1));
  await assert.rejects(readSafeText(file), /exceeds/);
  await put(directory, "node_modules/example.txt", "unused");
  const skipped: string[] = [];
  await listSafeFiles(directory, (file) => skipped.push(file));
  assert.equal(skipped.length, 1);
});

test("missing requested tstack dependencies fail explicitly", async (t) => {
  const directory = await temporary(t);
  const file = await put(directory, "full-send/SKILL.md", "---\nname: full-send\ndescription: Send\n---\nSend");
  await assert.rejects(scanInputs([file], { ...options, withDeps: true }), /Missing dependency/);
});

test("prototype-shaped strings are treated as data instead of dictionary entries", async (t) => {
  const directory = await temporary(t);
  const agent = await put(directory, "test.md", "---\nname: test\ndescription: Test\nmodel: toString\ntools: constructor, __proto__\n__proto__:\n  custom: preserved\n---\nInspect");
  const ir = await scanInputs([agent], options);
  assert.equal(ir.agents[0]?.model, undefined);
  assert.ok(ir.findings.some((finding) => finding.field === "__proto__.custom"));
  const skill = await put(directory, "constructor/SKILL.md", "---\nname: constructor\ndescription: Test\n---\nInspect");
  const skills = await scanInputs([skill], { ...options, withDeps: true });
  assert.equal(skills.skills.length, 1);
});

test("Codex metadata accepts a standard YAML document marker", async (t) => {
  const directory = await temporary(t);
  await put(directory, "sample/SKILL.md", "---\nname: sample\ndescription: Sample\n---\nInspect");
  await put(directory, "sample/agents/openai.yaml", "---\ninterface:\n  default_prompt: Use sample now\n");
  const ir = await scanInputs([path.join(directory, "sample")], options);
  assert.equal(ir.skills[0]?.trigger, "Use sample now");
});
