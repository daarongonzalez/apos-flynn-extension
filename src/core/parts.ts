// An element's text is read as a fixed list of "parts": one for each gap between its
// child elements. "Hello <b>big</b> world" has four parts: "Hello ", "big", "", " world".
// Because the list follows the element structure, an edit to the words can be written
// back without touching bold text, links or anything else inside the element.

/** Elements whose insides are never text to edit. */
export const ATOMIC = new Set([
  'SVG', 'IMG', 'PICTURE', 'VIDEO', 'AUDIO', 'CANVAS', 'IFRAME', 'OBJECT', 'EMBED',
  'BR', 'WBR', 'HR', 'INPUT', 'SELECT', 'TEXTAREA', 'SCRIPT', 'STYLE', 'TEMPLATE',
]);

export const tagOf = (el: Element) => el.tagName.toUpperCase();

interface Slot {
  parent: Element;
  before: ChildNode | null;
  texts: Text[];
}

function slots(el: Element): Slot[] {
  const out: Slot[] = [];
  const visit = (parent: Element) => {
    let texts: Text[] = [];
    for (const child of Array.from(parent.childNodes)) {
      if (child.nodeType === Node.TEXT_NODE) {
        texts.push(child as Text);
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        out.push({ parent, before: child, texts });
        texts = [];
        if (!ATOMIC.has(tagOf(child as Element))) visit(child as Element);
      }
    }
    out.push({ parent, before: null, texts });
  };
  visit(el);
  return out;
}

export function readParts(el: Element): string[] {
  return slots(el).map((slot) => slot.texts.map((t) => t.data).join(''));
}

/** Writes parts back. Returns false, changing nothing, when the element's structure no longer fits. */
export function writeParts(el: Element, parts: string[]): boolean {
  const list = slots(el);
  if (list.length !== parts.length) return false;
  list.forEach((slot, i) => {
    const current = slot.texts.map((t) => t.data).join('');
    if (current === parts[i]) return;
    if (slot.texts.length) {
      slot.texts[0].data = parts[i];
      slot.texts.slice(1).forEach((t) => (t.data = ''));
    } else {
      slot.parent.insertBefore(document.createTextNode(parts[i]), slot.before);
    }
  });
  return true;
}

export function knownElements(el: Element): Set<Element> {
  return new Set(Array.from(el.querySelectorAll('*')));
}

/** Removes elements the browser added while typing (stray line breaks and wrappers), keeping their text. */
export function stripUnknown(el: Element, known: Set<Element>): void {
  for (const child of Array.from(el.querySelectorAll('*'))) {
    if (known.has(child) || !child.isConnected) continue;
    child.replaceWith(document.createTextNode(tagOf(child) === 'BR' ? '' : child.textContent ?? ''));
  }
  el.normalize();
}
