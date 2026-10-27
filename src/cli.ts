#!/usr/bin/env node
import { Command, Option } from "commander";
import { writeFile } from "node:fs/promises";
import { basename, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { scanInputs } from "./scan/index.js";
import { listSafeFiles, readSafeFile } from "./scan/safety.js";
import { planProject } from "./emit/project.js";
import { renderReport } from "./emit/report.js";
import { SDK_VERSION, type ConvertOptions, type MigrationIR, type ValidationResult } from "./ir.js";
import { validateProject, findSdk, supportedNode } from "./validate.js";
import { writeProject } from "./write.js";

const VERSION = "0.1.0";
const program = new Command().name("cc2agent").description("Claude agents / Agent Skills → editable Agent SDK projects with migration reports").version(VERSION);
const legalTools = new Set(["read", "grep", "glob", "ls", "shell", "edit", "task", "delete"]);

function options(raw: Record<string, unknown>): ConvertOptions {
  const map: Record<string, string> = Object.create(null);
  for (const pair of String(raw.modelMap ?? "").split(",").filter(Boolean)) {
    const [from, ...parts] = pair.split("=");
    const to = parts.join("=").trim();
    if (!from?.trim() || !to) throw new Error("--model-map expects sonnet=<id>,opus=<id>.");
    map[from.trim()] = to;
  }
  const rootTools = raw.rootTools === undefined ? undefined : String(raw.rootTools).split(",").map(x => x.trim()).filter(Boolean);
  if (rootTools?.some(x => !legalTools.has(x))) throw new Error("--root-tools accepts read,grep,glob,ls,shell,edit,task,delete.");
  const name = String(raw.name ?? "converted-agent");
  if (!/^[a-z0-9][a-z0-9_-]{0,63}$/.test(name)) throw new Error("--name must be 1–64 lowercase letters, digits, hyphens or underscores, starting with a letter or digit.");
  return { name, lang: raw.lang === "en" ? "en" : "zh", withDeps: !!raw.withDeps,
    keepModel: !!raw.keepModel, modelMap: map, rootTools: rootTools && [...new Set(rootTools)] };
}

function common(command: Command): Command {
  return command.option("--name <name>", "Generated agent name", "converted-agent")
    .option("--model-map <map>", "Explicit source=target model IDs")
    .option("--keep-model", "Preserve unverified source model IDs")
    .option("--root-tools <tools>", "Explicit root harness allowlist")
    .addOption(new Option("--lang <lang>", "Instructions/report language").choices(["zh", "en"]).default("zh"))
    .option("--with-deps", "Include known tstack skill dependencies")
    .option("--json", "Print a machine-readable summary");
}

function summary(ir: MigrationIR, extra: Record<string, unknown> = {}) {
  return { version: VERSION, sdkVersion: SDK_VERSION,
    counts: { agents: ir.agents.length, skills: ir.skills.length, dependencies: ir.skills.filter(s => s.dependency).length, scripts: ir.scripts.length },
    agents: ir.agents.map(a => a.id), skills: ir.skills.map(s => s.id), tools: ir.scripts.map(s => s.id),
    findings: ir.findings, ...extra };
}

common(program.command("convert").argument("<input...>", "Agent files, directories, skills, or tstack repository"))
  .option("--out <dir>", "New output directory", "./my-agent")
  .option("--dry-run", "Build a complete plan without writing or validating")
  .option("--no-validate", "Skip installed SDK validation")
  .action(async (inputs: string[], raw) => {
    const opts = options(raw);
    const out = resolve(raw.out);
    const ir = await scanInputs(inputs, opts);
    if (!ir.agents.length && !ir.skills.length) throw new Error("No Claude agents or SKILL.md assets found.");
    const initial: ValidationResult = { status: "skipped", command: "agent-sdk validate", message: raw.dryRun ? "Dry run: no files written and no validation executed." : "Validation not requested." };
    const plan = await planProject(ir, opts, initial);
    let validation = initial;
    if (!raw.dryRun) {
      await writeProject(out, plan.files);
      if (raw.validate) validation = await validateProject(out);
      const report = opts.lang === "zh" ? "MIGRATION.zh-CN.md" : "MIGRATION.en.md";
      await writeFile(join(out, report), renderReport(plan.ir, opts, validation));
    }
    const result = summary(plan.ir, { out, dryRun: !!raw.dryRun, files: [...plan.files.keys()], validation });
    if (raw.json) console.log(JSON.stringify(result, null, 2));
    else {
      const zh = opts.lang === "zh";
      console.log(`cc2agent v${VERSION} → @grok/agent-sdk ${SDK_VERSION}`);
      console.log(`${zh ? "扫描" : "Scanned"}: ${ir.agents.length} agents, ${ir.skills.length} skills, ${ir.scripts.length} script stubs`);
      const concerns = plan.ir.findings.filter(f => f.status !== "mapped");
      console.log(`${concerns.length} ${zh ? "项迁移提醒；逐字段说明见报告。" : "migration concerns; see the field-by-field report."}`);
      console.log(`${raw.dryRun ? "DRY RUN" : out}: ${plan.files.size} files`);
      console.log(`${zh ? "自检" : "Validation"}: ${validation.status} — ${validation.message}`);
      if (!raw.dryRun) {
        console.log(`${out}/${zh ? "MIGRATION.zh-CN.md" : "MIGRATION.en.md"}`);
        console.log(`${zh ? "下一步" : "Next"}: cd ${JSON.stringify(out)} && npm install && npx agent-sdk login && npm run dev`);
      }
    }
    if (validation.status === "failed") process.exitCode = 1;
  });

common(program.command("inspect").argument("<input...>"))
  .action(async (inputs: string[], raw) => {
    const opts = options(raw);
    const ir = await scanInputs(inputs, opts);
    if (raw.json) console.log(JSON.stringify(summary(ir), null, 2));
    else console.log(renderReport(ir, opts, { status: "skipped", command: "", message: "Inspection only; no output written." }));
  });

program.command("doctor").option("--dir <project>", "Agent SDK project", ".").option("--json")
  .action(async raw => {
    const sdk = await findSdk(raw.dir);
    const node = { version: process.versions.node, supported: supportedNode(), required: ">=22.13" };
    const validation = node.supported ? await validateProject(raw.dir, sdk) : { status: "failed", message: "Node >=22.13 is required." };
    const result = { node, sdkInstalled: !!sdk, validation };
    console.log(raw.json ? JSON.stringify(result, null, 2) : `Node ${node.version}: ${node.supported ? "PASS" : "FAIL"}\nAgent SDK: ${sdk ? "installed" : "unavailable"}\n${validation.status}: ${validation.message}`);
    if (validation.status !== "passed") process.exitCode = 1;
  });

program.command("demo").argument("<name>", "full-send | pr-review").option("--out <dir>").option("--json").option("--no-validate")
  .action(async (name: string, raw) => {
    if (!["full-send", "pr-review"].includes(name)) throw new Error("Unknown demo. Choose full-send or pr-review.");
    const root = fileURLToPath(new URL(`../demos/${name}/`, import.meta.url));
    const files = new Map<string, string | Buffer>();
    for (const source of await listSafeFiles(root)) {
      files.set(relative(root, source).split(sep).join("/"), await readSafeFile(source));
    }
    const out = resolve(raw.out ?? `./${name}-agent`);
    await writeProject(out, files);
    const validation = raw.validate ? await validateProject(out) : { status: "skipped" };
    console.log(raw.json ? JSON.stringify({ demo: name, out, files: [...files.keys()], validation }, null, 2)
      : `${basename(out)}: ${files.size} files\n${validation.status}\ncd ${JSON.stringify(out)} && npm install && npx agent-sdk validate`);
    if (validation.status === "failed") process.exitCode = 1;
  });

try {
  if (!supportedNode()) throw new Error("cc2agent requires Node >=22.13.");
  await program.parseAsync();
} catch (error) {
  const message = error instanceof Error ? error.message : "Unexpected conversion error.";
  if (process.argv.includes("--json")) console.error(JSON.stringify({ error: message }));
  else console.error(`cc2agent: ${message}`);
  process.exitCode = 1;
}
