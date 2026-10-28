# Contributing and Maintainer Guide

This document covers local development, verification workflows, demo regeneration, and repository safety rules for `agent2cursor`. For user-facing usage and migration behavior, see [README.md](README.md) ([中文说明](README.zh-CN.md)).

## Prerequisites

- **Node.js `>=22.13`** (enforced at CLI startup and in `package.json`).
- **npm** (used with `package-lock.json`).

Offline unit tests and fixture conversions do not require a Cursor account or network access.

## Project Naming

The public npm package is `@kyun.si/agent2cursor`. Use `agent2cursor` for the executable, generated-code notices, demo names, and repository links. The source workspace keeps `private: true`; the consumer archive omits it. The old executable name is not installed as an alias. Demo workspace snapshots use `.agent2cursor/pr-review.json`, disabled script stubs return `AGENT2CURSOR_STUB_DISABLED`, and the optional merge gate uses `AGENT2CURSOR_ALLOW_MERGE` (disabled by default).

Historical evaluation reports and hash-bound evidence retain the names and paths used by those runs. Do not rewrite them to imply the current sources were evaluated.

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

## npm Release

The public GitHub repository and the npm registry are separate destinations. Keep the source workspace private to npm with `private: true`. `pack:local` builds a clean consumer archive named `kyun.si-agent2cursor-<version>.tgz` under `.validation/npm-release/`, with the scoped package name, public access, the official registry, and the source Git revision. The archive contains the explicit `files` allowlist and omits development dependencies and lifecycle scripts.

```bash
npm run check
npm run pack:local
npm run verify:package
npm run publish:npm -- --dry-run
npm run publish:npm
```

Before the real publish, install the archive into an independent consumer and verify the actual `agent2cursor` executable, conversion, demos, and doctor. `publish:npm` verifies the recorded source hashes, Git revision, archive size and SHA-256, and publishes that same archive without repacking. Any changed input requires rebuilding and rechecking. Login and two-factor authentication stay in npm's own flow; no credentials belong in source or evidence.

CI uses `verify:package` to check the archive without publishing. npm rejects publishing an existing version even with `--dry-run`; after a version is released, bump the version before preparing its successor. Published bytes remain bound to the `sourceRevision` in the publication receipt.

After publication, read the registry metadata and download its tarball anonymously. Verify SHA-256 and registry integrity against the candidate, then install `@kyun.si/agent2cursor@<version>` from the public registry into a clean consumer and repeat the CLI checks. Record the public metadata and verification results in `npm-publication.json`. Do not claim publication before this readback succeeds.

## Evaluation Evidence

Keep tests, demo eval suites and source fixtures with the implementation. [evaluation/README.md](evaluation/README.md) indexes the independent evaluation; `docs/evidence/` contains bounded, portable summaries. Local raw runs, generated projects and deployment workspaces are ignored. Preserve those artifacts locally when they are needed for an audit; do not stage them with a blanket `git add`.

The maintained demo projects live only in `demos/`. Create personal deployment copies outside the repository or in the ignored `deployments/` directory. The README animation retains its editable source under `docs/demo-video/` and final media under `docs/assets/`.

## Repository Rules and Safety Invariants

1. **Account for every source field.** Every YAML frontmatter, Codex agent TOML, and `agents/openai.yaml` field path must appear in `MIGRATION.zh-CN.md` / `MIGRATION.en.md` as `mapped`, `degraded`, or `dropped`.
2. **Never silently expand permissions.** Do not claim a root `tools` allowlist isolates `task` subagents, and never describe an agent with `shell` enabled as read-only.
3. **Keep script tools disabled by default.** Source scripts under `skills/*/scripts/*` are copied without execution bits, and generated `bot/tools/*.ts` wrappers must remain disabled stubs (`AGENT2CURSOR_STUB_DISABLED`) until an operator implements a typed JSON stdin/stdout contract.
4. **Safe filesystem handling.** Conversion must never execute source scripts, overwrite existing output directories, traverse symlinks, or read/copy credential files (`.env`, `.npmrc`, private keys, or sensitive YAML keys).
5. **Keep evidence levels separate.** Do not conflate unit tests or `agent-sdk validate` / `eval --list` with live model execution, real GitHub webhook delivery, hosted deployment, or npm publication. See [docs/acceptance.md](docs/acceptance.md) and [docs/upstream-verification.md](docs/upstream-verification.md).
6. **Credential-safe diagnostics.** Never write raw process `argv`, environment dumps, authentication files, or unfiltered runtime logs into diagnostics, tests, or committed evidence files.
