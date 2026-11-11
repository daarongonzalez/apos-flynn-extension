/** Collapse runs of whitespace so text compares the way a reader sees it. */
export function normalize(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

export function joinParts(parts: string[]): string {
  return normalize(parts.join(''));
}

export function sameParts(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((part, i) => part === b[i]);
}
