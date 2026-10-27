import type { ConvertOptions, Finding, MigrationIR, ValidationResult } from "../ir.js";
import { SDK_VERSION } from "../ir.js";
import { markdown } from "./common.js";

const statusLabels = {
  zh: { mapped: "✅ 已映射", degraded: "⚠️ 降级", dropped: "❌ 丢弃" },
  en: { mapped: "✅ Mapped", degraded: "⚠️ Degraded", dropped: "❌ Dropped" },
};

function allFindings(ir: MigrationIR): Finding[] {
  const unique = new Map<string, Finding>();
  for (const finding of [...ir.findings, ...ir.agents.flatMap((a) => a.findings), ...ir.skills.flatMap((s) => s.findings)]) {
    const key = JSON.stringify([finding.source, finding.field, finding.status, finding.message, finding.target]);
    unique.set(key, finding);
  }
  // Defensive completeness: even callers constructing an IR manually cannot silently lose fields.
  for (const asset of [...ir.agents, ...ir.skills]) {
    for (const field of Object.keys(asset.frontmatter)) {
      if (![...unique.values()].some((item) => item.source === asset.source && item.field === field)) {
        const finding: Finding = {
          source: asset.source, field, status: "degraded",
          message: "没有可核实的自动映射结论。请对照原文件人工检查此字段；不要假定其运行时语义已保留。",
          messageEn: "No verified automatic mapping is available. Review this field against its source; do not assume its runtime semantics were preserved.",
        };
        unique.set(JSON.stringify([asset.source, field]), finding);
      }
    }
  }
  return [...unique.values()];
}

export function renderReport(ir: MigrationIR, options: ConvertOptions, validation?: ValidationResult): string {
  const zh = options.lang === "zh";
  const findings = allFindings(ir);
  const rows = findings.map((finding) => `| ${markdown(finding.source)} | ${markdown(finding.field)} | ${statusLabels[options.lang][finding.status]} | ${markdown(finding.target ?? "—")} | ${markdown(zh ? finding.message : finding.messageEn)} |`);
  const defaultValidation: ValidationResult = { status: "skipped", command: "agent-sdk validate --dir <out>", message: zh ? "尚未执行。" : "Not run yet." };
  const result = validation ?? defaultValidation;
  const labels = zh ? { passed: "通过", failed: "失败", unavailable: "不可用", skipped: "未执行" } : { passed: "Passed", failed: "Failed", unavailable: "Unavailable", skipped: "Skipped" };
  return [
    `# ${zh ? "迁移报告" : "Migration report"}: ${markdown(options.name)}`,
    "", `cc2agent → @grok/agent-sdk ${SDK_VERSION}`, "",
    zh
      ? `扫描结果：${ir.agents.length} 个子代理，${ir.skills.length} 个 skill（其中 ${ir.skills.filter((s) => s.dependency).length} 个依赖），${ir.scripts.length} 个禁用脚本工具存根。`
      : `Inventory: ${ir.agents.length} subagents, ${ir.skills.length} skills (${ir.skills.filter((s) => s.dependency).length} dependencies), ${ir.scripts.length} disabled script-tool stubs.`,
    "", `## ${zh ? "权限和执行边界" : "Permissions and execution boundaries"}`, "",
    zh
      ? "**原子代理的 tools / disallowedTools 限制无法在子代理层面保留。** 子代理共用父代理执行环境与 skills，子代理配置中的 tools 不受支持。不能假定根工具白名单能约束 task 子代理；请先验证，或禁用 task、拆成独立代理。只有显式传入 --root-tools 才会设置根代理工具白名单；不传时使用 SDK 默认工具。local.sandbox 已开启，但沙箱不等于只读；shell 可以写文件、执行命令。请在运行前审核实际权限。"
      : "**Original per-subagent tools / disallowedTools restrictions cannot be preserved at subagent scope.** Subagents share the parent's execution environment and skills; subagent tools configuration is unsupported. Do not assume the root tool allowlist constrains task subagents. Verify that boundary, disable task, or use separate agents. Root tool restrictions are emitted only with explicit --root-tools; otherwise SDK defaults apply. local.sandbox is enabled, but a sandbox is not read-only; shell can write files and execute commands. Review actual permissions before running.",
    "", zh
      ? "原 skill 正文与辅助文件保留，可能仍包含其他平台的工具名或操作指令。迁移报告中的警告不会自动改写这些指令。scripts 文件只被复制，转换过程不会执行它们；生成的工具存根始终返回 TODO 错误。原脚本经审核并实现 JSON stdin/stdout 契约后才能启用。运行时 skill 路径是 .cursor/skills/<name>/，不是源码中的 bot/skills/<name>/。"
      : "Original skill bodies and supporting files are preserved and may still refer to another platform's tools or operational instructions. Report warnings do not rewrite those instructions automatically. Scripts are copied, never executed during conversion; generated tool stubs always return a TODO error. Review original scripts and implement the JSON stdin/stdout contract before enabling them. Runtime skill paths are .cursor/skills/<name>/, not the source paths bot/skills/<name>/.",
    "", `## ${zh ? "逐文件、逐字段映射" : "Mapping by file and field"}`, "",
    zh ? "| 源文件 | 字段 / 内容 | 结论 | 输出位置 | 说明与补救 |" : "| Source | Field / content | Result | Destination | Explanation and remedy |",
    "| --- | --- | --- | --- | --- |", ...rows,
    ...(rows.length ? [] : [zh ? "| — | — | ✅ 已映射 | — | 没有发现输入字段。 |" : "| — | — | ✅ Mapped | — | No input fields found. |"]),
    "", `## ${zh ? "自动生成的 eval" : "Generated evals"}`, "",
    zh
      ? "每个 skill 生成 loadedSkill 触发用例，每个子代理生成 calledSubagent 委派用例。这些用例只能验证路由行为，不证明能力或安全性。未运行真实模型时，不能称为 eval 通过。禁用脚本存根不生成成功调用用例；实现后请补充 calledTool 和结果断言。"
      : "Each skill receives a loadedSkill trigger case; each subagent receives a calledSubagent delegation case. These cases test routing, not capability or safety. They are not passing evals until run against a real model. Disabled script stubs do not receive successful-call cases; add calledTool and result assertions after implementation.",
    "", `## ${zh ? "SDK 自检" : "SDK validation"}`, "",
    `- ${zh ? "状态" : "Status"}: ${labels[result.status]}`,
    `- ${zh ? "命令" : "Command"}: ${markdown(result.command)}`,
    `- ${zh ? "结果" : "Result"}: ${markdown(result.message)}`,
    ...(result.diagnostics ?? []).map((diagnostic) => `- ${markdown(diagnostic.severity)}: ${markdown(diagnostic.message)}`),
    "", zh
      ? "validate 只检查项目结构与配置；它不验证模型 ID 是否可用，也不证明真实模型执行、GitHub 触发或部署成功。"
      : "validate checks project structure and configuration only; it does not establish model-ID availability, live model execution, GitHub triggers, or successful deployment.",
    "", `## ${zh ? "下一步" : "Next steps"}`, "",
    "```sh", "npm install", "npx agent-sdk validate --dir .", "npx agent-sdk eval --dir . --list", "npx agent-sdk login", "npx agent-sdk dev", "```", "",
  ].join("\n");
}
