import { defineTool } from "@grok/agent-sdk/tools";
import { parseGitHubPrContinuationKey } from "@grok/agent-sdk/channels/github";
import { z } from "zod";
import { DEMO_REPOSITORY } from "../lib/settings.js";
import { mergeBlockReason } from "../lib/merge-policy.js";
export default defineTool({
  description: "合并当前 GitHub 会话的 PR。默认关闭；需要操作员开关、人工批准、精确 head SHA 和 GitHub 合并门禁。",
  inputSchema: z.object({ expectedHead: z.string().regex(/^[a-f0-9]{40}$/i) }),
  effect: "write",
  needsApproval: true,
  dryRunResult: () => ({ merged: false, reason: "dry-run" }),
  async execute({ expectedHead }, ctx) {
    if (ctx.session.purpose === "eval" || process.env.AGENT2CURSOR_ALLOW_MERGE !== "1" || !ctx.approvedBy) return { merged: false, reason: "merge disabled or not approved" };
    const ref = parseGitHubPrContinuationKey(ctx.session.continuationKey ?? "");
    if (!ref || DEMO_REPOSITORY === "OWNER/REPO" || `${ref.owner}/${ref.repo}` !== DEMO_REPOSITORY) return { merged: false, reason: "configured GitHub session required" };
    const octokit = await ctx.host.github.getOctokit();
    const { data: pr } = await octokit.rest.pulls.get({ owner: ref.owner, repo: ref.repo, pull_number: ref.number });
    const blocked = mergeBlockReason({ enabled: process.env.AGENT2CURSOR_ALLOW_MERGE, approved: Boolean(ctx.approvedBy), purpose: ctx.session.purpose, configuredRepository: DEMO_REPOSITORY, sessionRepository: `${ref.owner}/${ref.repo}`, currentHead: pr.head.sha, expectedHead, state: pr.state, draft: Boolean(pr.draft), mergeableState: pr.mergeable_state });
    if (blocked) return { merged: false, reason: blocked };
    const { data } = await octokit.rest.pulls.merge({ owner: ref.owner, repo: ref.repo, pull_number: ref.number, sha: expectedHead, merge_method: "squash" });
    return { merged: data.merged, sha: data.sha, reason: data.merged ? "merged" : "GitHub declined merge" };
  },
});
