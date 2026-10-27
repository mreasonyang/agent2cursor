# Claude agent migration fixtures

These four original test fixtures cover the code-reviewer, debugger, data-scientist,
and read-only database patterns described in the Claude subagent documentation:
https://code.claude.com/docs/en/sub-agents

They are independently written examples, not a verbatim copy of the official
documentation. They deliberately include unsupported fields and a nested agent
directory to exercise loss reporting and recursive discovery. No real credentials,
database connections, or executable query guards are included.
