import { defineEval } from "@grok/agent-sdk/evals";
export default defineEval({ cases: [
  { id: "full-send", async test(t) { await t.send("请加载 full-send skill，并说明它的流程和限制。这是离线能力检查，不执行外部操作。"); t.succeeded(); t.loadedSkill("full-send"); } },
  { id: "sol-loop", async test(t) { await t.send("请加载 sol-loop skill，并说明它的流程和限制。这是离线能力检查，不执行外部操作。"); t.succeeded(); t.loadedSkill("sol-loop"); } },
  { id: "file-pr", async test(t) { await t.send("请加载 file-pr skill，并说明它的流程和限制。这是离线能力检查，不执行外部操作。"); t.succeeded(); t.loadedSkill("file-pr"); } },
  { id: "babysit-pr", async test(t) { await t.send("请加载 babysit-pr skill，并说明它的流程和限制。这是离线能力检查，不执行外部操作。"); t.succeeded(); t.loadedSkill("babysit-pr"); } },
  { id: "leaving-pr-comments", async test(t) { await t.send("请加载 leaving-pr-comments skill，并说明它的流程和限制。这是离线能力检查，不执行外部操作。"); t.succeeded(); t.loadedSkill("leaving-pr-comments"); } }
] });
