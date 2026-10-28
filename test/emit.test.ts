import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import ts from "typescript";
import { parse } from "yaml";
import type { ConvertOptions, MigrationIR, SkillAsset } from "../src/ir.js";
import { planProject } from "../src/emit/project.js";
import { renderReport } from "../src/emit/report.js";
import { renderSubagent } from "../src/emit/subagent.js";
import { DISABLED_TOOL_SCRIPT } from "../src/emit/tool-stub.js";
import { scanInputs } from "../src/scan/index.js";
import { scanForeignTools } from "../src/mapping/foreign-tools.js";

const options: ConvertOptions = { name: "Fixture Agent", lang: "zh", withDeps: false, keepModel: false, modelMap: {} };
const empty = (): MigrationIR => ({ agents: [], skills: [], scripts: [], findings: [] });

async function fixture(): Promise<{ directory: string; skill: SkillAsset }> {
  const directory = await mkdtemp(join(await realpath(tmpdir()), "agent2cursor-emit-"));
  await mkdir(join(directory, "scripts"));
  await mkdir(join(directory, "references"));
  await mkdir(join(directory, ".git"));
  await writeFile(join(directory, "SKILL.md"), "---\nname: fixture\ndescription: fixture\n---\nUse the fixture.\n");
  await writeFile(join(directory, "scripts", "work.py"), "raise Exception('original script must not execute')\n");
  await writeFile(join(directory, "references", "notes.md"), "Supporting text.\n");
  await writeFile(join(directory, ".git", "config"), "fixture ignored directory\n");
  return {
    directory,
    skill: { id: "fixture", source: join(directory, "SKILL.md"), directory, body: "Use the fixture.\n", frontmatter: { name: "original name", description: "Original description", "allowed-tools": "Read", license: "MIT", metadata: { author: "fixture" }, custom: true }, description: "Normalized description", dependency: false, findings: [] },
  };
}

