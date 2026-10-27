# Contributing and Maintainer Guide

This document covers local development, verification workflows, demo regeneration, and repository safety rules for `cc-to-cursor-agent`. For user-facing usage and migration behavior, see [README.md](README.md) ([中文说明](README.zh-CN.md)).

## Prerequisites

- **Node.js `>=22.13`** (enforced at CLI startup and in `package.json`).
- **npm** (used with `package-lock.json`).

Offline unit tests and fixture conversions do not require a Cursor account or network access.

## Build and Unit Tests

Run the TypeScript compiler and the automated tests before delivering changes:

```bash
npm ci --ignore-scripts
npm run check
```

Individual scripts defined in [package.json](package.json):

| Command | Purpose |
| --- | --- |
| `npm run build` | Compile TypeScript (`src/` to `dist/`) via `tsc` |
| `npm test` | Run the test suite (`tsx --test test/*.test.ts`) |
| `npm run check` | Run `npm run build && npm test` |
| `npm run dev -- <args>` | Run `src/cli.ts` directly via `tsx` |
| `npm run test:sdk` | Run structural SDK verification via `scripts/verify-sdk.mjs` |

## Structural SDK Verification (`.validation/`)

SDK integration tests install `@grok/agent-sdk@0.3.0` into the gitignored `.validation/` directory and invoke only its public CLI (`validate`, `info`, `eval --list`), followed by strict TypeScript typechecking on generated projects:

```bash
npm run build
npm install --prefix .validation --ignore-scripts --no-audit --no-fund @grok/agent-sdk@0.3.0
npm run test:sdk
```

Never vendor SDK source code or bundled SDK documentation into the repository.

Generated projects live in system temporary directories outside this checkout. The check verifies default conversion and a failing `doctor` before installing each project's own dependencies without lifecycle scripts, then runs validation, strict TypeScript and eval discovery. Do not generate these projects under `.validation/`: its dependencies would mask first-run failures. Sanitized evidence stays in `.validation/acceptance-*/`.

## Regenerating Demos

The two demos ([demos/full-send](demos/full-send) and [demos/pr-review](demos/pr-review)) are generated from the pinned [t3dotgg/tstack](https://github.com/t3dotgg/tstack) MIT snapshot in [fixtures/tstack](fixtures/tstack) (`7de017b3fc9d50c03cf3ecb98fb71e0ca65a78bd`) and templates in `scripts/demo-templates/`:

```bash
node scripts/build-demos.mjs
```

After regenerating demos, run `npm run check` to verify that provenance hashes, license files (`LICENSE-tstack`), and channel/snapshot templates remain in sync.

## Evaluation Evidence

Keep tests, demo eval suites and source fixtures with the implementation. [evaluation/README.md](evaluation/README.md) indexes the independent evaluation; `docs/evidence/` contains bounded, portable summaries. Local raw runs, generated projects and deployment workspaces are ignored. Preserve those artifacts locally when they are needed for an audit; do not stage them with a blanket `git add`.

The maintained demo projects live only in `demos/`. Create personal deployment copies outside the repository or in the ignored `deployments/` directory. The README animation retains its editable source under `docs/demo-video/` and final media under `docs/assets/`.

## Repository Rules and Safety Invariants

1. **Account for every frontmatter field.** Every input frontmatter field path must appear in `MIGRATION.zh-CN.md` / `MIGRATION.en.md` as `mapped`, `degraded`, or `dropped`.
2. **Never silently expand permissions.** Do not claim a root `tools` allowlist isolates `task` subagents, and never describe an agent with `shell` enabled as read-only.
3. **Keep script tools disabled by default.** Source scripts under `skills/*/scripts/*` are copied without execution bits, and generated `bot/tools/*.ts` wrappers must remain disabled stubs (`CC_TO_CURSOR_AGENT_STUB_DISABLED`) until an operator implements a typed JSON stdin/stdout contract.
4. **Safe filesystem handling.** Conversion must never execute source scripts, overwrite existing output directories, traverse symlinks, or read/copy credential files (`.env`, `.npmrc`, private keys, or sensitive YAML keys).
5. **Keep evidence levels separate.** Do not conflate unit tests or `agent-sdk validate` / `eval --list` with live model execution, real GitHub webhook delivery, hosted deployment, or npm publication. See [docs/acceptance.md](docs/acceptance.md) and [docs/upstream-verification.md](docs/upstream-verification.md).
6. **Credential-safe diagnostics.** Never write raw process `argv`, environment dumps, authentication files, or unfiltered runtime logs into diagnostics, tests, or committed evidence files.
