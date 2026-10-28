import type { Language, MigrationIR } from "../ir.js";

export function permissionWarning(ir: MigrationIR, lang: Language): string | undefined {
  const affected = ir.agents.filter(agent => ["tools", "disallowedTools", "permissionMode"]
    .some(field => Object.hasOwn(agent.frontmatter, field)));
  const warnings: string[] = [];
  if (affected.length) warnings.push(lang === "zh"
    ? `⚠️ 子代理限制未生效（${affected.length} 个）：源 tools / disallowedTools / permissionMode 未迁移。SDK 校验通过不代表只读；--root-tools 只设置根代理白名单。`
    : `⚠️ Source subagent restrictions are not enforced (${affected.length} affected): tools / disallowedTools / permissionMode were not migrated. SDK validation does not establish read-only access; --root-tools sets only the root allowlist.`);
  const codex = ir.agents.filter(agent => agent.sourceFormat === "codex" && ["features", "skills", "sandbox_mode", "approval_policy", "sandbox_workspace_write", "permissions"]
    .some(field => Object.hasOwn(agent.frontmatter, field)));
  if (codex.length) warnings.push(lang === "zh"
    ? `⚠️ Codex 权限/能力配置未迁移（${codex.length} 个）：features / skills 限制未生效，父会话权限未导入。SDK 校验通过不代表只读；--root-tools 只设置根代理白名单。`
    : `⚠️ Codex permission/capability configuration was not migrated (${codex.length} affected): features / skills restrictions are not enforced and parent permissions are not imported. SDK validation does not establish read-only access; --root-tools sets only the root allowlist.`);
  const policies = new Set(ir.findings.filter(finding => finding.field === "policy" && /[\\/]agents[\\/]openai\.yaml$/.test(finding.source)).map(finding => finding.source));
  if (policies.size) warnings.push(lang === "zh"
    ? `⚠️ Codex skill 调用策略未生效（${policies.size} 个）：openai.yaml 的 policy 仅保留为元数据；请人工限制触发流程。`
    : `⚠️ Codex skill invocation policy is not enforced (${policies.size} affected): openai.yaml policy is retained as metadata only; constrain routing manually.`);
  return warnings.length ? warnings.join("\n") : undefined;
}
