import { readFile } from "node:fs/promises";
import { posix, relative, sep } from "node:path";
import { stringify } from "yaml";
import { SDK_VERSION, type ConvertOptions, type Finding, type MigrationIR, type ProjectPlan, type ValidationResult } from "../ir.js";
import { listSafeFiles, readSafeFile } from "../scan/safety.js";
import { assertId, literal, markdown } from "./common.js";
import { renderEvalConfig, renderSkillEvals, renderSubagentEvals } from "./evals.js";
import { renderReport } from "./report.js";
import { renderSubagent } from "./subagent.js";
import { renderToolStub } from "./tool-stub.js";
import { associatedTstackLicense, type TstackLicense } from "./tstack-license.js";

const MAX_PROJECT_BYTES = 128 * 1024 * 1024;

function packageName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9-]+/gu, "-").replace(/^-+|-+$/gu, "").slice(0, 214) || "converted-agent";
}

function addFinding(ir: MigrationIR, finding: Finding): void {
  if (!ir.findings.some((item) => item.source === finding.source && item.field === finding.field && item.message === finding.message)) ir.findings.push(finding);
}

function skillPreloadHints(ir: MigrationIR, options: ConvertOptions): { root: string; agents: Map<string, string> } {
  const agents = new Map<string, string>();
  const rootLines: string[] = [];
  for (const agent of ir.agents) {
    const raw = agent.frontmatter.skills;
    if (raw === undefined) continue;
    if (!Array.isArray(raw) || !raw.every((item) => typeof item === "string" && !!item.trim())) {
      addFinding(ir, { source: agent.source, field: "[skills preload hint]", status: "degraded", message: "skills 不是有效的字符串数组，未生成加载提示。请检查原字段并手动配置共享 skill。", messageEn: "skills is not a valid array of names; no load hint was generated. Review the source field and configure shared skills manually." });
      continue;
    }
    if (!raw.length) continue;
    const matches = raw.map((name: string) => ({ name, skill: ir.skills.find((skill) => skill.id === name || skill.frontmatter.name === name) }));
    const available = matches.flatMap(({ skill }) => skill ? [skill.id] : []);
    const missing = matches.filter(({ skill }) => !skill).map(({ name }) => name);
    const list = available.map((id) => `\`${id}\``).join(", ");
    const hint = options.lang === "zh"
      ? `Claude 的 skills 预加载没有原生等价行为。${available.length ? `需要时请根代理先加载共享 skill：${list}，再委派给本子代理。` : "没有找到对应的已迁移共享 skill。"}${missing.length ? ` 尚未一并迁移：${missing.map(markdown).join(", ")}；请先补充这些 skill。` : ""} 这只是提示，不是自动预加载或权限隔离。`
      : `Claude skill preloading has no native equivalent. ${available.length ? `When needed, ask the root agent to load shared skills ${list} before delegating to this subagent.` : "No corresponding migrated shared skill was found."}${missing.length ? ` Missing from this conversion: ${missing.map(markdown).join(", ")}; convert these skills first.` : ""} This is a hint, not automatic preloading or permission isolation.`;
    agents.set(agent.id, `\n\n<!-- cc-to-cursor-agent migration hint -->\n${hint}\n`);
    rootLines.push(`- \`${agent.id}\`: ${hint}`);
    addFinding(ir, { source: agent.source, field: "[skills preload hint]", status: "degraded", target: `bot/subagents/${agent.id}/instructions.md; bot/instructions.md`, message: `已添加共享 skill 加载提示；不是自动预加载。${missing.length ? " 部分引用 skill 未包含在本次输入中，请一并转换。" : ""}`, messageEn: `Added shared-skill load hints, not automatic preloading.${missing.length ? " Some referenced skills are absent; convert them as well." : ""}` });
  }
  return { root: rootLines.length ? `\n## ${options.lang === "zh" ? "子代理 skill 加载提示" : "Subagent skill loading hints"}\n\n${rootLines.join("\n")}\n` : "", agents };
}