test("skill emission preserves extra frontmatter, body and supporting files without executing scripts", async () => {
  const { directory, skill } = await fixture();
  try {
    const ir = empty();
    ir.skills.push(skill);
    ir.scripts.push({ id: "work", source: join(directory, "scripts", "work.py"), skillId: "fixture", relativePath: "scripts/work.py" });
    const plan = await planProject(ir, options);
    const skillText = String(plan.files.get("bot/skills/fixture/SKILL.md"));
    const metadata = parse(skillText.match(/^---\n([\s\S]*?)\n---\n/u)![1]!);
    assert.deepEqual(metadata, { ...skill.frontmatter, name: "fixture", description: "Normalized description" });
    assert.ok(skillText.endsWith(skill.body));
    assert.equal(String(plan.files.get("bot/skills/fixture/references/notes.md")), "Supporting text.\n");
    assert.equal(String(plan.files.get("bot/skills/fixture/scripts/work.py")), await readFile(join(directory, "scripts", "work.py"), "utf8"));
    assert.ok(![...plan.files.keys()].some((path) => path.includes(".git/")));
    assert.ok(plan.ir.findings.some((finding) => finding.field === "[excluded path]" && finding.status === "dropped"));
    assert.equal(ir.findings.length, 0, "planning must not mutate caller IR");
    const tool = String(plan.files.get("bot/tools/work.ts"));
    assert.match(tool, /execution: "agent"/u);
    assert.match(tool, /\.cursor\/skills\/fixture\/scripts\/work\.py/u);
    assert.doesNotMatch(tool, /raise Exception/u);
    assert.match(tool, /AGENT2CURSOR_STUB_DISABLED/u);
    for (const field of Object.keys(skill.frontmatter)) assert.match(String(plan.files.get("MIGRATION.zh-CN.md")), new RegExp(`\\| ${field} \\|`));
    const skillEval = String(plan.files.get("evals/skills.eval.ts"));
    assert.match(skillEval, /t\.loadedSkill\("fixture"\)/u);
    assert.match(skillEval, /timeoutMs: 240000/u);
    assert.match(skillEval, /做一个最小例子/u);
    assert.match(skillEval, /不要执行其中的脚本/u);
    assert.doesNotMatch(skillEval, /一句话说明用途/u);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test("subagent routing evals delegate a minimal example without forbidding tools", async () => {
  const ir = empty();
  ir.agents.push({ id: "reviewer", source: "reviewer.md", body: "Review.", frontmatter: { name: "reviewer" }, description: "Reviews code.", findings: [] });
  const text = String((await planProject(ir, options)).files.get("evals/subagents.eval.ts"));
  assert.match(text, /timeoutMs: 240000/u);
  assert.match(text, /最小例子/u);
  assert.match(text, /t\.calledSubagent\("reviewer"\)/u);
  assert.doesNotMatch(text, /已就绪/u);
  assert.doesNotMatch(text, /不要使用任何工具/u);
});

test("a generated script stub consumes input and fails closed without touching its source", () => {
  const result = spawnSync("/bin/sh", ["-c", DISABLED_TOOL_SCRIPT], { input: '{"args":["ignored"]}', encoding: "utf8", timeout: 3000 });
  assert.equal(result.status, 78);
  assert.equal(result.stderr, "");
  assert.deepEqual(JSON.parse(result.stdout), { ok: false, error: "AGENT2CURSOR_STUB_DISABLED", message: "TODO(agent2cursor): review the original script and implement JSON stdin/stdout before enabling this tool." });
});

test("descriptions and multiline TODO findings cannot inject TypeScript statements", () => {
  const source = renderSubagent({
    id: "reviewer", source: "reviewer.md", body: "review", description: '\"});\nthrow new Error("injected"); //',
    model: 'model\"\n}); throw new Error("model"); //', frontmatter: {},
    findings: [{ source: "reviewer.md", field: "tools", status: "degraded", message: 'first\n});\nthrow new Error("comment");\u2028last', messageEn: "test" }],
  }, options);
  const parsed = ts.createSourceFile("agent.ts", source, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TS);
  assert.equal(parsed.statements.length, 2, "only import and export declaration may exist");
  assert.equal(parsed.statements[1]!.kind, ts.SyntaxKind.ExportAssignment);
  const transpiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext }, reportDiagnostics: true });
  assert.equal(transpiled.diagnostics?.length, 0);
  assert.match(source, /\/\/ TODO\(agent2cursor\): throw new Error/u);
});

test("project generation locks the SDK and only emits explicit root allowlists", async () => {
  const normal = await planProject(empty(), options);
  const pkg = JSON.parse(String(normal.files.get("package.json")));
  assert.equal(pkg.dependencies["@grok/agent-sdk"], "0.3.0");
  assert.equal(pkg.name, "fixture-agent");
  assert.match(String(normal.files.get("bot/agent.ts")), /sandbox: true/u);
  assert.doesNotMatch(String(normal.files.get("bot/agent.ts")), /tools:/u);
  const explicit = await planProject(empty(), { ...options, rootTools: [] });
  assert.match(String(explicit.files.get("bot/agent.ts")), /tools: \[\]/u);
  assert.match(String(normal.files.get("evals/evals.config.ts")), /maxConcurrency: 2/u);
  const english = await planProject(empty(), { ...options, lang: "en" });
  assert.ok(english.files.has("MIGRATION.en.md"));
  assert.match(String(english.files.get("bot/instructions.md")), /Do not assume the root tool allowlist constrains task subagents/u);
});

