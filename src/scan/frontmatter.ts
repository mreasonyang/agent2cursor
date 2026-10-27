import { parseDocument } from "yaml";

export interface ParsedMarkdown { frontmatter: Record<string, unknown>; body: string }

function assertNoSensitiveKeys(value: unknown, file: string, prefix = "", depth = 0, budget = { fields: 0 }): void {
  if (depth > 30) throw new Error(`Frontmatter nesting exceeds 30 levels: ${file}`);
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    if (++budget.fields > 10_000) throw new Error(`Frontmatter exceeds 10000 fields: ${file}`);
    const field = prefix ? `${prefix}.${key}` : key;
    if (/(?:^|[_-])(?:password|passwd|token|secret|credential|private[_-]?key|api[_-]?key)(?:$|[_-])/i.test(key)
      || /^(?:apiKey|accessKey|accessToken|refreshToken|authToken|clientSecret|privateKey|authorization|bearer)$/i.test(key)) {
      throw new Error(`Sensitive frontmatter field is not permitted (${field}): ${file}`);
    }
    assertNoSensitiveKeys(child, file, field, depth + 1, budget);
  }
}

export function parseYamlMapping(text: string, file: string): Record<string, unknown> {
  const doc = parseDocument(text, { uniqueKeys: true, customTags: [], strict: true });
  // YAML diagnostics may include source text, so never relay their raw messages.
  if (doc.errors.length || doc.warnings.length) throw new Error(`Invalid YAML frontmatter: ${file}`);
  let value: unknown;
  try { value = doc.toJS({ maxAliasCount: 0 }); } catch { throw new Error(`YAML aliases are not supported: ${file}`); }
  if (value === null) value = {};
  if (typeof value !== "object" || Array.isArray(value)) throw new Error(`Frontmatter must be a mapping: ${file}`);
  assertNoSensitiveKeys(value, file);
  return value as Record<string, unknown>;
}

export function parseMarkdown(text: string, file: string): ParsedMarkdown {
  const normalized = text.replace(/^\uFEFF/, "");
  const opening = /^(---)[ \t]*\r?\n/.exec(normalized);
  if (!opening) return { frontmatter: {}, body: normalized };
  const rest = normalized.slice(opening[0].length);
  const closing = /^(?:---|\.\.\.)[ \t]*(?:\r?\n|$)/m.exec(rest);
  if (!closing) throw new Error(`Unclosed YAML frontmatter: ${file}`);
  return { frontmatter: parseYamlMapping(rest.slice(0, closing.index), file), body: rest.slice(closing.index + closing[0].length) };
}

/** Includes container keys and nested object keys; arrays retain their index for object entries. */
export function fieldPaths(value: Record<string, unknown>): string[] {
  const result: string[] = [];
  function visit(item: unknown, prefix: string): void {
    if (!item || typeof item !== "object") return;
    for (const [key, child] of Object.entries(item)) {
      const field = prefix ? `${prefix}.${key}` : key;
      result.push(field);
      visit(child, field);
    }
  }
  visit(value, "");
  return result;
}
