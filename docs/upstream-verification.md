# Upstream verification — 2026-10-27

This record separates package/source inspection from real account execution. SDK documentation was read from the installed dependency under ignored `.validation/`; it is not redistributed here.

| Item | Evidence | Scope |
| --- | --- | --- |
| SDK package | [Official overview](https://cursor.com/docs/agent-sdk) instructs installing `@grok/agent-sdk`; local dependency is 0.3.0 | Package/API compatibility, not account entitlement |
| tstack | [Commit 7de017b3fc9d50c03cf3ecb98fb71e0ca65a78bd](https://github.com/t3dotgg/tstack/tree/7de017b3fc9d50c03cf3ecb98fb71e0ca65a78bd), commit date 2026-10-24T19:25:50-07:00 | Current HEAD when fetched 2026-10-27; 9 skills; byte hashes in provenance |
| tstack license | Upstream LICENSE is MIT, Copyright (c) 2026 Theo Browne | Preserved in snapshot and both demos |
| GitHub channel | Public `githubChannel` / `defaultGitHubAuth` with `cursorAccount.repos` and `onPullRequest` | Both demos validate; real delivery not tested |
| Eval assertions | Public `defineEval`, `defineEvalConfig`, `loadedSkill`, `calledSubagent`, `notCalledTool`, `includes` | Eval discovery checked; model assertions not run |
| Tools | Server tools support `effect`, `dryRunResult`, `needsApproval`; agent script tools do not support these fields | Agent scripts need shell and a manual JSON adapter |
| Deployment | [Official deployment guide](https://cursor.com/docs/agent-sdk/deployment) deploys a committed, pushed Git ref | Command/API documented; no deployed URL obtained |

Demo local validation against the installed SDK on this date:

- `full-send`: zero errors; one expected warning that the root excludes shell and therefore cannot run `pr_wait_script`.
- `pr-review`: no diagnostics.
- `eval --list`: six cases for full-send and three for pr-review.
- No live model turn, paid eval, GitHub replay, tool write or deployment was executed to obtain these results.

## Findings that change the original brief

1. A script cannot safely become a callable tool merely by copying it into a string. The upstream `pr-wait` speaks CLI arguments and event lines, while agent tools require JSON stdin/stdout. Generated stubs therefore remain disabled. The demo uses a separately authored read-only server `pr_wait` for one bounded GitHub snapshot, and retains the upstream script for audit.
2. Agent tools require the built-in shell tool. Removing shell also disables those tools; claiming a no-shell agent can execute `pr-wait` would be inaccurate. Full-send defaults to local preparation and a human handoff, with no automated test/git/push workflow.
3. The SDK's subagent discovery retains description/instructions/model, ignores nested tools directories and source `tools`, and keeps the harness task-tool toolset. Root allowlists cannot be presented as proven child-agent isolation. The demo prompts request read-only review, but a real sandbox/subagent test remains a release gate.
4. `local.sandbox: true` is useful for untrusted input and file-path boundaries, but documented local MCP fail-closed behavior may also block our server tools during a model turn. Direct tool invocation or static discovery does not prove model access. We do not disable sandbox automatically.
5. A normal GitHub channel event does not itself need to publish a comment. Our channel starts a session, and our authored review tools only read. Review output stays in that session. PR comment/description publishing is intentionally not implemented.

## Still unverified before claiming a production-ready migration

- Full account-specific Cursor model catalog; Claude aliases and three-provider routing.
- Actual `loadedSkill` and council eval completion with Cursor credentials, including correct subagent tool isolation.
- `pr_wait` access in a sandboxed model session and credential/environment exposure boundaries.
- Live PR event handling, meaningful score table, and no unintended writes across all harness paths.
- Hosted deployment, exact effective egress list, GitHub permissions, required plan/roles and stable URL. Only `api.github.com` is authored because current server tools use GitHub REST; the managed platform supplies additional base egress, which must be inspected on a real deployment.
- MCP `defineConnection` mapping, Claude WebFetch/WebSearch equivalents and exact permission-mode semantics remain outside MVP conversion. Unsupported fields receive report entries.
- npm publication, project name availability at publication time, repository push and release GIF/social posts.

Use metadata-only auth checks. Never save raw model logs, process arguments or credential values as verification evidence.
