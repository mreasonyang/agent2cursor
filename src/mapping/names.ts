export function slugName(value: string, fallback: string): string {
  const slug = value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Za-z0-9_-]+/g, "-")
    .replace(/^[^A-Za-z0-9]+|[-_]+$/g, "").slice(0, 96).replace(/[-_]+$/g, "");
  return slug || fallback;
}

export function scriptName(relativePath: string): string {
  const withoutExtension = relativePath.replace(/\.[^.\/]+$/, "");
  return slugName(withoutExtension.replace(/[/\\-]+/g, "_"), "script").replace(/-/g, "_");
}
