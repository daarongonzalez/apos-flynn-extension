// The side panel: shows the list of changes for the page in the current tab and
// holds the controls. The page itself keeps the edits; the panel only displays them.

import { buildChangeFile } from '../core/changeFile.ts';
import type { PageState, PanelMessage, StateMessage } from '../core/types.ts';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const toggle = $<HTMLButtonElement>('toggle');
const idle = $('idle');
const idleText = $('idle-text');
const main = $('main');
const footer = $('footer');
const page = $('page');
const count = $('count');
const paneChanges = $('pane-changes');
const paneFile = $('pane-file');
const file = $('file');
const copy = $<HTMLButtonElement>('copy');
const discard = $<HTMLButtonElement>('discard');
const tabs = [$<HTMLButtonElement>('tab-changes'), $<HTMLButtonElement>('tab-file')];

const IDLE_DEFAULT = 'Go to the site you are working on, then click the Flynn icon in the toolbar.';
const IDLE_BLOCKED = 'This page cannot be edited. Flynn works on websites, not on browser pages or the Chrome Web Store.';

let tabId: number | undefined;
let state: PageState | null = null;
let blocked = false;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

async function send(message: PanelMessage): Promise<void> {
  if (tabId === undefined) return;
  try {
    state = (await chrome.tabs.sendMessage(tabId, message)) ?? null;
  } catch {
    state = null;
  }
  render();
}

function render(): void {
  const on = state !== null;
  idle.hidden = on;
  main.hidden = !on;
  footer.hidden = !on;
  toggle.hidden = !on;
  idleText.textContent = blocked ? IDLE_BLOCKED : IDLE_DEFAULT;
  if (!state) return;

  toggle.setAttribute('aria-pressed', String(state.editing));
  page.textContent = state.url.replace(/^https?:\/\//, '');
  const changes = state.changes;
  count.textContent = changes.length ? `(${changes.length})` : '';
  copy.disabled = discard.disabled = !changes.length;

  paneChanges.textContent = '';
  if (!changes.length) {
    const hint = !state.editing
      ? 'Edit mode is off. Turn it on to change the text on this page.'
      : state.unitCount
        ? 'No changes yet. Click any outlined text on the page and start typing.'
        : 'Flynn found no text to edit on this page.';
    paneChanges.appendChild(el('p', 'empty', hint));
  }
  for (const change of changes) {
    const card = el('div', 'change');
    const top = el('div', 'change-top');
    top.appendChild(el('span', 'tag', change.label));
    const actions = el('div', 'actions');
    if (!change.missing) {
      const show = el('button', 'link', 'Show');
      show.type = 'button';
      show.addEventListener('click', () => send({ type: 'flynn:locate', id: change.id }));
      actions.appendChild(show);
    }
    const undo = el('button', 'link', 'Undo');
    undo.type = 'button';
    undo.addEventListener('click', () => send({ type: 'flynn:undo', id: change.id }));
    actions.appendChild(undo);
    top.appendChild(actions);
    card.append(top, el('div', 'before', change.before), el('div', 'after', change.after));
    if (change.missing) card.appendChild(el('div', 'missing', 'This text is no longer on the page. Your edit is still saved.'));
    paneChanges.appendChild(card);
  }
  file.textContent = buildChangeFile(state.url, changes);
}

async function refresh(): Promise<void> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id !== tabId) blocked = false;
  tabId = tab?.id;
  await send({ type: 'flynn:get' });
}

toggle.addEventListener('click', () => {
  if (state) send({ type: 'flynn:setEditing', editing: !state.editing });
});

tabs.forEach((tab) =>
  tab.addEventListener('click', () => {
    tabs.forEach((other) => other.setAttribute('aria-selected', String(other === tab)));
    paneChanges.hidden = tab !== tabs[0];
    paneFile.hidden = tab !== tabs[1];
  }),
);

copy.addEventListener('click', async () => {
  if (!state) return;
  try {
    await navigator.clipboard.writeText(buildChangeFile(state.url, state.changes));
    copy.textContent = 'Copied';
  } catch {
    // Clipboard access was refused: show the file so it can be copied by hand.
    tabs[1].click();
    window.getSelection()?.selectAllChildren(file);
    copy.textContent = 'Select and copy below';
  }
  window.setTimeout(() => (copy.textContent = 'Copy change file'), 1800);
});

let confirmTimer: number | undefined;
discard.addEventListener('click', () => {
  if (discard.dataset.confirm) {
    window.clearTimeout(confirmTimer);
    delete discard.dataset.confirm;
    discard.textContent = 'Discard all';
    send({ type: 'flynn:discardAll' });
    return;
  }
  discard.dataset.confirm = '1';
  discard.textContent = 'Confirm discard';
  confirmTimer = window.setTimeout(() => {
    delete discard.dataset.confirm;
    discard.textContent = 'Discard all';
  }, 3000);
});

chrome.runtime.onMessage.addListener((message: StateMessage | { type: 'flynn:blocked'; tabId: number }, sender) => {
  if (message?.type === 'flynn:state' && sender.tab?.id === tabId) {
    blocked = false;
    state = message.state;
    render();
  } else if (message?.type === 'flynn:blocked' && message.tabId === tabId) {
    blocked = true;
    state = null;
    render();
  }
});

chrome.tabs.onActivated.addListener(refresh);
chrome.tabs.onUpdated.addListener((id, info) => {
  if (id === tabId && (info.status === 'loading' || info.status === 'complete')) refresh();
});

refresh();
