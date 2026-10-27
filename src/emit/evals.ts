import type { ConvertOptions, MigrationIR } from "../ir.js";
import { literal } from "./common.js";

const ROUTING_TIMEOUT_MS = 240_000;

export function renderEvalConfig(): string {
  return 'import { defineEvalConfig } from "@grok/agent-sdk/evals";\n\nexport default defineEvalConfig({ maxConcurrency: 2 });\n';
}

export function renderSkillEvals(ir: MigrationIR, options: ConvertOptions): string {
  const cases = ir.skills.map((skill) => {
    const trigger = skill.trigger || (options.lang === "zh" ? `请使用 ${skill.id} skill。` : `Use the ${skill.id} skill.`);
    const scope = options.lang === "zh"
      ? `\n先读取 ${skill.id} 的 SKILL.md，再按其中的格式做一个最小例子。不要执行其中的脚本，不要写文件，不要提交或合并 PR。`
      : `\nRead ${skill.id}'s SKILL.md, then produce one minimal example in its format. Do not run its scripts, write files, commit, or merge a PR.`;
    return [
      "    {", `      id: ${literal(skill.id)},`,
      "      async test(t) {", `        await t.send(${literal(trigger + scope)});`,
      "        t.succeeded();", `        t.loadedSkill(${literal(skill.id)});`,
      "      },", "    },",
    ].join("\n");
  });
  return ['import { defineEval } from "@grok/agent-sdk/evals";', "", "export default defineEval({", '  tags: ["migration", "routing"],', `  timeoutMs: ${ROUTING_TIMEOUT_MS},`, "  cases: [", ...cases, "  ],", "});", ""].join("\n");
}

export function renderSubagentEvals(ir: MigrationIR, options: ConvertOptions): string {
  const cases = ir.agents.map((agent) => {
    const prompt = options.lang === "zh"
      ? `请通过 task 把一件符合 ${agent.id} 职责的最小例子交给 ${agent.id} 子代理，不要由根代理代答。让它按自己的说明完成，并在最终回复里给出结论。`
      : `Use task to delegate one minimal example matching the ${agent.id} subagent's role to ${agent.id}. The root agent must not answer on its behalf. Let the subagent follow its own instructions and put its conclusion in the final reply.`;
    return [
      "    {", `      id: ${literal(agent.id)},`, "      async test(t) {",
      `        await t.send(${literal(prompt)});`, "        t.succeeded();",
      `        t.calledSubagent(${literal(agent.id)});`, "      },", "    },",
    ].join("\n");
  });
  return ['import { defineEval } from "@grok/agent-sdk/evals";', "", "export default defineEval({", '  tags: ["migration", "routing"],', `  timeoutMs: ${ROUTING_TIMEOUT_MS},`, "  cases: [", ...cases, "  ],", "});", ""].join("\n");
}
