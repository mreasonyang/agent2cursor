import type { Finding } from "../ir.js";
import { fieldPaths } from "../scan/frontmatter.js";
import { scanForeignTools } from "./foreign-tools.js";

export function mapCodexSkillMetadata(source: string, metadata: Record<string, unknown>, skillId: string): { trigger?: string; findings: Finding[] } {
  const ui = metadata.interface;
  const rawTrigger = ui && typeof ui === "object" && !Array.isArray(ui) ? (ui as Record<string, unknown>).default_prompt : undefined;
  const trigger = typeof rawTrigger === "string" && rawTrigger.trim() ? rawTrigger : undefined;
  const copied = `bot/skills/${skillId}/agents/openai.yaml`;
  const findings: Finding[] = fieldPaths(metadata).map(field => {
    const base = { source, field, status: "degraded" as const, target: copied };
    if (field === "interface.default_prompt") return { ...base, status: trigger ? "mapped" : "degraded", target: "evals/skills.eval.ts",
      message: trigger ? "已用 Codex default_prompt 生成 eval 触发语；不改写其中的平台工具或路径引用。" : "未发现有效 default_prompt，将使用生成的 eval 触发语。",
      messageEn: trigger ? "Used Codex default_prompt as the eval trigger; platform-specific tool and path references are not rewritten." : "No valid default_prompt found; using a generated eval trigger." };
    if (field === "policy" || field.startsWith("policy.")) return { ...base,
      message: "仅保留调用策略元数据；SDK 不执行 Codex policy，包括 allow_implicit_invocation: false 的禁止自动调用语义。需人工限制触发流程；复制不保留此边界。",
      messageEn: "Invocation policy is retained as metadata only. The SDK does not enforce Codex policy, including the implicit-invocation restriction of allow_implicit_invocation: false. Constrain routing manually; copying does not preserve this boundary." };
    if (field === "dependencies" || field.startsWith("dependencies.")) return { ...base,
      message: "仅保留工具依赖声明；未连接 MCP、安装工具或转移认证。请在 bot/mcp-connections/ 人工配置所需连接，并核对名称、传输方式与权限。",
      messageEn: "Tool dependencies are declarations only; no MCP connections, tools, or authentication were installed or transferred. Configure required connections in bot/mcp-connections/ and verify names, transport, and permissions." };
    return { ...base,
      message: "仅原样保留 Codex 元数据文件；目标 SDK 未应用此 UI 或未知字段，需人工适配。",
      messageEn: "Preserved as Codex metadata only; the target SDK does not apply this UI or unknown field. Adapt it manually." };
  });
  if (!findings.some(finding => finding.field === "interface.default_prompt")) findings.push({ source, field: "interface.default_prompt", status: "degraded", target: "evals/skills.eval.ts",
    message: "未发现有效 default_prompt，将使用生成的 eval 触发语。", messageEn: "No valid default_prompt found; using a generated eval trigger." });
  if (trigger) findings.push(...scanForeignTools(trigger, source));
  return { trigger, findings };
}
