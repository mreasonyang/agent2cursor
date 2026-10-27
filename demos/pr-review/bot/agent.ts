import { defineAgent } from "@grok/agent-sdk";
export default defineAgent({
  name: "cc-to-cursor-agent-pr-review",
  description: "三种视角的中文 PR 评审；默认同一模型。",
  tools: ["read", "grep", "glob", "ls", "task"],
  local: { sandbox: true },
  concurrency: { maxRunningTurns: 1 },
  hosting: { egressDomains: ["api.github.com"] },
});
