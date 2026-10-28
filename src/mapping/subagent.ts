import path from "node:path";
import type { AgentAsset, ConvertOptions, Finding } from "../ir.js";
import { fieldPaths, type ParsedMarkdown } from "../scan/frontmatter.js";
import { scanForeignTools } from "./foreign-tools.js";
import { mapModel } from "./model.js";
import { slugName } from "./names.js";
import { mapToolNames } from "./tools-names.js";

export function mapSubagent(source: string, parsed: ParsedMarkdown, options: ConvertOptions): AgentAsset {
  const { frontmatter, body } = parsed;
  const sourceName = typeof frontmatter.name === "string" ? frontmatter.name : path.basename(source, path.extname(source));
  const id = slugName(sourceName, "agent");
  const hasDescription = typeof frontmatter.description === "string" && !!frontmatter.description.trim();
  const description = hasDescription ? (frontmatter.description as string).trim()
    : options.lang === "zh" ? `迁移的 ${id} 子代理；请补充具体用途和委派时机。` : `Migrated ${id} subagent; describe its purpose and when to delegate.`;
  const findings: Finding[] = [];
  let model: string | undefined;
  const topRules = new Map<string, Finding>();
  for (const field of Object.keys(frontmatter)) {
    let finding: Finding = { source, field, status: "dropped", message: "目标 SDK 无已核实的等价字段；未写入配置，请人工实现其语义。", messageEn: "No verified SDK equivalent; omitted from configuration. Implement its semantics manually." };
    if (field === "name") finding = { source, field, status: id === frontmatter.name ? "mapped" : "degraded", target: `bot/subagents/${id}/`, message: "用于子代理目录 ID；不合法字符已规范化。", messageEn: "Used as the subagent directory ID; unsupported characters are normalized." };
    if (field === "description") finding = { source, field, status: hasDescription ? "mapped" : "degraded", target: "agent.ts:description", message: hasDescription ? "已映射为委派描述。" : "原描述无效，已生成占位描述；请补充触发条件。", messageEn: hasDescription ? "Mapped to the delegation description." : "Invalid description replaced with a placeholder; add delegation triggers." };
    if (field === "model") { const mapped = mapModel(frontmatter.model, source, options); model = mapped.model; finding = mapped.finding; }
    if (field === "tools" || field === "disallowedTools") {
      const tools = mapToolNames(frontmatter[field]);
      const suggestions = tools.mapped.length ? ` (${tools.mapped.join(", ")})` : "";
      finding = { source, field, status: "degraded", message: `危险：子代理工具限制未生效，task 子代理保留 harness 自己的工具集；不能假定根白名单会约束子代理。工具名参考映射${suggestions}；若必须强制只读，需使用独立代理或禁用 task，并另行约束执行环境；shell 可写入。`, messageEn: `Security boundary lost: task children retain the harness task-tool toolset; do not assume root allowlists constrain them. Reference name mapping${suggestions}. For enforced read-only access use separate agents or disable task and constrain execution separately; shell can write.` };
      if (tools.unknown.length) finding.message += " 部分工具名无已核实映射。";
      if (tools.unknown.length) finding.messageEn += " Some tool names have no verified mapping.";
    }
    if (field === "permissionMode") finding = { source, field, status: "dropped", message: "Claude 权限模式未迁移。local.sandbox 和 tool 审批不等价，必须人工设置权限。", messageEn: "Claude permission mode was not migrated. local.sandbox and tool approval are not equivalents; configure permissions manually." };
    if (field === "hooks") finding = { source, field, status: "dropped", message: "未迁移 hooks；SDK 观察型 hook 不能复现 Claude 的拦截语义。", messageEn: "Hooks were not migrated; SDK observer hooks cannot reproduce Claude interception semantics." };
    if (field === "mcpServers") finding = { source, field, status: "dropped", message: "未创建 MCP connection；请在 bot/mcp-connections/ 人工配置并验证认证。", messageEn: "No MCP connection generated; configure bot/mcp-connections/ and verify authentication manually." };
    if (field === "skills") finding = { source, field, status: "degraded", message: "子代理不能单独预加载 skill；请一并转换依赖 skill，并明确提示根代理加载。", messageEn: "Per-subagent skill preloading is unavailable; convert dependencies and explicitly instruct the root agent to load them." };
    if (field === "memory") finding = { source, field, status: "dropped", message: "持久记忆未迁移；ctx.host.kv 需要重新设计数据和生命周期。", messageEn: "Persistent memory was not migrated; ctx.host.kv requires explicit data and lifecycle design." };
    topRules.set(field, finding);
  }
  for (const field of fieldPaths(frontmatter)) {
    const root = [...topRules.keys()].sort((a, b) => b.length - a.length).find((key) => field === key || field.startsWith(`${key}.`))!;
    const rule = topRules.get(root)!;
    findings.push({ ...rule, field });
  }
  if (!("name" in frontmatter)) findings.push({ source, field: "name", status: "degraded", target: `bot/subagents/${id}/`, message: "缺少 name，已从文件名生成 ID。", messageEn: "Missing name; generated the ID from the filename." });
  if (!("description" in frontmatter)) findings.push({ source, field: "description", status: "degraded", target: "agent.ts:description", message: "缺少 description，已生成占位描述；请补充委派时机。", messageEn: "Missing description; generated a placeholder. Add delegation triggers." });
  findings.push({ source, field: "$body", status: "mapped", target: `bot/subagents/${id}/instructions.md`, message: "正文原样迁移；工具和运行时引用需按下列提示复核。", messageEn: "Body preserved; review tool and runtime references below." }, ...scanForeignTools(body, source));
  return { id, source, sourceFormat: "claude", body, frontmatter, description, model, findings };
}
