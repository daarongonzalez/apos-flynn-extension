import type { Description } from './describe.ts';
import { normalize } from './text.ts';

export interface ChangeEntry {
  label: string;
  before: string;
  after: string;
  occurrence?: number;
  total?: number;
  where?: Description;
}

const NAMES: Record<string, string> = {
  H1: 'Heading 1', H2: 'Heading 2', H3: 'Heading 3', H4: 'Heading 4', H5: 'Heading 5', H6: 'Heading 6',
};

function ordinal(n: number): string {
  const tail = n % 100 >= 11 && n % 100 <= 13 ? 'th' : (['th', 'st', 'nd', 'rd'][n % 10] ?? 'th');
  return `${n}${tail}`;
}

/** Lines that say which element a change belongs to. */
export function describeEntry(change: ChangeEntry): string[] {
  const where = change.where;
  const lines: string[] = [];
  if (where) {
    lines.push(`Element: \`${where.element}\``);
    const place = [where.area, where.heading && `under the heading "${where.heading}"`].filter(Boolean).join(', ');
    if (place) lines.push(`Location: ${place}`);
    lines.push(`Path: \`${where.path}\``);
    if (where.href) lines.push(`Links to: ${where.href}`);
  }
  if (change.total && change.total > 1) {
    lines.push(`Note: this text appears ${change.total} times on the page. This is the ${ordinal((change.occurrence ?? 0) + 1)}.`);
  }
  return lines;
}

/** The plain-language record of a session's edits, ready to paste into Claude Code or a pull request. */
export function buildChangeFile(url: string, changes: ChangeEntry[], title?: string): string {
  const lines = ['# Copy changes', `Page: ${url}`];
  if (title) lines.push(`Page title: ${title}`);
  lines.push(`Changes: ${changes.length}`, '');
  changes.forEach((change, i) => {
    const name = NAMES[change.label] ? `${NAMES[change.label]} (${change.label})` : change.label;
    lines.push(
      `## ${i + 1}. ${name}`,
      ...describeEntry(change),
      `Before: ${normalize(change.before)}`,
      `After:  ${normalize(change.after)}`,
      '',
    );
  });
  return lines.join('\n').trimEnd() + '\n';
}
