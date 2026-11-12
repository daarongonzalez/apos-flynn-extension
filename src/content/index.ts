// Runs inside the page being edited. Finds the text, lets the user rewrite it in
// place, keeps the list of changes, and saves drafts in the browser.

import { describe } from '../core/describe.ts';
import { detect, labelFor } from '../core/detect.ts';
import { knownElements, readParts, stripUnknown, writeParts } from '../core/parts.ts';
import { joinParts, sameParts } from '../core/text.ts';
import type { Draft, PageState, PanelMessage, StateMessage } from '../core/types.ts';
import { Overlay } from './overlay.ts';

interface Unit {
  el: HTMLElement;
  label: string;
  /** The text as the site wrote it. */
  original: string[];
  /** The element's original contents, kept from the first edit, for a full restore. */
  html?: string;
  known: Set<Element>;
  draft?: Draft;
  reapplied: number;
}

declare global {
  interface Window {
    __flynnLoaded?: boolean;
  }
}

function start(): void {
  const overlay = new Overlay();
  let registry = new Map<Element, Unit>();
  let units: Unit[] = [];
  const drafts = new Map<string, Draft>();
  let editing = true;
  let active: Unit | null = null;
  let session: { parts: string[]; html: string; attr: string | null } | null = null;
  let hover: Unit | null = null;
  let flash: Unit | null = null;
  let href = location.href;

  const storageKey = () => `drafts:${location.origin}${location.pathname}`;

  // ---- Finding text on the page -------------------------------------------------

  /** Runs a change Flynn makes itself, without the page watcher treating it as the site's doing. */
  function mutate(change: () => void): void {
    change();
    observer.takeRecords();
  }

  function rescan(): void {
    if (active) return;
    const next = new Map<Element, Unit>();
    for (const el of detect(document.body, (candidate) => candidate === overlay.host)) {
      let unit = registry.get(el);
      if (!unit) {
        unit = { el, label: labelFor(el), original: readParts(el), known: knownElements(el), reapplied: 0 };
      } else if (!unit.draft) {
        unit.original = readParts(el);
        unit.known = knownElements(el);
        unit.html = undefined;
      }
      next.set(el, unit);
    }
    // An edited element stays tracked for as long as it is on the page.
    for (const unit of registry.values()) {
      if (unit.draft && unit.el.isConnected && !next.has(unit.el)) next.set(unit.el, unit);
    }
    registry = next;
    units = [...next.values()];
    reconcile();
    draw();
    notify();
  }

  function applyDraft(unit: Unit, draft: Draft): void {
    mutate(() => {
      if (!writeParts(unit.el, draft.after)) {
        unit.el.innerHTML = draft.afterHTML;
        unit.known = knownElements(unit.el);
      }
    });
  }

  /** Puts saved edits back on the page after a reload, or after the site redraws itself. */
  function reconcile(): void {
    const bound = new Map<string, Unit>();
    for (const unit of units) if (unit.draft) bound.set(unit.draft.id, unit);
    for (const draft of drafts.values()) {
      const holder = bound.get(draft.id);
      if (holder) {
        if (sameParts(readParts(holder.el), holder.original) && holder.reapplied < 5) {
          holder.reapplied++;
          applyDraft(holder, draft);
        }
        continue;
      }
      const text = joinParts(draft.before);
      const candidates = units.filter((unit) => !unit.draft && joinParts(unit.original) === text);
      const unit = candidates[draft.occurrence] ?? candidates[0];
      if (!unit) continue;
      unit.html = unit.el.innerHTML;
      unit.draft = draft;
      // Refresh the description in case the page was rearranged since the edit was made.
      draft.where = describe(unit.el);
      draft.total = candidates.length;
      draft.occurrence = candidates.indexOf(unit);
      applyDraft(unit, draft);
    }
  }

  const unitOf = (id: string) => units.find((unit) => unit.draft?.id === id);

  function findUnit(target: EventTarget | null): Unit | null {
    let node = target instanceof Node ? target : null;
    while (node) {
      if (node instanceof Element) {
        const unit = registry.get(node);
        if (unit) return unit;
      }
      node = node.parentNode;
    }
    return null;
  }

  // ---- Editing ------------------------------------------------------------------

  function startEdit(unit: Unit, x: number, y: number): void {
    if (active) finishEdit(false);
    const el = unit.el;
    if (!unit.draft) unit.html = el.innerHTML;
    session = { parts: readParts(el), html: el.innerHTML, attr: el.getAttribute('contenteditable') };
    active = unit;
    try {
      el.contentEditable = 'plaintext-only';
    } catch {
      el.contentEditable = 'true';
    }
    el.focus({ preventScroll: true });
    const range = document.caretRangeFromPoint?.(x, y);
    const selection = window.getSelection();
    if (selection) {
      selection.removeAllRanges();
      if (range && el.contains(range.startContainer)) {
        selection.addRange(range);
      } else {
        selection.selectAllChildren(el);
        selection.collapseToEnd();
      }
    }
    draw();
  }

  function restore(unit: Unit, parts: string[], html: string): void {
    if (!writeParts(unit.el, parts)) {
      unit.el.innerHTML = html;
      unit.known = knownElements(unit.el);
    }
  }

  function finishEdit(cancel: boolean): void {
    const unit = active;
    const started = session;
    if (!unit || !started) return;
    active = null;
    session = null;
    mutate(() => {
      stripUnknown(unit.el, unit.known);
      if (cancel) restore(unit, started.parts, started.html);
      else if (!joinParts(readParts(unit.el))) restore(unit, unit.original, unit.html ?? started.html);
    });
    if (started.attr === null) unit.el.removeAttribute('contenteditable');
    else unit.el.setAttribute('contenteditable', started.attr);
    unit.el.blur();
    updateDraft(unit);
    save();
    draw();
    notify();
  }

  function updateDraft(unit: Unit): void {
    const current = readParts(unit.el);
    if (sameParts(current, unit.original)) {
      if (unit.draft) drafts.delete(unit.draft.id);
      unit.draft = undefined;
      return;
    }
    const text = joinParts(unit.original);
    const twins = units.filter((other) => joinParts(other.original) === text);
    const draft: Draft = unit.draft ?? {
      id: crypto.randomUUID(),
      label: unit.label,
      before: unit.original,
      after: current,
      beforeHTML: unit.html ?? '',
      afterHTML: '',
      occurrence: Math.max(0, twins.indexOf(unit)),
      total: twins.length,
      where: describe(unit.el),
    };
    draft.after = current;
    draft.afterHTML = unit.el.innerHTML;
    unit.draft = draft;
    drafts.set(draft.id, draft);
  }

  function undo(id: string): void {
    const unit = unitOf(id);
    if (unit) {
      if (active === unit) finishEdit(true);
      mutate(() => restore(unit, unit.original, unit.draft?.beforeHTML ?? unit.html ?? ''));
      unit.draft = undefined;
    }
    drafts.delete(id);
  }

  // ---- Saving and reporting -----------------------------------------------------

  let saveTimer: number | undefined;
  function save(): void {
    window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(() => {
      const key = storageKey();
      if (drafts.size) chrome.storage.local.set({ [key]: [...drafts.values()] });
      else chrome.storage.local.remove(key);
    }, 150);
  }

  async function load(): Promise<void> {
    const key = storageKey();
    const stored = await chrome.storage.local.get(key);
    drafts.clear();
    for (const draft of (stored[key] as Draft[] | undefined) ?? []) drafts.set(draft.id, draft);
  }

  function state(): PageState {
    return {
      url: location.origin + location.pathname,
      title: document.title,
      editing,
      unitCount: units.length,
      changes: [...drafts.values()].map((draft) => ({
        id: draft.id,
        label: draft.label,
        before: joinParts(draft.before),
        after: joinParts(draft.after),
        missing: !unitOf(draft.id),
        occurrence: draft.occurrence,
        total: draft.total,
        where: draft.where,
      })),
    };
  }

  function notify(): void {
    const message: StateMessage = { type: 'flynn:state', state: state() };
    // Nobody is listening when the side panel is closed, which is fine.
    Promise.resolve(chrome.runtime.sendMessage(message)).catch(() => {});
  }

  // ---- Drawing ------------------------------------------------------------------

  let frame = 0;
  function draw(): void {
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      overlay.setVisible(editing);
      if (!editing) return;
      // Only the text under the pointer is outlined, plus anything being edited or already changed.
      overlay.draw(
        units.filter((unit) => unit === hover || unit === active || unit === flash || unit.draft).map((unit) => unit.el),
        (el) => {
          const unit = registry.get(el)!;
          return {
            label: unit.label,
            changed: !!unit.draft,
            editing: unit === active,
            hover: unit === hover && unit !== active,
            flash: unit === flash,
          };
        },
      );
    });
  }

  const inButton = (el: Element) => !!el.closest('button, summary, [role="button"]');

  // ---- Page events --------------------------------------------------------------

  const capture = { capture: true } as const;

  window.addEventListener(
    'click',
    (event) => {
      if (!editing) return;
      // While edit mode is on, links and buttons on the page do not fire.
      event.preventDefault();
      event.stopImmediatePropagation();
      const unit = findUnit(event.target);
      if (unit && unit !== active) startEdit(unit, event.clientX, event.clientY);
      else if (!unit && active) finishEdit(false);
    },
    capture,
  );

  for (const type of ['mousedown', 'mouseup', 'pointerdown', 'pointerup', 'dblclick', 'auxclick'] as const) {
    window.addEventListener(type, (event) => editing && event.stopImmediatePropagation(), capture);
  }

  window.addEventListener('submit', (event) => editing && event.preventDefault(), capture);

  window.addEventListener(
    'dragstart',
    (event) => {
      if (editing) event.preventDefault();
    },
    capture,
  );

  window.addEventListener(
    'mousemove',
    (event) => {
      if (!editing) return;
      const unit = findUnit(event.target);
      if (unit !== hover) {
        hover = unit;
        draw();
      }
    },
    { capture: true, passive: true },
  );

  window.addEventListener(
    'keydown',
    (event) => {
      if (!active) return;
      // The site's own keyboard shortcuts stay quiet while someone is typing copy.
      event.stopImmediatePropagation();
      if (event.key === 'Enter' && !event.isComposing) {
        event.preventDefault();
        finishEdit(false);
      } else if (event.key === 'Escape') {
        event.preventDefault();
        finishEdit(true);
      } else if (event.key === ' ' && inButton(active.el)) {
        // Browsers treat the space bar inside a button as a press, so the space is typed by hand.
        event.preventDefault();
        document.execCommand('insertText', false, ' ');
      }
    },
    capture,
  );
  for (const type of ['keyup', 'keypress'] as const) {
    window.addEventListener(
      type,
      (event) => {
        if (!active) return;
        event.stopImmediatePropagation();
        if (event.key === ' ' && inButton(active.el)) event.preventDefault();
      },
      capture,
    );
  }

  window.addEventListener(
    'paste',
    (event) => {
      if (!active || active.el.contentEditable === 'plaintext-only') return;
      // Older browsers: paste as plain words, with no formatting.
      event.preventDefault();
      const text = (event.clipboardData?.getData('text/plain') ?? '').replace(/\s+/g, ' ');
      const selection = window.getSelection();
      if (!selection?.rangeCount) return;
      selection.deleteFromDocument();
      selection.getRangeAt(0).insertNode(document.createTextNode(text));
      selection.collapseToEnd();
      active.el.dispatchEvent(new Event('input', { bubbles: true }));
    },
    capture,
  );

  window.addEventListener(
    'input',
    (event) => {
      if (!active || !active.el.contains(event.target as Node)) return;
      event.stopImmediatePropagation();
      updateDraft(active);
      save();
      draw();
      notify();
    },
    capture,
  );

  window.addEventListener(
    'focusout',
    (event) => {
      if (active && event.target === active.el) finishEdit(false);
    },
    capture,
  );

  window.addEventListener('scroll', draw, { capture: true, passive: true });
  window.addEventListener('resize', draw);
  window.setInterval(draw, 1000);

  // The site changed something itself (loaded content, redrew a section): look again.
  let rescanTimer: number | undefined;
  const observer = new MutationObserver(() => {
    if (active) return;
    window.clearTimeout(rescanTimer);
    rescanTimer = window.setTimeout(rescan, 250);
  });
  observer.observe(document.body, { subtree: true, childList: true, characterData: true });

  // Sites that change pages without a full reload.
  window.setInterval(async () => {
    if (location.href === href) return;
    href = location.href;
    if (active) finishEdit(false);
    registry = new Map();
    units = [];
    await load();
    rescan();
  }, 700);

  // ---- Messages from the side panel ---------------------------------------------

  chrome.runtime.onMessage.addListener((message: PanelMessage, _sender, respond) => {
    switch (message?.type) {
      case 'flynn:get':
        break;
      case 'flynn:setEditing':
        if (active) finishEdit(false);
        editing = message.editing;
        hover = null;
        break;
      case 'flynn:undo':
        undo(message.id);
        save();
        break;
      case 'flynn:discardAll':
        if (active) finishEdit(true);
        for (const id of [...drafts.keys()]) undo(id);
        save();
        break;
      case 'flynn:locate': {
        const unit = unitOf(message.id);
        if (unit) {
          unit.el.scrollIntoView({ block: 'center', behavior: 'smooth' });
          flash = unit;
          window.setTimeout(() => {
            flash = null;
            draw();
          }, 1400);
        }
        break;
      }
      default:
        return;
    }
    draw();
    respond(state());
    if (message.type !== 'flynn:get') notify();
  });

  load().then(rescan);
}

if (!window.__flynnLoaded) {
  window.__flynnLoaded = true;
  start();
}
