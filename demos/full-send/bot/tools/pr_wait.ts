import { defineTool } from "@grok/agent-sdk/tools";
import { z } from "zod";
import { DEMO_REPOSITORY } from "../lib/settings.js";
export default defineTool({
  description: "读取配置仓库中 PR 的最新 head、文件和检查状态。只做一次 GET 快照，不轮询、不写 GitHub。",
  effect: "read",
  inputSchema: z.object({ number: z.number().int().positive() }),
  async execute({ number }, ctx) {
    if (DEMO_REPOSITORY === "OWNER/REPO") return { available: false, reason: "Configure bot/lib/settings.ts first" };
    const [owner, repo] = DEMO_REPOSITORY.split("/");
    const octokit = await ctx.host.github.getOctokit();
    const { data: pr } = await octokit.rest.pulls.get({ owner, repo, pull_number: number });
    const [{ data: files }, { data: checks }, { data: status }] = await Promise.all([
      octokit.rest.pulls.listFiles({ owner, repo, pull_number: number, per_page: 100 }),
      octokit.rest.checks.listForRef({ owner, repo, ref: pr.head.sha, per_page: 100 }),
      octokit.rest.repos.getCombinedStatusForRef({ owner, repo, ref: pr.head.sha }),
    ]);
    return { available: true, url: pr.html_url, head: pr.head.sha, state: pr.state, draft: pr.draft, mergeable: pr.mergeable, mergeableState: pr.mergeable_state, title: pr.title, status: status.state,
      filesTruncated: pr.changed_files > files.length, checksTruncated: checks.total_count > checks.check_runs.length,
      files: files.map(f => ({ path: f.filename, status: f.status, patch: f.patch?.slice(0, 12000), patchTruncated: (f.patch?.length ?? 0) > 12000, patchUnavailable: f.patch == null })),
      checks: checks.check_runs.map(c => ({ name: c.name, status: c.status, conclusion: c.conclusion })),
      note: "只读快照；未读取完整评审讨论，缺失检查不等于通过。" };
  },
});
