# cc2agent MVP · 2026-10-27

Owner: Eason Yang (@mr_easonyang). Working name pending public release.

The source brief requests a Node >=22.13 / TypeScript CLI that ejects loose Claude subagents, Agent Skills and tstack into editable Agent SDK 0.3.0 projects. Its value is transparent loss reporting, editable source, generated evals and Chinese templates, in addition to official runtime plugin loading.

## Scope

1. `convert`, `inspect`, `demo`, `doctor`; multi-input recursive scan; deterministic identity/collision handling; no overwrites; dry-run and JSON modes.
2. Frontmatter field accounting, model inheritance/mapping, explicit root tools, foreign tool detection, tstack dependency closure and Codex eval triggers.
3. Source projects, preserved skill resources, disabled JSON script-tool stubs, root eval suites, Chinese/English instructions and reports.
4. Exact MIT provenance for a pinned tstack snapshot and two adapted demos: full-send with an explicit merge gate; council PR review with honest model degradation.
5. Installed CLI validation with credential-safe diagnostics; local, real-inference, deployment and publication evidence recorded separately.

## Acceptance evidence

| Gate | Required proof |
| --- | --- |
| Four Claude example patterns | Generated SDK project validates with zero errors |
| tstack nine skills | SDK info discovers nine skills and pr_wait agent tool |
| Field accounting | Automated tests cover every input field path and its disposition |
| Evals | SDK lists generated cases; live loadedSkill pass is a separate gate |
| full-send | No automatic merge by default; live skill run is a separate gate |
| pr-review | Three reviewer delegates and Council review rubric; actual PR event is separate |
| Hosting | Successful deployment and URL, only with configured team/account/repository |
| Packaging | Clean npm tarball, executable installed CLI, correct dependencies/licenses |
| Publication | Final name, npm and GitHub release plus live consumer check; local pack is not publication |

## Implementation decisions

- Preserve source text without executing it. Script schema/argument semantics cannot be inferred safely, so generated script tools fail explicitly until implemented.
- A shell-capable agent is not read-only. Default reviewer tools exclude shell/edit. The full-send demo cannot claim autonomous test/push behavior while shell is disabled.
- Read SDK docs locally for compatibility; depend on the proprietary SDK, never redistribute its source or docs.
- Never print credentials, raw runtime logs, full environments, or process launch arguments. Login is interactive, not key collection in chat.
- The nine requirements above remain individually open until their evidence is recorded in `docs/acceptance.md`.
