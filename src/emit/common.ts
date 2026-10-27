export function literal(value: unknown): string {
  return JSON.stringify(value).replaceAll("\u2028", "\\u2028").replaceAll("\u2029", "\\u2029");
}

export function todo(message: string): string {
  return message.split(/[\r\n\u2028\u2029]+/u).map((line) => `  // TODO(cc2agent): ${line}`).join("\n");
}

export function assertId(id: string, kind: string): void {
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]*$/u.test(id)) {
    throw new Error(`Invalid ${kind} id: ${JSON.stringify(id)}`);
  }
}

export function markdown(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    .replaceAll("|", "\\|").replaceAll("`", "&#96;").replace(/[\r\n]+/gu, " ");
}
