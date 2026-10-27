import type { Language, MigrationIR } from "../ir.js";

export function permissionWarning(ir: MigrationIR, lang: Language): string | undefined {
  const affected = ir.agents.filter(agent => ["tools", "disallowedTools", "permissionMode"]
    .some(field => Object.hasOwn(agent.frontmatter, field)));
  if (!affected.length) return undefined;
  return lang === "zh"
    ? `⚠️ 子代理限制未生效（${affected.length} 个）：源 tools / disallowedTools / permissionMode 未迁移。SDK 校验通过不代表只读；--root-tools 只设置根代理白名单。`
    : `⚠️ Source subagent restrictions are not enforced (${affected.length} affected): tools / disallowedTools / permissionMode were not migrated. SDK validation does not establish read-only access; --root-tools sets only the root allowlist.`;
}
