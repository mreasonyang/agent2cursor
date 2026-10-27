import { defineEval } from "@grok/agent-sdk/evals";
export default defineEval({ cases: [
  { id: "council", async test(t) { await t.send("请加载 council skill，并说明它的流程和限制。这是离线能力检查，不执行外部操作。"); t.succeeded(); t.loadedSkill("council"); } },
  { id: "leaving-pr-comments", async test(t) { await t.send("请加载 leaving-pr-comments skill，并说明它的流程和限制。这是离线能力检查，不执行外部操作。"); t.succeeded(); t.loadedSkill("leaving-pr-comments"); } }
] });
