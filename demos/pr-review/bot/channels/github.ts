import { defaultGitHubAuth, githubChannel } from "@grok/agent-sdk/channels/github";
import { DEMO_REPOSITORY } from "../lib/settings.js";
const actions = new Set(["opened", "reopened", "ready_for_review"]);
export default githubChannel({
  botName: "cc2agent-pr-review",
  cursorAccount: { repos: [DEMO_REPOSITORY] },
  onPullRequest(ctx, pr) {
    if (DEMO_REPOSITORY === "OWNER/REPO" || ctx.repository.fullName !== DEMO_REPOSITORY || pr.draft || !actions.has(pr.action)) return null;
    return { auth: defaultGitHubAuth(ctx), title: `pr-review: ${ctx.repository.fullName}#${pr.number}`, context: [`council：以三种视角评审 ${pr.url}。仅在本会话回复，不自动发布评论。`] };
  },
});
