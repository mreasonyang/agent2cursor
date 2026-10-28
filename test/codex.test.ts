import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import type { ConvertOptions } from "../src/ir.js";
import { planProject } from "../src/emit/project.js";
import { permissionWarning } from "../src/mapping/permissions.js";
import { scanForeignTools } from "../src/mapping/foreign-tools.js";
import { parseCodexAgent } from "../src/scan/codex.js";
import { fieldPaths, parseYamlMapping } from "../src/scan/frontmatter.js";
import { scanInputs } from "../src/scan/index.js";

const options: ConvertOptions = { name: "codex-fixture", lang: "zh", withDeps: false, keepModel: false, modelMap: {} };
const fixture = path.resolve("fixtures/codex/project");
const reviewer = path.join(fixture, ".codex/agents/review.toml");
const metadata = path.join(fixture, ".agents/skills/codex-check/agents/openai.yaml");
const basic = 'name = "custom"\ndescription = "Explain input"\ndeveloper_instructions = "Read only the supplied input."\n';

async function temp(t: { after: (fn: () => Promise<void>) => void }): Promise<string> {
  const dir = await mkdtemp(path.join(await realpath(tmpdir()), "agent2cursor-codex-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  return dir;
}
async function put(dir: string, file: string, text: string): Promise<string> {
  const target = path.join(dir, file);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, text);
  return target;
}

test("Codex project discovery deduplicates TOML inputs and preserves every field and instruction", async () => {
  const ir = await scanInputs([fixture, reviewer, path.join(fixture, ".codex/agents")], options);
  assert.deepEqual(ir.agents.map(a => a.id), ["codex-explorer", "codex-reviewer"]);
  assert.deepEqual(ir.skills.map(s => s.id), ["codex-check"]);
  for (const agent of ir.agents) {
    assert.equal(agent.sourceFormat, "codex");
    const original = parseCodexAgent(await readFile(agent.source, "utf8"), agent.source);
    assert.equal(agent.body, original.developer_instructions);
    assert.deepEqual(agent.frontmatter, original);
    for (const field of fieldPaths(original)) assert.ok(agent.findings.some(f => f.field === field), field);
    assert.equal(agent.model, undefined);
  }
  const review = ir.agents[1]!;
  assert.equal(review.findings.find(f => f.field === "features.shell_tool")?.status, "degraded");
  assert.equal(review.findings.find(f => f.field === "skills.config.0.enabled")?.status, "degraded");
  assert.equal(review.findings.find(f => f.field === "model_reasoning_effort")?.status, "dropped");
  assert.match(ir.agents[0]!.findings.find(f => f.field === "sandbox_mode")!.messageEn, /not an effective standalone Codex agent override/);
  assert.equal(ir.agents[0]!.findings.find(f => f.field === "custom.owner")?.status, "dropped");
  assert.match(permissionWarning(ir, "zh")!, /Codex 权限\/能力配置未迁移/);
  assert.match(permissionWarning(ir, "en")!, /Codex skill invocation policy is not enforced/);
});

test("Codex source models use explicit mappings and never inherit Claude preload semantics", async () => {
  const source = parseCodexAgent(await readFile(reviewer, "utf8"), reviewer);
  for (const opts of [options, { ...options, keepModel: true }, { ...options, modelMap: { "codex-source-model": "target-fixture-model" } }]) {
    const ir = await scanInputs([reviewer], opts);
    const expected = opts.keepModel ? "codex-source-model" : Object.hasOwn(opts.modelMap, "codex-source-model") ? "target-fixture-model" : undefined;
    assert.equal(ir.agents[0]!.model, expected);
    const plan = await planProject(ir, opts);
    assert.equal(String(plan.files.get("bot/subagents/codex-reviewer/instructions.md")), source.developer_instructions);
    assert.ok(!plan.ir.findings.some(f => f.field === "[skills preload hint]"));
    const ts = String(plan.files.get("bot/subagents/codex-reviewer/agent.ts"));
    assert.doesNotMatch(ts, /^\s*(?:features|skills|sandbox_mode|approval_policy|model_reasoning_effort):/m);
    assert.match(ts, /TODO\(agent2cursor\).*features.shell_tool/);
    assert.match(String(plan.files.get("evals/subagents.eval.ts")), /t\.calledSubagent\("codex-reviewer"\)/);
  }
});

test("Codex openai.yaml reports every policy, dependency and UI field without claiming runtime support", async () => {
  const ir = await scanInputs([fixture], options);
  const raw = await readFile(metadata, "utf8");
  const fields = fieldPaths(parseYamlMapping(raw, metadata));
  for (const field of fields) {
    const finding = ir.findings.find(f => f.source === metadata && f.field === field);
    assert.ok(finding, field);
    assert.equal(finding.status, field === "interface.default_prompt" ? "mapped" : "degraded");
  }
  for (const lang of ["zh", "en"] as const) {
    const plan = await planProject(ir, { ...options, lang });
    assert.equal(String(plan.files.get("bot/skills/codex-check/agents/openai.yaml")), raw);
    const report = String(plan.files.get(lang === "zh" ? "MIGRATION.zh-CN.md" : "MIGRATION.en.md"));
    for (const field of fields) assert.ok(report.includes(`| ${field} |`), field);
    assert.ok(![...plan.files.keys()].some(p => p.startsWith("bot/mcp-connections/")));
    assert.ok(String(plan.files.get("evals/skills.eval.ts")).includes(ir.skills[0]!.trigger!));
  }
});

test("Codex and Claude inputs can be mixed; cross-format normalized name collisions fail", async (t) => {
  const ir = await scanInputs([fixture, "fixtures/claude"], options);
  assert.equal(ir.agents.length, 6);
  const dir = await temp(t);
  const claude = await put(dir, "collision.md", "---\nname: codex-reviewer\ndescription: collision\n---\nReview\n");
  await assert.rejects(scanInputs([reviewer, claude], options), /Name collision/);
});

test("directly selecting a nested Codex agent directory retains its format and selected scope", async () => {
  const nested = path.join(fixture, ".codex/agents/nested");
  const ir = await scanInputs([nested], options);
  assert.deepEqual(ir.agents.map(a => a.id), ["codex-explorer"]);
  assert.equal(ir.agents[0]!.sourceFormat, "codex");
  assert.equal(ir.skills.length, 0);
});

test("TOML discovery ignores unrelated configs and Codex README files without reading session config", async (t) => {
  const dir = await temp(t);
  const file = await put(dir, ".codex/agents/check.toml", basic);
  await put(dir, ".codex/agents/README.md", "# This must not become a Claude agent\n");
  await put(dir, "unrelated.toml", "This is deliberately invalid TOML");
  await put(dir, ".codex/config.toml", "This session config must not be parsed");
  const ir = await scanInputs([dir], options);
  assert.equal(ir.agents.length, 1);
  assert.equal(ir.agents[0]!.source, file);
  assert.ok(ir.findings.some(f => f.field === "$session-config"));
  await assert.rejects(scanInputs([path.join(dir, ".codex/config.toml")], options), /Session config.toml is not supported/);
  const loose = await temp(t);
  const agent = await put(loose, "loose.toml", basic);
  await assert.rejects(scanInputs([loose], options), /No Claude agents, Codex standalone agents/);
  assert.equal((await scanInputs([agent], options)).agents.length, 1);
  const namedConfig = await put(loose, ".codex/agents/config.toml", basic);
  assert.equal((await scanInputs([namedConfig], options)).agents.length, 1, "a standalone agent filename is not its identity");
});

test("Codex parsing handles BOM, CRLF, literal multiline strings and dotted fields", () => {
  const config = parseCodexAgent('\uFEFFname = "worker"\r\ndescription = "Work"\r\ndeveloper_instructions = \'\'\'\r\nKeep C:\\notes verbatim.\r\n\'\'\'\r\nfeatures.shell_tool = false\r\n', "worker.toml");
  assert.equal(config.name, "worker");
  assert.match(config.developer_instructions as string, /Keep C:\\notes verbatim\./);
  assert.equal((config.features as Record<string, unknown>).shell_tool, false);
});

test("invalid, duplicate, deep, credential-bearing and incomplete Codex TOML fails without echoing values", () => {
  for (const text of [
    basic + 'name = "SYNTHETIC_ONLY"',
    basic + 'invalid = ["SYNTHETIC_ONLY"',
    basic + '[mcp_servers.test.env]\nAPI_KEY = "SYNTHETIC_ONLY"',
    basic + '[custom]\naccessToken = "SYNTHETIC_ONLY"',
    basic + `${"nested.".repeat(35)}value = "SYNTHETIC_ONLY"`,
    'name = "SYNTHETIC_ONLY"',
    basic.replace('description = "Explain input"', 'description = ["SYNTHETIC_ONLY"]'),
    basic.replace('developer_instructions = "Read only the supplied input."', 'developer_instructions = " "'),
  ]) assert.throws(() => parseCodexAgent(text, "fixture.toml"), error => error instanceof Error && !error.message.includes("SYNTHETIC_ONLY"));
});

test("Codex inputs retain the symlink, size and sensitive-filename protections", async (t) => {
  const dir = await temp(t);
  const file = await put(dir, "source.toml", basic);
  const link = path.join(dir, "link.toml");
  await symlink(file, link);
  await assert.rejects(scanInputs([link], options), /Symbolic links/);
  const auth = await put(dir, "auth.toml", "unread synthetic content");
  await assert.rejects(scanInputs([auth], options), /Sensitive input path/);
  const large = await put(dir, "large.toml", basic + "#".repeat(1024 * 1024));
  await assert.rejects(scanInputs([large], options), /Input exceeds/);
});

test("Codex tool references are reported once without rewriting instructions or matching substrings", async () => {
  const names = ["spawn_agent", "send_input", "close_agent", "resume_agent", "wait_agent", "list_agents", "send_message", "followup_task", "interrupt_agent", "exec_command", "write_stdin", "apply_patch", "update_plan", "request_user_input_async"];
  const body = names.map(n => `functions.${n} and ${n}`).join("\n");
  assert.deepEqual(new Set(scanForeignTools(body, "fixture.toml").map(f => f.field)), new Set(names.map(n => `$prompt.${n}`)));
  assert.equal(scanForeignTools(names.map(n => `prefix_${n}_suffix`).join(" "), "fixture.toml").length, 0);
  assert.equal(scanForeignTools("Wait for input, then wait for the result.", "fixture.toml").length, 0);
  for (const reference of ["functions.wait", "`wait`", "wait({ ids: [] })"]) assert.equal(scanForeignTools(reference, "fixture.toml")[0]?.field, "$prompt.wait");
  const ir = await scanInputs([reviewer], options);
  assert.ok(ir.findings.some(f => f.field === "$prompt.spawn_agent"));
  assert.equal(ir.agents[0]!.body, parseCodexAgent(await readFile(reviewer, "utf8"), reviewer).developer_instructions);
});

test("Codex metadata with absent or invalid default_prompt retains unknown fields and reports fallback", async (t) => {
  const dir = await temp(t);
  await put(dir, "sample/SKILL.md", "---\nname: sample\ndescription: Sample\n---\nExplain input.\n");
  for (const yaml of ["interface:\n  display_name: Sample\ncustom:\n  enabled: true\n", "interface:\n  default_prompt: []\n", "interface: []\n"]) {
    const file = await put(dir, "sample/agents/openai.yaml", yaml);
    const ir = await scanInputs([path.join(dir, "sample")], options);
    assert.equal(ir.skills[0]!.trigger, undefined);
    assert.equal(ir.findings.find(f => f.source === file && f.field === "interface.default_prompt")?.status, "degraded");
    for (const field of fieldPaths(parseYamlMapping(yaml, file))) assert.ok(ir.findings.some(f => f.source === file && f.field === field), field);
    const plan = await planProject(ir, options);
    assert.equal(String(plan.files.get("bot/skills/sample/agents/openai.yaml")), yaml);
  }
});

test("prototype-shaped TOML fields remain data and appear in the report", async (t) => {
  const dir = await temp(t);
  const file = await put(dir, "prototype.toml", basic + '[__proto__]\ncustom = true\n[constructor]\ncustom = true\n');
  const ir = await scanInputs([file], options);
  for (const field of ["__proto__.custom", "constructor.custom"]) assert.ok(ir.findings.some(f => f.field === field && f.status === "dropped"));
  assert.equal(({} as Record<string, unknown>).custom, undefined);
});
