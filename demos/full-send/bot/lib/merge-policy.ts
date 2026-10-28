export function mergeBlockReason(input: { enabled?: string; approved: boolean; purpose?: string; configuredRepository: string; sessionRepository?: string; currentHead: string; expectedHead: string; state: string; draft: boolean; mergeableState: string }): string | undefined {
  if (input.purpose === "eval") return "eval sessions cannot merge";
  if (input.enabled !== "1") return "AGENT2CURSOR_ALLOW_MERGE is not enabled";
  if (!input.approved) return "a human must approve this tool call";
  if (input.configuredRepository === "OWNER/REPO" || input.sessionRepository !== input.configuredRepository) return "repository does not match the configured GitHub session";
  if (!/^[a-f0-9]{40}$/i.test(input.expectedHead) || input.currentHead !== input.expectedHead) return "pull request head changed";
  if (input.state !== "open" || input.draft || input.mergeableState !== "clean") return "pull request is not ready to merge";
  return undefined;
}
