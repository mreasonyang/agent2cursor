import { disableChannel } from "@grok/agent-sdk";
import { defaultGitHubAuth, githubChannel } from "@grok/agent-sdk/channels/github";
import { DEMO_REPOSITORY } from "../lib/settings.js";
const actions = new Set(["opened", "reopened", "ready_for_review"]);
// Local runs do not register a GitHub channel or request repository credentials.
export default DEMO_REPOSITORY === "OWNER/REPO" ? disableChannel() : githubChannel({
  botName: "agent2cursor-full-send",
  cursorAccount: { repos: [DEMO_REPOSITORY], permissions: "pr-write" },
  deliverReplies: false,
  progress: { reactions: false },
  onComment: () => null,
  onPullRequest(ctx, pr) {
    if (DEMO_REPOSITORY === "OWNER/REPO" || ctx.repository.fullName !== DEMO_REPOSITORY || pr.draft || !actions.has(pr.action)) return null;
    return { auth: defaultGitHubAuth(ctx), title: `full-send: ${ctx.repository.fullName}#${pr.number}`, context: [`full send：先评审并准备 PR；默认停止在合并前 ${pr.url}。仅在本会话回复，不自动发布评论。`] };
  },
});
