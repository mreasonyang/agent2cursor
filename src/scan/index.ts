import path from "node:path";
import os from "node:os";
import { lstat, readdir } from "node:fs/promises";
import type { ConvertOptions, MigrationIR, SkillAsset } from "../ir.js";
import { mapSubagent } from "../mapping/subagent.js";
import { mapCodexAgent } from "../mapping/codex-agent.js";
import { mapCodexSkillMetadata } from "../mapping/codex-skill.js";
import { mapSkill } from "../mapping/skill.js";
import { scriptName } from "../mapping/names.js";
import { scanForeignTools } from "../mapping/foreign-tools.js";
import { parseMarkdown, parseYamlMapping } from "./frontmatter.js";
import { parseCodexAgent } from "./codex.js";
import { assertSafePath, isSensitiveName, listSafeFiles, MAX_FILES, readSafeText, SKIP_DIRECTORIES } from "./safety.js";
import { dependencyInfo } from "./tstack.js";

function expandHome(input: string): string { return input === "~" ? os.homedir() : input.startsWith("~/") ? path.join(os.homedir(), input.slice(2)) : input; }
async function exists(file: string): Promise<boolean> {
  try { await lstat(file); return true; } catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return false; throw error; }
}

export async function scanInputs(inputs: string[], options: ConvertOptions): Promise<MigrationIR> {
  if (!inputs.length) throw new Error("At least one input is required.");
  const ir: MigrationIR = { agents: [], skills: [], scripts: [], findings: [] };
  const seen = new Map<string, "agent" | "skill">();
  const visitedDirectories = new Set<string>();
  const claimedNames = new Map<string, string>();
  let visitedEntries = 0;
  let assetFiles = 0;

  function claim(kind: "agent" | "skill" | "script", id: string, source: string): void {
    const key = `${kind}:${id.toLowerCase()}`;
    const existing = claimedNames.get(key);
    if (existing && existing !== source) throw new Error(`Name collision after normalization (${key}): ${existing} and ${source}`);
    claimedNames.set(key, source);
  }
  function addSkipped(file: string, reason: string): void {
    ir.findings.push({ source: file, field: "$files", status: "dropped", message: "已跳过生成文件、依赖、缓存、版本管理或敏感路径，未读取其内容。", messageEn: reason });
  }

  async function addAgent(file: string, format: "claude" | "codex"): Promise<void> {
    const source = await assertSafePath(file);
    if (seen.has(source)) return;
    const text = await readSafeText(source);
    const asset = format === "codex"
      ? mapCodexAgent(source, parseCodexAgent(text, source), options)
      : mapSubagent(source, parseMarkdown(text, source), options);
    claim("agent", asset.id, source);
    seen.set(source, "agent");
    ir.agents.push(asset);
    ir.findings.push(...asset.findings);
  }

  async function addSkill(directory: string, dependency = false): Promise<SkillAsset> {
    const source = await assertSafePath(path.join(directory, "SKILL.md"));
    const existing = ir.skills.find((skill) => skill.source === source);
    if (existing) { if (!dependency) existing.dependency = false; return existing; }
    const asset = mapSkill(source, parseMarkdown(await readSafeText(source), source), options, dependency);
    claim("skill", asset.id, source);
    seen.set(source, "skill");
    ir.skills.push(asset);
    ir.findings.push(...asset.findings);
    for (const file of await listSafeFiles(directory, addSkipped)) {
      if (++assetFiles > MAX_FILES) throw new Error(`Skill assets exceed ${MAX_FILES} files; select narrower inputs.`);
      const relativePath = path.relative(directory, file).split(path.sep).join("/");
      if (relativePath === "SKILL.md") continue;
      if (relativePath.startsWith("scripts/")) {
        const id = scriptName(relativePath.slice("scripts/".length));
        claim("script", id, file);
        ir.scripts.push({ id, source: file, skillId: asset.id, relativePath });
        ir.findings.push({ source: file, field: "$script", status: "degraded", target: `bot/tools/${id}.ts`, message: "保留原脚本并生成禁用的 JSON 工具存根；需人工实现 stdin/stdout 契约后启用，转换不会执行脚本。", messageEn: "Original script preserved and a disabled JSON tool stub generated; implement its stdin/stdout contract before enabling. Conversion never executes scripts." });
        if ((await lstat(file)).mode & 0o111) ir.findings.push({ source: file, field: "$permissions", status: "degraded", message: "原脚本有可执行位；生成项目仅复制文件内容，不保留执行权限。若需直接运行脚本，请审核后恢复权限或显式调用解释器。", messageEn: "The source script is executable. Generated files preserve content but not executable permission; after review, restore permissions or invoke the interpreter explicitly." });
      }
      if (relativePath === "agents/openai.yaml") {
        const metadata = parseYamlMapping(await readSafeText(file), file);
        const mapped = mapCodexSkillMetadata(file, metadata, asset.id);
        asset.trigger = mapped.trigger;
        asset.findings.push(...mapped.findings);
        ir.findings.push(...mapped.findings);
      }
      if (/\.md$/i.test(file)) ir.findings.push(...scanForeignTools(await readSafeText(file), file));
      ir.findings.push({ source: file, field: "$file", status: "mapped", target: `bot/skills/${asset.id}/${relativePath}`, message: "附属文件原样保留；保留文件不代表自动赋予工具能力。", messageEn: "Supporting file preserved unchanged; copying does not make it a callable tool." });
    }
    return asset;
  }

  type AgentTree = "claude" | "codex" | "mixed" | undefined;
  async function discover(file: string, inAgentTree: AgentTree, explicit: boolean, depth: number): Promise<void> {
    if (depth > 32) throw new Error(`Input nesting exceeds 32 directories: ${file}`);
    const absolute = await assertSafePath(file);
    const stat = await lstat(absolute);
    if (stat.isFile()) {
      if (path.basename(absolute) === "SKILL.md") await addSkill(path.dirname(absolute));
      else if (/\.md$/i.test(absolute) && (explicit || (inAgentTree && inAgentTree !== "codex"))) await addAgent(absolute, "claude");
      else if (/\.toml$/i.test(absolute) && (explicit || (inAgentTree && inAgentTree !== "claude"))) {
        if (path.basename(absolute) === "config.toml" && path.basename(path.dirname(absolute)) === ".codex") throw new Error(`Session config.toml is not supported; pass standalone Codex agent TOML files with name, description, and developer_instructions: ${absolute}`);
        await addAgent(absolute, "codex");
      } else if (explicit) throw new Error(`Expected a Markdown agent, standalone Codex TOML agent, or a skill directory: ${absolute}`);
      return;
    }
    if (!stat.isDirectory()) throw new Error(`Special files are not permitted: ${absolute}`);
    if (visitedDirectories.has(absolute)) return;
    visitedDirectories.add(absolute);
    if (await exists(path.join(absolute, "SKILL.md"))) { await addSkill(absolute); return; }
    const parent = path.basename(path.dirname(absolute));
    const agentTree: AgentTree = path.basename(absolute) === "agents"
      ? parent === ".codex" ? "codex" : parent === ".claude" ? "claude" : inAgentTree ?? "mixed"
      : inAgentTree;
    for (const entry of (await readdir(absolute, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
      const child = path.join(absolute, entry.name);
      if (++visitedEntries > MAX_FILES) throw new Error(`Scan exceeds ${MAX_FILES} entries; select narrower inputs.`);
      if (entry.isSymbolicLink()) throw new Error(`Symbolic links are not permitted: ${child}`);
      if (isSensitiveName(entry.name)) { addSkipped(child, "Sensitive path omitted from project discovery without reading it."); continue; }
      if (entry.isDirectory() && SKIP_DIRECTORIES.has(entry.name)) { addSkipped(child, "Generated, dependency, cache, or version-control directory omitted."); continue; }
      if (entry.name === "config.toml" && path.basename(absolute) === ".codex") {
        ir.findings.push({ source: child, field: "$session-config", status: "dropped",
          message: "未读取 Codex 父会话配置；仅支持独立子代理 TOML 和 skill 目录。旧式 agents.<name>.config_file 声明未解析。",
          messageEn: "Codex parent-session configuration was not read. Only standalone agent TOML and skill directories are supported; legacy agents.<name>.config_file declarations are not resolved." });
        continue;
      }
      if (entry.isDirectory() || /\.md$/i.test(entry.name) || (agentTree && agentTree !== "claude" && /\.toml$/i.test(entry.name))) await discover(child, agentTree, false, depth + 1);
      else if (!entry.isFile()) throw new Error(`Special files are not permitted: ${child}`);
    }
  }

  for (const input of inputs) await discover(expandHome(input), undefined, true, 0);
  if (options.withDeps) {
    // The growing queue computes the transitive closure and seen sources break cycles.
    for (let index = 0; index < ir.skills.length; index++) {
      const skill = ir.skills[index]!;
      const info = await dependencyInfo(skill.directory, skill.id);
      if (!info.names.length) continue;
      ir.findings.push({ source: skill.source, field: "$dependencies", status: info.fallback ? "degraded" : "mapped", message: info.fallback ? `按已核实的 tstack 快照补齐同级依赖；源文件未附 README，需确认同名技能的来源。依据：${info.basis}` : `按源 README 补齐同级依赖。依据：${info.basis}`, messageEn: info.fallback ? `Resolved sibling dependencies using the pinned tstack graph; source README unavailable, so verify the provenance of same-named skills. Basis: ${info.basis}` : `Resolved sibling dependencies from the source README. Basis: ${info.basis}` });
      for (const name of info.names) {
        const directory = path.join(path.dirname(skill.directory), name);
        if (!await exists(path.join(directory, "SKILL.md"))) throw new Error(`Missing dependency '${name}' for '${skill.id}': ${directory}`);
        await addSkill(directory, true);
      }
    }
  }
  if (!ir.agents.length && !ir.skills.length) throw new Error("No Claude agents, Codex standalone agents, or SKILL.md directories found. Pass agent .md/.toml files explicitly or select .claude/agents or .codex/agents.");
  ir.agents.sort((a, b) => a.id.localeCompare(b.id));
  ir.skills.sort((a, b) => a.id.localeCompare(b.id));
  ir.scripts.sort((a, b) => a.id.localeCompare(b.id));
  return ir;
}
