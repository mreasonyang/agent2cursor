# Upstream verification — 2026-10-27

This record separates package/source inspection from real account execution. SDK documentation was read from the installed dependency under ignored `.validation/`; it is not redistributed here.

| Item | Evidence | Scope |
| --- | --- | --- |
| SDK package | [Official overview](https://cursor.com/docs/agent-sdk) instructs installing `@grok/agent-sdk`; local dependency is 0.3.0 | Package/API compatibility, not account entitlement |
| tstack | [Commit 7de017b3fc9d50c03cf3ecb98fb71e0ca65a78bd](https://github.com/t3dotgg/tstack/tree/7de017b3fc9d50c03cf3ecb98fb71e0ca65a78bd), commit date 2026-10-24T19:25:50-07:00 | Current HEAD when fetched 2026-10-27; 9 skills; byte hashes in provenance |
| tstack license | Upstream LICENSE is MIT, Copyright (c) 2026 Theo Browne | Preserved in snapshot and both demos |
| GitHub channel | Public `githubChannel` / `defaultGitHubAuth`, deferred `workspaceFiles`, read-scoped `cursorAccount` | Signed local replay of private PR #1 passed; hosted delivery untested |
| SDK authentication | Official `agent-sdk login` completed successfully | Account authentication confirmed; no credential values retained as evidence |
| Eval assertions | Public `defineEval`, `defineEvalConfig`, `loadedSkill`, `calledSubagent`, `notCalledTool`, `includes` | Discovery checked; live generated skill and council evals passed the assertions detailed below |
| Tools | Server tools support `effect`, `dryRunResult`, `needsApproval`; agent script tools do not support these fields | Agent scripts need shell and a manual JSON adapter |
| Deployment | [Official deployment guide](https://cursor.com/docs/agent-sdk/deployment) deploys a committed, pushed Git ref; hosted `deploy --dry-run` reports no default team for this account | Account/team prerequisite unresolved; no actual deployment and no deployed URL |

Demo local validation against the installed SDK on this date:

- `full-send`: zero errors; one expected warning that the root excludes shell and therefore cannot run `pr_wait_script`.
- `pr-review`: no diagnostics.
- `eval --list`: six cases for full-send and three for pr-review.
- These are structural checks, separate from the authenticated model evals below. They do not establish real GitHub event delivery, tool-write behavior or deployment.

Authenticated model evidence on this date (before the rename from `cc2agent`):

The immutable [online evidence](evidence/online-2026-10-27.json) retains its original names and source hashes. Inspect the pre-rename source at commit `f9fc7fe682252b82bce904f6df0d3da0f3d62de5`. Local rename checks do not constitute another authenticated model run.

- Generated `migration-smoke`: **PASS**, 1 case and 2 assertions (`t.succeeded()` and `t.loadedSkill("migration-smoke")`). Sanitized local evidence: `.validation/live-evidence-smoke.json`; generated case: `.validation/live-smoke/evals/skills.eval.ts`.
- [PR-review council case](../demos/pr-review/evals/pr-review.eval.ts): **PASS**, 1 case and 9 assertions (completion, three completed delegates, heading, downgrade marker and three scoring rows). The case supplies an inline PR example. Reviewers inherit the same model; this does not prove three-provider execution or child-agent isolation.
- Full-send direct `agent-sdk run`: **PASS** for skill loading. The final default template made one successful read of full-send and no write/exec or merge call. Unconfigured channels now use `disableChannel()`; the earlier startup failure came from requesting credentials for the placeholder repository.
- Private PR #1 signed local replay: **PASS** after fixing the input path. The channel GETs a bounded diff snapshot, checks event/head/base revisions, and seeds it for the sandboxed model. The terminal session completed three delegates, a Chinese Council scoring table and fallback statement, with zero tool errors or write/exec calls. GitHub comments, reactions and reviews remained zero; the PR was closed without merging. This is not an actual hosted webhook delivery.
- Hosted `deploy --dry-run` reached an account prerequisite failure: no default team. No actual deployment was performed and no deployment URL was obtained.

The sanitized evidence files are local, ignored artifacts. They retain pass counts and assertion results, not raw model logs or credentials. The repository remains private, the root package has `private: true`, and npm, public and social releases remain on hold. See [acceptance results](acceptance.md) for the current delivery record.

## Codex input adapter (2026-10-28)

The adapter follows the current [standalone custom-agent schema](https://learn.chatgpt.com/docs/agent-configuration/subagents) and [skill metadata documentation](https://learn.chatgpt.com/docs/build-skills), fetched on 2026-10-28. This extends the input formats; the output remains `@grok/agent-sdk@0.3.0`.

- Standalone `.codex/agents/*.toml` files declare `name`, `description`, and `developer_instructions`. The converter requires these strings, supports nested agent directories and explicitly selected loose files, and reuses existing subagent emission and model mapping.
- The current Codex schema allows selected feature and skill restrictions. These are reported as unsupported target semantics, with a terminal/report warning; they are not converted into ineffective child tool allowlists or Claude preload hints. Model reasoning/summary/verbosity settings are reported as dropped.
- Codex custom agents inherit sandbox, approval, provider, and MCP configuration from their parent. The converter does not read parent session config, credentials, `AGENTS.md`, or legacy `agents.<name>.config_file` declarations. Parent-only fields found inside a standalone file receive explicit explanations.
- `agents/openai.yaml` has per-field reporting for UI, invocation policy, dependencies, and unknown fields. Only a valid `interface.default_prompt` receives a semantic mapping to the eval trigger. Copied metadata does not enforce explicit-only invocation or install MCP connections.
- TOML parser errors suppress source excerpts. Required fields, file size, nesting, sensitive-key, symlink, collision, and no-overwrite protections are covered by synthetic tests. The adapter never executes source commands or follows referenced configuration paths.

`npm run test:sdk` now includes two synthetic Codex subagents and one Codex skill, with separate dependency installation, SDK validation/discovery, generated TypeScript checking, and listing of three routing cases. Listing these cases is not a live model eval. Earlier Claude/tstack model evidence does not establish Codex execution equivalence. See [acceptance](acceptance.md) for the recorded run result.

## Findings that change the original brief

1. A script cannot safely become a callable tool merely by copying it into a string. The upstream `pr-wait` speaks CLI arguments and event lines, while agent tools require JSON stdin/stdout. Generated stubs therefore remain disabled. The demo uses a separately authored read-only server `pr_wait` for one bounded GitHub snapshot, and retains the upstream script for audit.
2. Agent tools require the built-in shell tool. Removing shell also disables those tools; claiming a no-shell agent can execute `pr-wait` would be inaccurate. Full-send defaults to local preparation and a human handoff, with no automated test/git/push workflow.
3. The SDK's subagent discovery retains description/instructions/model, ignores nested tools directories and source `tools`, and keeps the harness task-tool toolset. Root allowlists cannot be presented as proven child-agent isolation. The demo prompts request read-only review, but a real sandbox/subagent test remains a release gate.
4. `local.sandbox: true` is useful for untrusted input and file-path boundaries, but documented local MCP fail-closed behavior may also block our server tools during a model turn. Direct tool invocation or static discovery does not prove model access. We do not disable sandbox automatically.
5. SDK GitHub channels default to automatic reply posting and reactions. Both demos now explicitly set `deliverReplies: false`, `progress.reactions: false`, and ignore mentions. PR review uses `permissions: "read"`; full-send retains its separately gated merge capability. Prompt instructions alone cannot control host-side channel effects.
6. PR review fetches its bounded snapshot in the deferred channel handler instead of asking the sandboxed model to call a remote MCP tool. The 120,000-character limit applies to the serialized model input, not a streaming HTTP response byte cap. Partial and unavailable patches remain explicit.

## Still unverified before claiming a production-ready migration

- Full account-specific Cursor model catalog; Claude aliases and three-provider routing.
- Subagent tool isolation and cross-provider routing. The completed skill/council evals verify routing and output markers, not these boundaries.
- Full-send's complete edit/test/push/PR workflow; only skill loading has passed live execution, and automatic test/push/PR creation is not implemented.
- `pr_wait` access in a sandboxed model session and credential/environment exposure boundaries.
- Actual hosted GitHub webhook delivery, score quality beyond the tested fixture, and no unintended writes across all harness paths. Signed local replay passed its narrower acceptance.
- Hosted deployment, exact effective egress list, GitHub permissions, required plan/roles and stable URL. The dry-run currently reports no default team. Only `api.github.com` is authored because current server tools use GitHub REST; the managed platform supplies additional base egress, which must be inspected on a real deployment.
- MCP `defineConnection` mapping, Claude WebFetch/WebSearch equivalents and exact permission-mode semantics remain outside the supported conversion scope. Unsupported fields receive report entries.
- npm publication and project name availability at publication time. Private repository acceptance continues; public and social release are intentionally on hold. The README GIF demonstrates fixture conversion, not deployment or production acceptance.

Use metadata-only auth checks. Never save raw model logs, process arguments or credential values as verification evidence.
