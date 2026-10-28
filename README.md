# agent2cursor

Convert existing Claude Code and Codex subagents and Agent Skills into editable [Cursor Agent SDK](https://cursor.com/docs/agent-sdk) (`@grok/agent-sdk`) TypeScript projects, with routing eval scaffolds and a field-by-field migration report.

[中文说明](README.zh-CN.md) · **0.1.0** · [MIT License](LICENSE) · Node **>=22.13** · Targets **`@grok/agent-sdk@0.3.0`**

![Converting Claude subagents and skills into an Agent SDK project with a field-by-field migration report](docs/assets/agent2cursor-demo.gif)

If you already wrote subagents in `.claude/agents/*.md` or `.codex/agents/*.toml`, or skill folders containing `SKILL.md` (including [t3dotgg/tstack](https://github.com/t3dotgg/tstack) workflows), `agent2cursor` turns those loose files into a standalone Cursor Agent SDK project. It generates editable source files, a per-field migration report, and initial routing evals—it does **not** migrate underlying models or chat history, and it does **not** guarantee preserved runtime behavior or subagent permission boundaries.

```text
.claude/agents/code-reviewer.md → bot/subagents/code-reviewer/{agent.ts,instructions.md}
.codex/agents/reviewer.toml     → bot/subagents/<name>/{agent.ts,instructions.md}
skills/<name>/SKILL.md          → bot/skills/<name>/SKILL.md
skills/*/scripts/*              → bot/tools/*.ts (disabled JSON adapter stubs)
source fields + routing checks  → MIGRATION.zh-CN.md (or .en.md) + evals/*.eval.ts
```

## Quickstart

`agent2cursor` (`0.1.0`, `"private": true` in [`package.json`](package.json)) has not been published to npm yet—do not run `npx agent2cursor`. Build from this checkout and run against the included [`fixtures/`](fixtures/claude) directory:

```bash
npm ci --ignore-scripts
npm run build

# Inspect or convert the checked-in Claude subagents + tstack full-send skill closure
node dist/cli.js inspect ./fixtures/claude ./fixtures/tstack/skills/full-send --with-deps --lang en
node dist/cli.js convert ./fixtures/claude ./fixtures/tstack/skills/full-send \
  --with-deps --lang en --out /tmp/my-agent
```

```text
⚠️ Source subagent restrictions are not enforced (4 affected): tools / disallowedTools / permissionMode were not migrated. SDK validation does not establish read-only access; --root-tools sets only the root allowlist.
agent2cursor v0.1.0 → @grok/agent-sdk 0.3.0
Scanned: 4 agents, 5 skills, 1 script stubs
...
```

On this fixture input (4 subagents, 5 skills including 4 `tstack` dependencies, and 1 script stub), `agent2cursor` writes **28 files** and lists migration concerns in `/tmp/my-agent/MIGRATION.en.md`. Exact concern counts and `Validation` status depend on your inputs, flags, and installed dependencies (`dependencies-missing` is expected before installing dependencies in `/tmp/my-agent`).

To install the SDK inside the generated project and run structural checks from this checkout:

```bash
(cd /tmp/my-agent && npm install && npx agent-sdk validate --dir . && npx agent-sdk eval --dir . --list)
node dist/cli.js doctor --dir /tmp/my-agent
```

If you want a global `agent2cursor` command locally before npm publication, run `npm pack && npm install --global ./agent2cursor-0.1.0.tgz`.

- **SDK package name:** [Official Cursor Agent SDK docs](https://cursor.com/docs/agent-sdk) specify **`@grok/agent-sdk`** (formerly `@cursor/bdk`). Do not substitute `@cursor/agent-sdk` from older blog posts; see [upstream verification](docs/upstream-verification.md). Generated `package.json` pins `@grok/agent-sdk` to `0.3.0` and declares `zod` `^3.25.0`.
- **Account requirements by step:**
  1. **Offline conversion & structural checks** (`convert`, `inspect`, `doctor`, `agent-sdk validate`, `agent-sdk eval --list`) require **no** Cursor account or API key.
  2. **Live model execution** (`agent-sdk dev`, `agent-sdk run`, live `agent-sdk eval`) requires `agent-sdk login` and model access on your Cursor account.
  3. **Cloud hosting** (`agent-sdk deploy`) is optional and requires an account/team with hosting enabled and repository permissions.

`convert` and `demo` exit 0 when files are written but declared SDK or `zod` dependencies are missing: `validation.status` is `dependencies-missing`, with the missing package names. Validation has not run. Install dependencies and run `agent2cursor doctor --dir <project>`; `doctor` exits nonzero until validation passes. Actual validation errors still make conversion exit 1. Dependencies are never installed automatically.

## Convert Codex assets

After building the checkout, pass project or personal agent directories, a standalone TOML file, and/or skill directories. Claude and Codex inputs can be mixed in one conversion:

```bash
node dist/cli.js inspect .codex/agents .agents/skills --lang en
node dist/cli.js convert .codex/agents .agents/skills --out ./my-codex-agent --lang en
# Included synthetic example: no Codex installation or account required
node dist/cli.js convert fixtures/codex/project --out /tmp/codex-example --lang en
```

Use only paths that exist; either input can be used alone. Personal standalone agents under `~/.codex/agents` are also accepted. A project root discovers these agent trees and skill folders, while unrelated TOML files are ignored.

| Codex input | Conversion |
| --- | --- |
| Standalone `name`, `description`, `developer_instructions` | Required non-empty strings; generates subagent ID, delegation description, and the parsed instruction text. Invalid files fail explicitly. |
| `model` | Inherits the target parent by default. Use `--model-map source-id=target-id` or `--keep-model`; availability is not established by validation. |
| `model_reasoning_effort`, `model_reasoning_summary`, `model_verbosity` | Reported as dropped; model-ID mapping does not migrate these parameters. |
| `features.*`, `skills.*` | Reported as degraded; per-agent capability and skill restrictions are not enforced. Referenced skill paths are not read. |
| Parent settings, including sandbox, approval, provider, and MCP | Not imported. These do not override the parent in a standalone Codex agent either. Configure the target environment explicitly. |
| `agents/openai.yaml` | Copied unchanged. A valid `interface.default_prompt` becomes an eval trigger; every UI, policy, dependency, and unknown field receives a migration entry. Invocation policy is not enforced and MCP dependencies are not connected. |

This supports **standalone Codex TOML agents → Cursor Agent SDK**, not whole-session migration or output for Codex. Parent `config.toml`, `AGENTS.md`, credentials, and legacy `[agents.<name>] config_file` declarations are not imported. Inherited instructions, tools, and skills must be reviewed separately. Codex tool references receive suggestions without automatic prompt rewriting. See the [Codex fixtures](fixtures/codex) and [verified scope](docs/upstream-verification.md#codex-input-adapter-2026-10-28).

## When to Use agent2cursor

`@grok/agent-sdk` already supports native skills and plugins. Choose the lightest path that fits your assets:

| Approach | When to use it |
| --- | --- |
| Copy `SKILL.md` directly | You only have compatible `SKILL.md` directories and do not need subagent conversion, script stubs, or a migration report |
| SDK `cursorPlugin()` | You have a Cursor/Claude plugin manifest and runtime mounting is enough |
| `agent-sdk init --from automation:` / `migrate` | You are migrating a Cursor Automation or upgrading an older SDK project |
| **`agent2cursor`** | You hold loose Claude `.md` / Codex `.toml` agents, skill directories, or `tstack` workflows and want editable SDK source, field-by-field loss accounting, foreign-tool warnings, disabled script stubs, and routing eval scaffolds |

## What Gets Migrated (Example: `code-reviewer`)

Given [`fixtures/claude/agents/code-reviewer.md`](fixtures/claude/agents/code-reviewer.md):

```markdown
---
name: code-reviewer
description: Review changed code for defects, maintainability, and missing verification.
tools: Read, Grep, Glob
model: sonnet
---
Review the changed code. Prioritize concrete defects and cite the affected file and line.
Do not edit files. Explain what was verified and what remains uncertain.
```

`agent2cursor convert` emits `bot/subagents/code-reviewer/agent.ts`, writes the prompt body to `bot/subagents/code-reviewer/instructions.md`, and logs every frontmatter field in `MIGRATION.zh-CN.md` (or `MIGRATION.en.md`):

```ts
// bot/subagents/code-reviewer/agent.ts
// Generated by agent2cursor. Review the migration report before running.
import { defineAgent } from "@grok/agent-sdk";

export default defineAgent({
  description: "Review changed code for defects, maintainability, and missing verification.",
  // TODO(agent2cursor): tools: Security boundary lost: task children retain the harness task-tool toolset; do not assume root allowlists constrain them. Reference name mapping (read, grep, glob). For enforced read-only access use separate agents or disable task and constrain execution separately; shell can write.
  // TODO(agent2cursor): model: Omitted model to inherit the parent model; use --model-map to select a target model explicitly.
});
```

<details>
<summary><strong>Field-by-field disposition reference</strong></summary>

| Source asset or field | SDK output location | Disposition | Behavior |
| --- | --- | --- | --- |
| Subagent `name` | `bot/subagents/<id>/` | `✅ Mapped` / `⚠️ Degraded` | `✅` when already a valid slug; `⚠️` when normalized or derived from the filename |
| Subagent `description` | `bot/subagents/<id>/agent.ts` | `✅ Mapped` / `⚠️ Degraded` | `✅` when non-empty; `⚠️` with a generated placeholder when missing or blank |
| Subagent Markdown body | `bot/subagents/<id>/instructions.md` | `✅ Mapped` / `⚠️ Degraded` | Unchanged bodies are mapped; appending a shared-skill preload hint is explicitly reported as degraded, with the original text retained |
| Subagent `model` | `bot/subagents/<id>/agent.ts` | `✅ Mapped` / `⚠️ Degraded` | `inherit` is omitted (`✅`). Other IDs (`sonnet`, `opus`, `haiku`) are omitted by default (`⚠️`) to inherit the parent model unless mapped with `--model-map` (`✅`) or kept with `--keep-model` (`⚠️`) |
| Subagent `tools` / `disallowedTools` | `MIGRATION.*.md` + `TODO(agent2cursor)` | `⚠️ Degraded` | Per-subagent tool lists are unsupported in SDK `0.3.0`; `task` children retain the harness `task` toolset |
| Subagent `skills` | `bot/instructions.md` + `instructions.md` | `⚠️ Degraded` | Emits shared-skill loading hints (no native per-subagent preloading) |
| `permissionMode`, `hooks`, `mcpServers`, `memory`, unknown agent fields | `MIGRATION.*.md` + `TODO(agent2cursor)` | `❌ Dropped` | No verified 1:1 SDK equivalent; documented in the report for manual implementation |
| `SKILL.md` + supporting files | `bot/skills/<id>/**` | `✅ Mapped` / `⚠️ Degraded` | Keeps body, supporting files, and extra frontmatter (`license`, `metadata.*`); `name`/`description` degrade to `⚠️` if normalized/missing, and `allowed-tools` is marked `⚠️` |
| `skills/*/agents/openai.yaml` | Copied metadata + `evals/skills.eval.ts` | `✅ Mapped` / `⚠️ Degraded` | Valid `interface.default_prompt` becomes an eval trigger; UI, invocation policy, tool dependencies, and unknown fields are reported individually as metadata without SDK runtime semantics |
| `skills/*/scripts/*` | `bot/skills/<id>/scripts/*` + `bot/tools/<script>.ts` | `⚠️ Degraded` | Copies script without executable bits and emits a disabled `execution: "agent"` stub (`AGENT2CURSOR_STUB_DISABLED`) |

</details>

## CLI Reference

| Command or flag | Description |
| --- | --- |
| `convert <input...>` | Convert Claude `.md` / standalone Codex `.toml` files, `.claude/agents/` / `.codex/agents/` trees, skill directories, or a `tstack` repo into a new SDK project |
| `inspect <input...>` | Print the migration report (or `--json` summary) without writing files |
| `demo <full-send\|pr-review>` | Export one of the two adapted `tstack` demo projects (`--out <dir>`, `--json`, `--no-validate`) |
| `doctor [--dir <project>]` | Check Node `>=22.13` and run `agent-sdk validate` with credential-safe diagnostic summaries |
| `--out <dir>` | New output directory for `convert` (default `./my-agent`; never overwrites existing paths) |
| `--name <name>` | Generated agent name (`1–64` lowercase letters, digits, `-`, or `_`, starting with a letter or digit; default `converted-agent`) |
| `--lang <zh\|en>` | Language for generated instructions, eval prompts, and `MIGRATION.zh-CN.md` / `MIGRATION.en.md` (default `zh`) |
| `--with-deps` | Include sibling skills required by the `tstack` dependency graph |
| `--model-map <map>` | Map source models explicitly, e.g. `--model-map sonnet=<account-verified-id>` (verify ID availability on your account) |
| `--keep-model` | Keep unverified source model IDs as-is instead of omitting them to inherit |
| `--root-tools <list>` | Explicit root allowlist (`read,grep,glob,ls,shell,edit,task,delete`); omitting preserves SDK defaults |
| `--dry-run` / `--no-validate` / `--json` | Plan `convert` without writing files / skip `agent-sdk validate` / print machine-readable JSON |

## Included Demos

Both demos are adapted in Chinese from a pinned [t3dotgg/tstack](https://github.com/t3dotgg/tstack) MIT snapshot (`7de017b3fc9d50c03cf3ecb98fb71e0ca65a78bd`) and include `LICENSE-tstack` and `TSTACK-PROVENANCE.json`. Export them with `node dist/cli.js demo <full-send|pr-review> --out <dir>`:

- **`full-send` ([operation guide](demos/full-send/README.md)):** five skills (`full-send`, `sol-loop`, `file-pr`, `babysit-pr`, `leaving-pr-comments`), a `reviewer` subagent, a one-shot read-only `pr_wait` snapshot tool (no polling), a disabled `pr_wait_script` stub alongside the retained Python `pr-wait` script, and a gated `merge_pr` tool. Its root tools exclude `shell`, so **it prepares local edits and a PR draft and stops before publishing or merging**—automatic test execution, `git push`, and PR creation are not implemented. `merge_pr` is off by default and requires `AGENT2CURSOR_ALLOW_MERGE=1`, human approval, a matching configured GitHub session, an open/non-draft/clean PR, and the exact current head SHA (eval sessions cannot merge).
- **`pr-review` ([operation guide](demos/pr-review/README.md)):** `council` and `leaving-pr-comments` with three reviewer subagents (`reviewer-a`, `reviewer-b`, `reviewer-c`). All three inherit the same parent model, outputting a Chinese `Council review` table and an explicit notice that the review uses three perspectives on one model rather than three separate model providers. Its root tools are read/search/delegate only, and its authored tools never post comments or edit PR descriptions.

Both demos disable their GitHub channel until `bot/lib/settings.ts` replaces `"OWNER/REPO"`. Even after configuring a repository, automatic reply comments, reactions, and `@mention` triggers remain disabled. `pr-review` pre-fetches a bounded, revision-checked diff snapshot on the host side before the sandboxed model turn; direct `pr_wait` calls from inside a sandboxed model turn remain unverified.

## Limitations and Verification Status

The [independent evaluation](evaluation/README.md) covers the corrected converter and revised routing evals. Earlier demo model runs and the signed PR replay were recorded before the rename from `cc2agent`; their [original evidence](docs/evidence/online-2026-10-27.json) retains its source hashes. These are separate runs, with their respective scope preserved.

- **Tool-name scan coverage:** a fixed, case-sensitive identifier list detects `WebFetch`, `WebSearch`, `AskUserQuestion`, `request_user_input`, `delegate_task`, `orchestrator_capabilities`, `watch_pull_request`, `unwatch_pull_request`, and `Monitor` in bodies and supporting Markdown. Matches may include instructions prohibiting a call; absence of a match does not establish compatibility. Source prompts are not rewritten.
- **Root allowlists do not isolate subagents:** `--root-tools` restricts the root agent only. In `@grok/agent-sdk@0.3.0`, `task` subagents retain the harness `task` toolset. Never assume a root allowlist makes child agents read-only, and never treat `shell` as read-only (it can write files and run arbitrary commands).
- **Script tools are disabled stubs:** conversion never executes source scripts. Generated `bot/tools/*.ts` wrappers return `AGENT2CURSOR_STUB_DISABLED` until an operator audits `.cursor/skills/<id>/scripts/*`, implements the JSON stdin/stdout contract, and enables `shell`.
- **Scoped input/output guards:** conversion refuses to overwrite existing output directories, rejects symlinks, caps output at 128 MiB, skips or rejects known credential paths (`.env`, `.npmrc`, private key files), and rejects sensitive YAML/TOML keys (`token`, `apiKey`, `secret`). Parser diagnostics never echo source values. It does not scan arbitrary prose or binary attachments for secrets.

**Verification summary (each evidence level is tracked separately):**

| Evidence level | Status | What is and is not proven |
| --- | --- | --- |
| Offline tests & SDK structure | **PASS** (existing evidence) | 59 local tests passed before repository cleanup. Generated projects passed SDK `validate` / `info` / `eval --list` and strict `tsc`, with their own dependencies installed in independent temporary directories. `eval --list` proves case discovery only. Cleanup did not rerun these suites |
| Independent conversion and routing evaluation | **PASS** (bounded dataset) | 24/24 normal conversions and post-install validations; revised generated routing evals passed 41/41 across 30 projects. Three real tasks, each repeated three times, matched direct-copy/plugin baselines. [Counts and source hashes](docs/evidence/independent-evaluation.json) |
| Live model runs | **PASS** (narrow cases) | Official `agent-sdk login` succeeded. `migration-smoke` passed (**1 case / 2 assertions**: `succeeded`, `loadedSkill`). `pr-review` council inline diff passed (**1 case / 9 assertions**, same model / 3 perspectives). `full-send` local `run` loaded the skill with 1 read call and 0 writes/execs/merges |
| GitHub PR replay | **PASS** (local replay) | [Private test PR #1](https://github.com/mreasonyang/agent2cursor/pull/1) passed via HMAC-signed **local replay** (bounded snapshot + 3 reviewer delegates + Chinese table; 0 tool errors, 0 writes/execs, 0 GitHub comments/reactions/reviews; PR closed unmerged). Not a live hosted webhook delivery |
| Cloud hosting & npm release | **Not run / On hold** | `agent-sdk deploy --dry-run` stopped because the test account has no default team configured; no hosted deployment or URL exists. The repository is private, the package has `private: true`, and npm release is on hold |

These checks do not prove average model quality, multi-provider routing, or child-agent tool isolation. Full records: [acceptance results](docs/acceptance.md) · [upstream verification](docs/upstream-verification.md) · [sanitized online evidence](docs/evidence/online-2026-10-27.json) · [official example provenance](docs/official-examples.provenance.json).

## Contributing and License

Maintainer commands (`npm run check`, `npm run test:sdk`, `node scripts/build-demos.mjs`) and safety invariants are in [CONTRIBUTING.md](CONTRIBUTING.md).

`agent2cursor` is MIT-licensed (`Copyright (c) 2026 Eason Yang`, [LICENSE](LICENSE)). The pinned snapshot in [`fixtures/tstack`](fixtures/tstack) ([`PROVENANCE.json`](fixtures/tstack/PROVENANCE.json)) and the adapted demos derive from [t3dotgg/tstack](https://github.com/t3dotgg/tstack), `Copyright (c) 2026 Theo Browne`, under the MIT license ([`fixtures/tstack/LICENSE`](fixtures/tstack/LICENSE) and `LICENSE-tstack`); recognized `tstack` inputs must retain this MIT notice. `@grok/agent-sdk@0.3.0` is a proprietary dependency (no SDK source or docs are vendored here). Not affiliated with or endorsed by Theo Browne, T3, Anthropic, Cursor, Anysphere, or xAI. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
