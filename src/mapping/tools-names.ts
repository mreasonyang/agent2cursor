export const CLAUDE_TOOL_MAP: Readonly<Record<string, string>> = {
  Read: "read", Grep: "grep", Glob: "glob", Bash: "shell", Edit: "edit", Write: "edit", Agent: "task", Task: "task",
};
export const ROOT_TOOL_NAMES = new Set(["read", "grep", "glob", "ls", "shell", "edit", "delete", "task"]);

export function mapToolNames(value: unknown): { mapped: string[]; unknown: string[] } {
  const names = typeof value === "string" ? value.split(/[,\s]+/).filter(Boolean)
    : Array.isArray(value) ? value.filter((name): name is string => typeof name === "string") : [];
  const mapped = new Set<string>();
  const unknown = new Set<string>();
  for (const name of names) {
    const target = Object.hasOwn(CLAUDE_TOOL_MAP, name) ? CLAUDE_TOOL_MAP[name] : ROOT_TOOL_NAMES.has(name) ? name : undefined;
    if (target) mapped.add(target); else unknown.add(name);
  }
  return { mapped: [...mapped], unknown: [...unknown] };
}
