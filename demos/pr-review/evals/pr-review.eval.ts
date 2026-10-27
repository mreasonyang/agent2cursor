import { defineEval, includes } from "@grok/agent-sdk/evals";
export default defineEval({ async test(t) {
  await t.send("council：这是离线 PR 示例：src/price.ts 将 export const total = (n:number,p:number) => n*p 改为 n+p。请分别委派 reviewer-a、reviewer-b、reviewer-c，返回中文 Council review 评分表和同模型降级声明。不要查询 GitHub。 ");
  t.succeeded();
  t.calledSubagent("reviewer-a", { status: "completed" });
  t.calledSubagent("reviewer-b", { status: "completed" });
  t.calledSubagent("reviewer-c", { status: "completed" });
  t.check(t.reply, includes("Council review"));
  t.check(t.reply, includes("降级"));
  t.check(t.reply, includes(/^\|[^\n]*reviewer-a[^\n]*\|/m));
  t.check(t.reply, includes(/^\|[^\n]*reviewer-b[^\n]*\|/m));
  t.check(t.reply, includes(/^\|[^\n]*reviewer-c[^\n]*\|/m));
} });