export async function planProject(source: MigrationIR, options: ConvertOptions, validation?: ValidationResult): Promise<ProjectPlan> {
  // Planning is pure with respect to the input IR and output filesystem.
  const ir = structuredClone(source);
  const files = new Map<string, string | Buffer>();
  const pathKeys = new Set<string>();
  let totalBytes = 0;
  const add = (path: string, contents: string | Buffer): void => {
    if (path.includes("\\") || posix.isAbsolute(path) || path.split("/").some((part) => part === ".." || part === "." || part === "")) throw new Error(`Unsafe output path: ${JSON.stringify(path)}`);
    // Refuse case-folded collisions too: generated projects must be portable to macOS/Windows.
    const key = path.normalize("NFC").toLowerCase();
    if (pathKeys.has(key)) throw new Error(`Output path collision: ${JSON.stringify(path)}`);
    const bytes = typeof contents === "string" ? Buffer.byteLength(contents, "utf8") : contents.length;
    if (totalBytes + bytes > MAX_PROJECT_BYTES) throw new Error("Generated project exceeds the 128 MiB size limit. Split the conversion into smaller inputs.");
    totalBytes += bytes;
    pathKeys.add(key);
    files.set(path, contents);
  };
  for (const [kind, assets] of [["subagent", ir.agents], ["skill", ir.skills], ["tool", ir.scripts]] as const) {
    const seen = new Set<string>();
    for (const asset of assets) {
      assertId(asset.id, kind);
      const key = asset.id.toLowerCase();
      if (seen.has(key)) throw new Error(`Duplicate ${kind} id: ${asset.id}`);
      seen.add(key);
    }
  }
  add("package.json", JSON.stringify({
    name: packageName(options.name), version: "0.1.0", private: true, type: "module",
    engines: { node: ">=22.13" },
    scripts: { dev: "agent-sdk dev", validate: "agent-sdk validate --dir .", eval: "agent-sdk eval --dir ." },
    dependencies: { "@grok/agent-sdk": SDK_VERSION, zod: "^3.25.0" },
  }, null, 2) + "\n");
  add(".gitignore", "node_modules/\n.env\n.env.*\n!.env.example\n.agent-sdk/\n.agent-serve/\n.cursor/\n");
  add("bot/agent.ts", [
    'import { defineAgent } from "@grok/agent-sdk";', "", "export default defineAgent({",
    `  name: ${literal(options.name)},`, "  local: { sandbox: true },",
    ...(options.rootTools === undefined ? [] : [`  tools: ${literal(options.rootTools)},`]),
    "});", "",
  ].join("\n"));
  const template = await readFile(new URL(`../../templates/${options.lang}/instructions.md`, import.meta.url), "utf8");
  const preloadHints = skillPreloadHints(ir, options);
  const delegation = ir.agents.length
    ? (options.lang === "zh" ? "\n## 可委派的子代理\n\n" : "\n## Available subagents\n\n") + ir.agents.map((agent) => `- \`${agent.id}\`: ${agent.description.replace(/[\r\n]+/gu, " ")}`).join("\n") + "\n"
    : "";
  add("bot/instructions.md", template.replaceAll("{{name}}", options.name) + delegation + preloadHints.root);
  for (const agent of ir.agents) {
    const hint = preloadHints.agents.get(agent.id) ?? "";
    if (hint) {
      const bodyFinding: Finding = { source: agent.source, field: "$body", status: "degraded", target: `bot/subagents/${agent.id}/instructions.md`,
        message: "保留原文，正文末尾追加共享 skill 预加载提示（`<!-- cc-to-cursor-agent migration hint -->`）；输出正文并非逐字不变。提示不实现自动预加载。",
        messageEn: "Original text retained, with a shared-skill preload hint appended after `<!-- cc-to-cursor-agent migration hint -->`; the output body is not byte-for-byte unchanged. The hint does not implement automatic preloading." };
      // Replace both inventories so the report cannot retain a contradictory scan-time conclusion.
      ir.findings = ir.findings.filter(f => !(f.source === agent.source && f.field === "$body"));
      agent.findings = agent.findings.filter(f => f.field !== "$body");
      ir.findings.push(bodyFinding);
      agent.findings.push(bodyFinding);
    }
    add(`bot/subagents/${agent.id}/agent.ts`, renderSubagent(agent, options));
    add(`bot/subagents/${agent.id}/instructions.md`, agent.body + hint);
  }
  const tstackSources = new Map<string, { license: TstackLicense; skills: string[] }>();
  for (const skill of ir.skills) {
    const license = await associatedTstackLicense(skill);
    if (license) {
      const source = tstackSources.get(license.root) ?? { license, skills: [] };
      source.skills.push(skill.id);
      tstackSources.set(license.root, source);
      addFinding(ir, { source: license.source, field: "[tstack license]", status: "mapped", target: "LICENSE-tstack; TSTACK-PROVENANCE.json", message: "已核对并保留 t3dotgg/tstack 的 Theo Browne MIT 版权与许可全文；不表示官方关联或背书。当前本地输入的 Git 版本未核实，见来源记录。", messageEn: "Verified and preserved the complete Theo Browne MIT copyright and license from t3dotgg/tstack; no affiliation or endorsement is implied. The input's Git revision is unverified; see provenance." });
    }
    const safeFiles = await listSafeFiles(skill.directory, (path, reason) => {
      addFinding(ir, { source: path, field: "[excluded path]", status: "dropped", message: `辅助目录未复制：${reason}。如确有需要，请人工审核后添加。`, messageEn: `Supporting directory excluded: ${reason}. Review and add manually if required.` });
    });
    const frontmatter = { ...skill.frontmatter, name: skill.id, description: skill.description };
    add(`bot/skills/${skill.id}/SKILL.md`, `---\n${stringify(frontmatter).trimEnd()}\n---\n${skill.body}`);
    for (const file of safeFiles) {
      const localPath = relative(skill.directory, file).split(sep).join("/");
      if (localPath === "SKILL.md") continue;
      add(`bot/skills/${skill.id}/${localPath}`, await readSafeFile(file));
      addFinding(ir, { source: file, field: "[supporting file]", status: "mapped", target: `bot/skills/${skill.id}/${localPath}`, message: "原样复制辅助文件；复制不表示自动执行或支持其运行时元数据。", messageEn: "Supporting file copied unchanged; copying does not execute it or imply support for its runtime metadata." });
    }
  }
  if (tstackSources.size) {
    const sources = [...tstackSources.values()];
    add("LICENSE-tstack", sources[0]!.license.bytes);
    add("TSTACK-PROVENANCE.json", JSON.stringify({
      repository: "https://github.com/t3dotgg/tstack", license: "MIT", copyright: "Copyright (c) 2026 Theo Browne",
      sourceRevision: "unverified", outputLicenseSha256: sources[0]!.license.sha256,
      modifications: "Skill frontmatter normalized; source bodies and supporting files retained; disabled script stubs and routing evals generated. See the migration report.",
      inputs: sources.map(({ license, skills }) => ({ directory: license.root, licenseSha256: license.sha256, skills })),
    }, null, 2) + "\n");
    add("THIRD_PARTY_NOTICES.md", options.lang === "zh"
      ? "# 第三方声明\n\n本项目包含来自 [t3dotgg/tstack](https://github.com/t3dotgg/tstack) 的 skills，Copyright (c) 2026 Theo Browne，按 MIT 许可提供；许可全文见 [LICENSE-tstack](LICENSE-tstack)。与 Theo Browne / T3 无官方关联或背书关系。当前输入版本未核实；转换改动与本地来源见 TSTACK-PROVENANCE.json 及迁移报告。\n\n@grok/agent-sdk 仅作为依赖引用，使用受其许可证及 Cursor 服务条款约束。\n"
      : "# Third-party notices\n\nThis project includes skills from [t3dotgg/tstack](https://github.com/t3dotgg/tstack), Copyright (c) 2026 Theo Browne, under the MIT license; the full notice is in [LICENSE-tstack](LICENSE-tstack). No official affiliation or endorsement by Theo Browne / T3 is implied. The input revision is unverified; see TSTACK-PROVENANCE.json and the migration report for local sources and conversion changes.\n\n@grok/agent-sdk is referenced only as a dependency and remains subject to its own license and Cursor terms.\n");
  }
  for (const script of ir.scripts) {
    assertId(script.skillId, "skill");
    if (!ir.skills.some((skill) => skill.id === script.skillId)) throw new Error(`Script ${script.id} references missing skill ${script.skillId}`);
    add(`bot/tools/${script.id}.ts`, renderToolStub(script, options));
    addFinding(ir, { source: script.source, field: "[script tool]", status: "degraded", target: `bot/tools/${script.id}.ts`, message: "已生成 execution: agent 的禁用存根，始终返回 TODO 错误。审核原脚本、补齐参数 schema 与 JSON stdin/stdout 协议后再启用；agent tool 需要 shell，且不支持 effect / dryRunResult / needsApproval。", messageEn: "Generated a disabled execution: agent stub that always returns a TODO error. Review the original script and implement a typed JSON stdin/stdout contract before enabling. Agent tools require shell and do not support effect / dryRunResult / needsApproval." });
  }
  if (options.rootTools && ir.agents.length && !options.rootTools.includes("task")) addFinding(ir, { source: "bot/agent.ts", field: "tools", status: "degraded", message: "显式根工具白名单未包含 task，子代理不能被委派，生成的委派 eval 会失败。请按需要添加 task。", messageEn: "The explicit root allowlist omits task, so subagents cannot be delegated to and delegation evals will fail. Add task if needed." });
  if (options.rootTools && ir.scripts.length && !options.rootTools.includes("shell")) addFinding(ir, { source: "bot/agent.ts", field: "tools", status: "degraded", message: "显式根工具白名单未包含 shell，agent 脚本工具不能运行。实现并审核工具后，再决定是否添加 shell。", messageEn: "The explicit root allowlist omits shell, so agent script tools cannot run. Decide whether to add shell after implementing and reviewing them." });
  add("evals/evals.config.ts", renderEvalConfig());
  if (ir.skills.length) add("evals/skills.eval.ts", renderSkillEvals(ir, options));
  if (ir.agents.length) add("evals/subagents.eval.ts", renderSubagentEvals(ir, options));
  add(options.lang === "zh" ? "MIGRATION.zh-CN.md" : "MIGRATION.en.md", renderReport(ir, options, validation));
  return { files, ir };
}
