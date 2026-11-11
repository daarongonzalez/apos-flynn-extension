import { normalize } from './text.ts';

export interface ChangeEntry {
  label: string;
  before: string;
  after: string;
}

/** The plain-language record of a session's edits, ready to paste into Claude Code or a pull request. */
export function buildChangeFile(url: string, changes: ChangeEntry[]): string {
  const lines = ['# Copy changes', `Page: ${url}`, `Changes: ${changes.length}`, ''];
  changes.forEach((change, i) => {
    lines.push(
      `## ${i + 1}. ${change.label}`,
      `Before: ${normalize(change.before)}`,
      `After:  ${normalize(change.after)}`,
      '',
    );
  });
  return lines.join('\n').trimEnd() + '\n';
}
