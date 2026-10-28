import type { AgentAsset, ConvertOptions, Finding } from "../ir.js";
import { fieldPaths } from "../scan/frontmatter.js";
import { mapSubagent } from "./subagent.js";

export function mapCodexAgent(source: string, config: Record<string, unknown>, options: ConvertOptions): AgentAsset {
  const core = { name: config.name, description: config.description,
    ...(Object.hasOwn(config, "model") ? { model: config.model } : {}) };
  const asset = mapSubagent(source, { frontmatter: core, body: config.developer_instructions as string }, options);
  asset.sourceFormat = "codex";
  asset.frontmatter = config;
  // Reuse the shared name/model/body mappings, not Claude-specific field semantics.
  for (const [key, value] of Object.entries(config)) {
    if (Object.hasOwn(core, key)) continue;
    let rule: Omit<Finding, "field"> = { source, status: "dropped",
      message: "目标 SDK 无已核实的 Codex 等价字段；未写入配置，请人工实现其语义。",
      messageEn: "No verified SDK equivalent for this Codex field; omitted from configuration. Implement its semantics manually." };
    if (key === "developer_instructions") rule = { source, status: "mapped", target: `bot/subagents/${asset.id}/instructions.md`,
      message: "TOML 指令字符串已写入 instructions.md；保留解析后的文本，不包含 TOML 引号。",
      messageEn: "Wrote the parsed TOML instruction string to instructions.md unchanged, without TOML quoting." };
    if (["model_reasoning_effort", "model_reasoning_summary", "model_verbosity"].includes(key)) rule = { source, status: "dropped",
      message: "Codex 模型参数未映射；模型 ID 映射不包含推理强度、摘要或详细度。请按目标模型支持的参数人工配置并验证。",
      messageEn: "Codex model settings were not mapped; model-ID mapping does not include reasoning effort, summary, or verbosity. Configure and verify supported target-model parameters manually." };
    if (["features", "skills", "tools", "disallowedTools"].includes(key)) rule = { source, status: "degraded",
      message: "Codex 子代理能力或 skill 限制未生效；SDK 子代理共享执行环境和 skills，不能假定根白名单会约束 task 子代理。请人工重建限制，必要时拆为独立代理或禁用 task。未加载任何引用的配置或 skill 文件。",
      messageEn: "Codex per-agent capability or skill restrictions are not enforced. SDK subagents share the execution environment and skills; do not assume root allowlists constrain task children. Rebuild restrictions manually, use separate agents, or disable task. No referenced configuration or skill files were loaded." };
    if (["sandbox_mode", "approval_policy", "sandbox_workspace_write", "permissions", "model_provider", "mcp_servers", "service_tier"].includes(key)) rule = { source, status: "dropped",
      message: "这是父会话配置，不是 Codex 独立子代理的有效覆盖项；未迁移父会话的权限、provider 或 MCP 连接。请在目标项目人工配置并验证，local.sandbox 不等于原有权限边界。",
      messageEn: "This is parent-session configuration, not an effective standalone Codex agent override. Parent permissions, provider, and MCP connections were not migrated. Configure and verify them in the target project; local.sandbox is not an equivalent permission boundary." };
    for (const field of fieldPaths({ [key]: value })) asset.findings.push({ ...rule, field });
  }
  asset.findings.push({ source, field: "$context", status: "degraded",
    message: "仅迁移独立子代理文件；未读取父会话 config.toml、AGENTS.md 或个人配置，未解析旧式 agents.<name>.config_file。请一并转换所需 skills，并人工补充上下文。",
    messageEn: "Only the standalone agent file is migrated. Parent config.toml, AGENTS.md, personal configuration, and legacy agents.<name>.config_file declarations are not loaded. Convert required skills and add inherited context manually." });
  return asset;
}