test("emitter rejects traversal, case collisions, and skill-tree symlinks", async () => {
  const base = { source: "agent.md", body: "test", frontmatter: {}, description: "test", findings: [] };
  const traversal = empty();
  traversal.agents = [{ ...base, id: "../escape" }];
  await assert.rejects(planProject(traversal, options), /Invalid subagent id/u);
  const collision = empty();
  collision.agents = [{ ...base, id: "Reviewer" }, { ...base, id: "reviewer" }];
  await assert.rejects(planProject(collision, options), /Duplicate subagent id/u);
  const { directory, skill } = await fixture();
  try {
    await symlink("references/notes.md", join(directory, "link.md"));
    const ir = empty(); ir.skills = [skill];
    await assert.rejects(planProject(ir, options), /Symbolic links are not permitted/u);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test("report never silently omits frontmatter fields and does not confuse validation with live execution", () => {
  const ir = empty();
  ir.agents = [{ id: "reviewer", source: "a|b<test>.md", body: "test", frontmatter: { name: "reviewer", tools: "Read", unknown: 1 }, description: "test", findings: [] }];
  const report = renderReport(ir, options, { status: "passed", command: "agent-sdk validate --dir <out>", message: "No diagnostics" });
  for (const field of ["name", "tools", "unknown"]) assert.ok(report.includes(`| ${field} | ⚠️ 降级 |`));
  assert.ok(report.includes("a\\|b&lt;test&gt;.md"));
  assert.match(report, /不能假定根工具白名单能约束 task 子代理/u);
  assert.match(report, /不证明真实模型执行/u);
});

test("tstack conversion preserves the verified root license and discloses unverified source revision", async () => {
  const ir = await scanInputs(["fixtures/tstack/skills/full-send"], { ...options, withDeps: true });
  const plan = await planProject(ir, options);
  assert.equal(String(plan.files.get("LICENSE-tstack")), await readFile("fixtures/tstack/LICENSE", "utf8"));
  const provenance = JSON.parse(String(plan.files.get("TSTACK-PROVENANCE.json")));
  assert.equal(provenance.sourceRevision, "unverified");
  assert.equal(provenance.repository, "https://github.com/t3dotgg/tstack");
  assert.equal(provenance.inputs.length, 1);
  assert.equal(provenance.inputs[0].skills.length, 5);
  assert.match(String(plan.files.get("THIRD_PARTY_NOTICES.md")), /Theo Browne/u);
  assert.ok(plan.ir.findings.some((finding) => finding.field === "[tstack license]"));
});

test("recognized external tstack cannot omit or substitute its associated license", async () => {
  const root = await mkdtemp(join(await realpath(tmpdir()), "agent2cursor-tstack-"));
  try {
    const directory = join(root, "skills", "fixture");
    await mkdir(directory, { recursive: true });
    await writeFile(join(root, "README.md"), "# tstack\n\nhttps://github.com/t3dotgg/tstack\n");
    await writeFile(join(directory, "SKILL.md"), "---\nname: fixture\ndescription: Fixture.\n---\nRead only.\n");
    const ir = await scanInputs([directory], options);
    await assert.rejects(planProject(ir, options), /missing its MIT LICENSE/u);
    await writeFile(join(root, "LICENSE"), "An unverified license.\n");
    await assert.rejects(planProject(ir, options), /differs from the verified MIT notice/u);
    await writeFile(join(root, "LICENSE"), (await readFile("fixtures/tstack/LICENSE", "utf8")).replaceAll("\n", "\r\n"));
    const valid = await planProject(ir, options);
    assert.equal(String(valid.files.get("LICENSE-tstack")), await readFile(join(root, "LICENSE"), "utf8"));
    await writeFile(join(root, "README.md"), "# Unrelated project\n");
    const unrelated = await planProject(ir, options);
    assert.ok(!unrelated.files.has("LICENSE-tstack"), "must not pull arbitrary parent licenses into unrelated skills");
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("preloaded skill requests become explicit root and subagent hints, with missing skills disclosed", async () => {
  const { directory, skill } = await fixture();
  try {
    const ir = empty();
    ir.skills = [skill];
    ir.agents = [{ id: "reviewer", source: "reviewer.md", body: "Original body unchanged.\n", frontmatter: { skills: ["original name", "not-converted"] }, description: "Review", findings: [] }];
    const plan = await planProject(ir, options);
    const instructions = String(plan.files.get("bot/subagents/reviewer/instructions.md"));
    assert.ok(instructions.startsWith(ir.agents[0]!.body));
    assert.match(instructions, /共享 skill：`fixture`/u);
    assert.match(instructions, /not-converted/u);
    assert.match(instructions, /不是自动预加载或权限隔离/u);
    assert.match(String(plan.files.get("bot/instructions.md")), /子代理 skill 加载提示/u);
    assert.ok(plan.ir.findings.some((finding) => finding.field === "[skills preload hint]" && finding.status === "degraded"));
    assert.match(String(plan.files.get(".gitignore")), /\.agent-serve\//u);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test("body reports match emitted instructions for available, missing, empty and invalid preload requests", async () => {
  const directory = await mkdtemp(join(await realpath(tmpdir()), "agent2cursor-body-report-"));
  try {
    const skill = join(directory, "rules");
    const source = join(directory, "reviewer.md");
    await mkdir(skill);
    await writeFile(join(skill, "SKILL.md"), "---\nname: rules\ndescription: Read the rules.\n---\nRule one.\n");
    for (const lang of ["zh", "en"] as const) {
      for (const [field, appended] of [["", false], ["skills: []\n", false], ["skills: invalid\n", false], ["skills: [rules]\n", true], ["skills: [absent]\n", true]] as const) {
        await writeFile(source, `---\nname: reviewer\ndescription: Review\n${field}---\nPreserve these words.\n\nAnd this final line.\n`);
        const opts = { ...options, lang };
        const ir = await scanInputs([source, skill], opts);
        const plan = await planProject(ir, opts);
        const target = "bot/subagents/reviewer/instructions.md";
        const emitted = String(plan.files.get(target));
        assert.equal(emitted.startsWith(ir.agents[0]!.body), true);
        assert.equal(emitted === ir.agents[0]!.body, !appended);
        const body = plan.ir.findings.filter(f => f.source === source && f.field === "$body");
        assert.equal(body.length, 1);
        assert.equal(body[0]!.status, appended ? "degraded" : "mapped");
        assert.deepEqual(plan.ir.agents[0]!.findings.filter(f => f.field === "$body"), body);
        assert.equal(ir.agents[0]!.findings.find(f => f.field === "$body")!.status, "mapped", "planning must not mutate the scanned IR");
        const rows = renderReport(plan.ir, opts).split("\n").filter(line => line.includes("| $body |") && line.includes(target));
        assert.equal(rows.length, 1, "no contradictory scan-time body finding may survive");
        if (appended) assert.match(rows[0]!, lang === "zh" ? /降级.*正文末尾追加/u : /Degraded.*hint appended/u);
        else assert.match(rows[0]!, lang === "zh" ? /已映射.*正文原样/u : /Mapped.*Body preserved/u);
      }
    }
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test("foreign tool references receive individual findings without rewriting agent or skill bodies", async () => {
  const directory = await mkdtemp(join(await realpath(tmpdir()), "agent2cursor-foreign-tools-"));
  try {
    const skill = join(directory, "foreign");
    const agent = join(directory, "foreign-agent.md");
    await mkdir(skill);
    const body = "Do not call WebFetch. Review WebSearch, AskUserQuestion and delegate_task. WebFetch stays written here.\n";
    await writeFile(agent, `---\nname: foreign-agent\ndescription: Review the input.\n---\n${body}`);
    await writeFile(join(skill, "SKILL.md"), `---\nname: foreign\ndescription: Review tool references.\n---\n${body}`);
    const ir = await scanInputs([agent, skill], options);
    const plan = await planProject(ir, options);
    assert.equal(String(plan.files.get("bot/subagents/foreign-agent/instructions.md")), ir.agents[0]!.body);
    assert.ok(String(plan.files.get("bot/skills/foreign/SKILL.md")).endsWith(ir.skills[0]!.body));
    for (const source of [agent, join(skill, "SKILL.md")]) {
      for (const tool of ["WebFetch", "WebSearch", "AskUserQuestion", "delegate_task"]) {
        assert.equal(plan.ir.findings.filter(f => f.source === source && f.field === `$prompt.${tool}`).length, 1);
      }
    }
    const report = renderReport(plan.ir, options);
    assert.match(report, /固定名单，区分大小写/u);
    assert.match(report, /\| \$prompt.WebFetch \| ⚠️ 降级/u);
    assert.deepEqual(scanForeignTools("MyWebFetch WebSearchExtra pre_delegate_task askuserquestion webfetch", "test.md"), []);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
