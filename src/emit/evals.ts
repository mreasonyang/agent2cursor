import type { ConvertOptions, MigrationIR } from "../ir.js";
import { literal } from "./common.js";

export function renderEvalConfig(): string {
  return 'import { defineEvalConfig } from "@grok/agent-sdk/evals";\n\nexport default defineEvalConfig({ maxConcurrency: 2 });\n';
}

export function renderSkillEvals(ir: MigrationIR, options: ConvertOptions): string {
  const cases = ir.skills.map((skill) => {
    const trigger = skill.trigger || (options.lang === "zh" ? `请使用 ${skill.id} skill。` : `Use the ${skill.id} skill.`);
    const scope = options.lang === "zh"
      ? `\n这是迁移路由检查：只加载 ${skill.id} skill 并用一句话说明用途，不执行其中的操作步骤、不调用脚本、不写文件、不提交或合并 PR。`
      : `\nThis is a migration routing check: only load the ${skill.id} skill and explain its purpose in one sentence. Do not carry out its operational steps, run scripts, write files, commit, or merge a PR.`;
    return [
      "    {", `      id: ${literal(skill.id)},`,
      "      async test(t) {", `        await t.send(${literal(trigger + scope)});`,
      "        t.succeeded();", `        t.loadedSkill(${literal(skill.id)});`,
      "      },", "    },",
    ].join("\n");
  });
  return ['import { defineEval } from "@grok/agent-sdk/evals";', "", "export default defineEval({", '  tags: ["migration", "routing"],', "  cases: [", ...cases, "  ],", "});", ""].join("\n");
}

export function renderSubagentEvals(ir: MigrationIR, options: ConvertOptions): string {
  const cases = ir.agents.map((agent) => {
    const prompt = options.lang === "zh"
      ? `请通过 task 将一个路由检查委派给 ${agent.id} 子代理：只回复“已就绪”，不要执行其他操作或使用任何工具。不要由根代理代答。`
      : `Use task to delegate a routing check to the ${agent.id} subagent: reply only "ready", perform no other actions and use no tools. The root agent must not answer on its behalf.`;
    return [
      "    {", `      id: ${literal(agent.id)},`, "      async test(t) {",
      `        await t.send(${literal(prompt)});`, "        t.succeeded();",
      `        t.calledSubagent(${literal(agent.id)});`, "      },", "    },",
    ].join("\n");
  });
  return ['import { defineEval } from "@grok/agent-sdk/evals";', "", "export default defineEval({", '  tags: ["migration", "routing"],', "  cases: [", ...cases, "  ],", "});", ""].join("\n");
}
