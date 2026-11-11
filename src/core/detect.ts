import { ATOMIC, tagOf } from './parts.ts';
import { normalize } from './text.ts';

/** Never looked inside when searching the page. */
const SKIP = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'HEAD', 'TITLE', 'PRE', 'CODE', 'KBD', 'SAMP', 'OPTION']);

/** Formatting that can sit inside a piece of text without splitting it up. */
const INLINE = new Set([
  'A', 'B', 'STRONG', 'I', 'EM', 'U', 'S', 'SPAN', 'SMALL', 'MARK', 'SUB', 'SUP', 'ABBR',
  'CITE', 'Q', 'TIME', 'DEL', 'INS', 'CODE', 'KBD', 'SAMP', 'VAR', 'BDI', 'BDO', 'FONT',
]);

/** Elements that are one piece of text even when every word is wrapped in its own tag. */
const TEXT_BLOCKS = new Set([
  'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'P', 'LI', 'BLOCKQUOTE', 'FIGCAPTION', 'DT', 'DD',
  'A', 'BUTTON', 'LABEL', 'SUMMARY', 'TD', 'TH', 'CAPTION', 'LEGEND',
]);

const LABELS: Record<string, string> = {
  H1: 'H1', H2: 'H2', H3: 'H3', H4: 'H4', H5: 'H5', H6: 'H6',
  BUTTON: 'Button', A: 'Link', P: 'Paragraph', LI: 'List item', BLOCKQUOTE: 'Quote',
  FIGCAPTION: 'Caption', CAPTION: 'Caption', LABEL: 'Label', LEGEND: 'Label',
  SUMMARY: 'Summary', TD: 'Table cell', TH: 'Table heading', DT: 'Term', DD: 'Definition',
};

/** When several labels fit (a link inside a heading), the earliest in this list wins. */
const PRIORITY = ['H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'Button', 'Link'];

const MAX_UNITS = 3000;

function hasDirectText(el: Element): boolean {
  for (const node of Array.from(el.childNodes)) {
    if (node.nodeType === Node.TEXT_NODE && (node as Text).data.trim()) return true;
  }
  return false;
}

function inlineOnly(el: Element): boolean {
  for (const child of Array.from(el.children)) {
    const tag = tagOf(child);
    if (ATOMIC.has(tag)) continue;
    if (!INLINE.has(tag) || !inlineOnly(child)) return false;
  }
  return true;
}

function visible(el: Element): boolean {
  const rect = el.getBoundingClientRect();
  if (!rect.width || !rect.height) return false;
  const check = (el as any).checkVisibility;
  return typeof check === 'function' ? check.call(el, { visibilityProperty: true }) : true;
}

/** Finds every piece of text a person could edit, in page order. */
export function detect(root: Element, ignore: (el: Element) => boolean = () => false): HTMLElement[] {
  const out: HTMLElement[] = [];
  const visit = (el: Element) => {
    if (out.length >= MAX_UNITS) return;
    const tag = tagOf(el);
    if (SKIP.has(tag) || ATOMIC.has(tag) || ignore(el)) return;
    const isText = (TEXT_BLOCKS.has(tag) || hasDirectText(el)) && normalize(el.textContent ?? '') !== '';
    if (isText && inlineOnly(el)) {
      if (visible(el)) out.push(el as HTMLElement);
      return;
    }
    for (const child of Array.from(el.children)) visit(child);
  };
  visit(root);
  return out;
}

function ownLabel(el: Element): string | undefined {
  if (el.getAttribute('role') === 'button') return 'Button';
  if (el.getAttribute('role') === 'heading') return `H${el.getAttribute('aria-level') ?? '2'}`;
  return LABELS[tagOf(el)];
}

/** The label shown for a piece of text: H1, Paragraph, Button, Link and so on. */
export function labelFor(el: Element): string {
  const text = normalize(el.textContent ?? '');
  const found: string[] = [];
  const add = (candidate: Element) => {
    const label = ownLabel(candidate);
    if (label) found.push(label);
  };
  add(el);
  // Wrappers around the same words, such as a link that fills a list item.
  let up = el.parentElement;
  for (let i = 0; up && i < 4 && normalize(up.textContent ?? '') === text; i++, up = up.parentElement) add(up);
  let down: Element = el;
  while (down.children.length === 1 && normalize(down.children[0].textContent ?? '') === text) {
    down = down.children[0];
    add(down);
  }
  for (const label of PRIORITY) if (found.includes(label)) return label;
  return found[0] ?? 'Text';
}
