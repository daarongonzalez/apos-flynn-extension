// Describes where a piece of text sits on the page, in terms a person or an AI
// coding tool can use to find it in the code.

import { tagOf } from './parts.ts';
import { normalize } from './text.ts';

export interface Description {
  /** The element's opening tag, such as <h1 class="hero-title">. */
  element: string;
  /** A path from the top of the page down to the element. */
  path: string;
  /** The part of the page it sits in: Navigation, Header, Main content, Footer, Sidebar. */
  area?: string;
  /** The nearest heading above it. */
  heading?: string;
  /** Where a link points. */
  href?: string;
}

const AREAS: Record<string, string> = {
  NAV: 'Navigation', HEADER: 'Header', FOOTER: 'Footer', MAIN: 'Main content', ASIDE: 'Sidebar',
};

const SHOWN_ATTRIBUTES = ['id', 'class', 'href', 'role', 'aria-label', 'type', 'name', 'data-testid'];

/** Class names worth showing: skips build-tool noise that changes between builds. */
function usefulClasses(el: Element): string[] {
  return Array.from(el.classList).filter((name) => /^[a-zA-Z_][\w-]*$/.test(name) && !/^astro-|^css-|^sc-|^jsx-/.test(name));
}

function clip(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function openingTag(el: Element): string {
  const attributes = SHOWN_ATTRIBUTES.filter((name) => el.getAttribute(name)).map(
    (name) => `${name}="${clip(el.getAttribute(name)!, 80)}"`,
  );
  return `<${[el.tagName.toLowerCase(), ...attributes].join(' ')}>`;
}

function step(el: Element): string {
  const tag = el.tagName.toLowerCase();
  if (el.id && /^[a-zA-Z_][\w-]*$/.test(el.id)) return `${tag}#${el.id}`;
  const classes = usefulClasses(el).slice(0, 2).map((name) => `.${name}`).join('');
  const twins = el.parentElement ? Array.from(el.parentElement.children).filter((other) => other.tagName === el.tagName) : [];
  const position = twins.length > 1 ? `:nth-of-type(${twins.indexOf(el) + 1})` : '';
  return tag + classes + position;
}

function pathTo(el: Element): string {
  const steps: string[] = [];
  for (let node: Element | null = el; node && tagOf(node) !== 'BODY' && tagOf(node) !== 'HTML'; node = node.parentElement) {
    steps.unshift(step(node));
    if (node.id) break;
  }
  return steps.join(' > ');
}

const headingLevel = (el: Element) => (/^H[1-6]$/.test(tagOf(el)) ? Number(tagOf(el)[1]) : 7);

function headingAbove(el: Element): string | undefined {
  const own = headingLevel(el);
  let found: Element | undefined;
  for (const heading of Array.from(el.ownerDocument.querySelectorAll('h1, h2, h3, h4, h5, h6'))) {
    if (heading === el || el.contains(heading) || heading.contains(el)) continue;
    if (!(heading.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING)) break;
    if (headingLevel(heading) < own) found = heading;
  }
  const text = found && normalize(found.textContent ?? '');
  return text ? clip(text, 80) : undefined;
}

export function describe(el: Element): Description {
  const landmark = el.closest('nav, header, footer, main, aside');
  const link = el.closest('a[href]') ?? (el.children.length === 1 ? el.querySelector(':scope > a[href]') : null);
  return {
    element: openingTag(el),
    path: pathTo(el),
    area: landmark ? AREAS[tagOf(landmark)] : undefined,
    heading: headingAbove(el),
    href: link?.getAttribute('href') ?? undefined,
  };
}
