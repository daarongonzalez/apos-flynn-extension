// Runs behind the scenes. Turns Flynn on for a tab when the toolbar icon is clicked,
// and turns it back on after that tab reloads.

const ACTIVE_KEY = 'activeTabs';

async function activeTabs(): Promise<number[]> {
  const stored = await chrome.storage.session.get(ACTIVE_KEY);
  return (stored[ACTIVE_KEY] as number[] | undefined) ?? [];
}

async function setActive(tabId: number, on: boolean): Promise<void> {
  const tabs = (await activeTabs()).filter((id) => id !== tabId);
  if (on) tabs.push(tabId);
  await chrome.storage.session.set({ [ACTIVE_KEY]: tabs });
}

async function inject(tabId: number): Promise<void> {
  await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] });
}

chrome.action.onClicked.addListener((tab) => {
  if (tab.id === undefined) return;
  const tabId = tab.id;
  // The panel must be opened straight away, while Chrome still counts this as the user's click.
  chrome.sidePanel.open({ windowId: tab.windowId }).catch(() => {});
  (async () => {
    try {
      await inject(tabId);
      await chrome.tabs.sendMessage(tabId, { type: 'flynn:setEditing', editing: true });
      await setActive(tabId, true);
    } catch {
      // Chrome's own pages and the Web Store cannot be edited.
      await setActive(tabId, false);
      chrome.runtime.sendMessage({ type: 'flynn:blocked', tabId }).catch(() => {});
    }
  })();
});

chrome.tabs.onUpdated.addListener(async (tabId, info) => {
  if (info.status !== 'complete') return;
  if (!(await activeTabs()).includes(tabId)) return;
  try {
    await inject(tabId);
  } catch {
    // Access ends when the tab moves to a different site.
    await setActive(tabId, false);
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  setActive(tabId, false);
});
