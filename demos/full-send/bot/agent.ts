import { defineAgent } from "@grok/agent-sdk";
export default defineAgent({
  name: "cc-to-cursor-agent-full-send",
  description: "中文本地修改、评审和 PR 草稿；默认不合并。",
  tools: ["read", "grep", "glob", "ls", "task", "edit"],
  local: { sandbox: true },
  concurrency: { maxRunningTurns: 1 },
  hosting: { egressDomains: ["api.github.com"], secretNames: ["CC_TO_CURSOR_AGENT_ALLOW_MERGE"] },
});
