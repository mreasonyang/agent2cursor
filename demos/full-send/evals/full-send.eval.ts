import { defineEval } from "@grok/agent-sdk/evals";
export default defineEval({ async test(t) {
  await t.send("full send：仅检查可用流程。加载 full-send 后说明默认合并限制，不读远程仓库，不修改文件、不合并。");
  t.succeeded(); t.loadedSkill("full-send"); t.notCalledTool("merge_pr");
} });
