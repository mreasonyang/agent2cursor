import type { ConvertOptions, ScriptAsset } from "../ir.js";
import { assertId, literal, todo } from "./common.js";

// Constant shell source: no original file contents or source-controlled paths are executable.
export const DISABLED_TOOL_SCRIPT = [
  "#!/usr/bin/env sh",
  "# Disabled by cc2agent. Review the original script and implement the JSON contract first.",
  "cat >/dev/null",
  "printf '%s\\n' '{\"ok\":false,\"error\":\"CC2AGENT_STUB_DISABLED\",\"message\":\"TODO(cc2agent): review the original script and implement JSON stdin/stdout before enabling this tool.\"}'",
  "exit 78",
  "",
].join("\n");

export function renderToolStub(script: ScriptAsset, options: ConvertOptions): string {
  assertId(script.id, "tool");
  assertId(script.skillId, "skill");
  const description = options.lang === "zh"
    ? `禁用的迁移存根 ${script.id}。调用始终返回 CC2AGENT_STUB_DISABLED，绝不执行原脚本。请操作者先审查 .cursor/skills/${script.skillId}/${script.relativePath} 并实现 JSON 输入输出契约。`
    : `Disabled migration stub ${script.id}. Always returns CC2AGENT_STUB_DISABLED and never runs the original script. An operator must review .cursor/skills/${script.skillId}/${script.relativePath} and implement the JSON input/output contract first.`;
  return [
    'import { defineTool } from "@grok/agent-sdk/tools";',
    'import { z } from "zod";', "",
    "export default defineTool({",
    `  description: ${literal(description)},`,
    '  execution: "agent",',
    todo(options.lang === "zh" ? "按审核后的脚本参数收紧 schema；当前存根不会运行任何原脚本。" : "Replace this permissive schema with reviewed script arguments; the stub never runs original scripts."),
    "  inputSchema: z.object({}).passthrough(),",
    todo(options.lang === "zh" ? "agent 工具必须通过 shell 执行，不支持 effect / dryRunResult / needsApproval；需要这些保护时请实现 server 工具。" : "Agent tools require shell and do not support effect / dryRunResult / needsApproval; use a server tool when those controls are required."),
    `  script: ${literal(DISABLED_TOOL_SCRIPT)},`,
    "});", "",
  ].join("\n");
}
