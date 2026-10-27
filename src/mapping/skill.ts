import path from "node:path";
import type { ConvertOptions, Finding, SkillAsset } from "../ir.js";
import { fieldPaths, type ParsedMarkdown } from "../scan/frontmatter.js";
import { scanForeignTools } from "./foreign-tools.js";
import { slugName } from "./names.js";

export function mapSkill(source: string, parsed: ParsedMarkdown, options: ConvertOptions, dependency: boolean): SkillAsset {
  const { body, frontmatter } = parsed;
  const directory = path.dirname(source);
  const name = typeof frontmatter.name === "string" ? frontmatter.name : path.basename(directory);
  const id = slugName(name, "skill");
  const hasDescription = typeof frontmatter.description === "string" && !!frontmatter.description.trim();
  const description = hasDescription ? (frontmatter.description as string).trim()
    : options.lang === "zh" ? `当用户要求使用 ${id} 时加载；请补充技能用途。` : `Load when the user requests ${id}; add the skill purpose.`;
  const findings: Finding[] = fieldPaths(frontmatter).map((field) => {
    const root = field.split(".")[0];
    if (root === "name") return { source, field, status: id === frontmatter.name ? "mapped" : "degraded", target: `bot/skills/${id}/SKILL.md`, message: "已统一 skill 目录与 name。", messageEn: "Normalized the skill directory and name." };
    if (root === "description") return { source, field, status: hasDescription ? "mapped" : "degraded", target: `bot/skills/${id}/SKILL.md`, message: hasDescription ? "已保留技能描述。" : "无效描述已替换为占位描述；请补充触发条件。", messageEn: hasDescription ? "Skill description preserved." : "Invalid description replaced with a placeholder; add triggers." };
    if (root === "allowed-tools") return { source, field, status: "degraded", message: "原字段保留，但不生成运行时权限限制；请人工审查根代理 tools。", messageEn: "Field preserved but no runtime permission restriction generated; review root tools manually." };
    return { source, field, status: "mapped", target: `bot/skills/${id}/SKILL.md`, message: "原字段保留在 SKILL.md；仅保证内容保留，不保证 SDK 读取其语义。", messageEn: "Preserved in SKILL.md; content preservation does not imply SDK runtime support." };
  });
  if (!("name" in frontmatter)) findings.push({ source, field: "name", status: "degraded", message: "缺少 name，已从目录名生成。", messageEn: "Missing name; generated from the directory name." });
  if (!("description" in frontmatter)) findings.push({ source, field: "description", status: "degraded", message: "缺少 description，已生成占位描述。", messageEn: "Missing description; generated a placeholder." });
  findings.push({ source, field: "$body", status: "mapped", target: `bot/skills/${id}/SKILL.md`, message: "正文原样保留。", messageEn: "Body preserved unchanged." }, ...scanForeignTools(body, source));
  return { id, source, directory, body, frontmatter: { ...frontmatter, name: id, description }, description, dependency, findings };
}
