# Codex conversion fixtures

These are original, synthetic test inputs for the standalone custom-agent schema in the [Codex subagents documentation](https://learn.chatgpt.com/docs/agent-configuration/subagents), checked on 2026-10-28. They are not installed Codex agents and contain no credentials. `codex-source-model` is a fixture identifier, not a supported-model claim; MCP URLs use `example.invalid` and are never contacted.

`project/.codex/agents/` contains two agents, including a nested file, feature/skill restrictions, model settings, parent-only settings, and an unknown field. `project/.agents/skills/codex-check/` exercises [Codex skill metadata](https://learn.chatgpt.com/docs/build-skills): UI fields, an explicit-only invocation policy, and an MCP dependency.

```sh
node dist/cli.js inspect fixtures/codex/project --lang en
node dist/cli.js convert fixtures/codex/project --out /tmp/codex-agent --lang en
```

No source command, skill path, or MCP declaration is executed or resolved. Generated restrictions require operator review; structural SDK validation is separate from live model execution.
