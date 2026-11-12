// Drives the built extension code in a real browser against a sample page.
// Needs Playwright (npm i -D playwright, or a global install). Run: npm run test:browser
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { extname, join } from 'node:path';

const { chromium } = createRequire(import.meta.url)('playwright');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' };
const server = createServer(async (req, res) => {
  const path = new URL(req.url, 'http://x').pathname;
  const file = path.startsWith('/dist/') ? path.slice(1) : join('test/fixtures', path);
  try {
    res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'text/plain' }).end(await readFile(file));
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((done) => server.listen(0, done));
const base = `http://localhost:${server.address().port}`;
await mkdir('test/output', { recursive: true });

// A stand-in for Chrome's extension features, so the page code can run outside an installed extension.
const stub = () => {
  window.__messages = [];
  window.chrome = {
    runtime: {
      sendMessage: async (m) => void window.__messages.push(m),
      onMessage: { addListener: (fn) => (window.__listener = fn) },
    },
    storage: {
      local: {
        get: async (k) => (localStorage[k] ? { [k]: JSON.parse(localStorage[k]) } : {}),
        set: async (o) => Object.entries(o).forEach(([k, v]) => (localStorage[k] = JSON.stringify(v))),
        remove: async (k) => localStorage.removeItem(k),
      },
    },
  };
  window.__send = (m) => new Promise((done) => window.__listener(m, {}, done));
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 900, height: 900 } });
await page.addInitScript(stub);
const open = async () => {
  await page.goto(`${base}/sample.html`);
  await page.addScriptTag({ url: `${base}/dist/content.js` });
  await page.waitForFunction(() => window.__messages.length > 0);
};
const state = () => page.evaluate(() => window.__send({ type: 'flynn:get' }));
const text = (sel) => page.locator(sel).innerText();

await open();
let s = await state();
// 2 nav links, h1, lead, button, h2, 2 x (h3 + p), form label = 11. Brand, pre and hidden text are judged below.
assert.equal(s.editing, true);
assert.equal(s.changes.length, 0);
console.log('text found:', s.unitCount);
assert.equal(s.unitCount, 12, 'brand + 2 links + h1 + lead + button + h2 + 4 card texts + label');
await page.hover('h2');
await page.screenshot({ path: 'test/output/1-hover.png' });

// Type over the headline.
await page.click('#headline');
await page.keyboard.press('ControlOrMeta+a');
await page.keyboard.type('Your team already has AI.');
await page.keyboard.press('Enter');
s = await state();
assert.equal(s.changes.length, 1);
assert.deepEqual(
  [s.changes[0].label, s.changes[0].before, s.changes[0].after],
  ['H1', 'Unlock the power of AI-driven learning for your team', 'Your team already has AI.'],
);
assert.equal(await page.getAttribute('#headline', 'contenteditable'), null);

// Links do not navigate and buttons do not fire in edit mode. The button text is editable.
await page.click('#nav-programs');
await page.keyboard.press('Escape');
assert.ok(page.url().endsWith('/sample.html'));
await page.click('#cta');
await page.keyboard.press('ControlOrMeta+a');
await page.keyboard.type('Book a call');
await page.keyboard.press('Enter');
assert.equal(await page.evaluate(() => window.clicked), undefined);
s = await state();
assert.equal(s.changes[1].label, 'Button');
assert.equal(s.changes[1].after, 'Book a call');

// Formatted text: bold and link survive an edit to the words around them.
await page.click('#lead', { position: { x: 5, y: 5 } });
await page.keyboard.press('Home');
await page.keyboard.type('Now: ');
await page.keyboard.press('Enter');
assert.equal(await page.locator('#lead strong').count(), 1);
assert.equal(await page.locator('#lead a').count(), 1);
assert.match(await text('#lead'), /^Now: Leverage cutting-edge solutions/);

// Escape cancels, and emptying a field restores it.
await page.click('h2');
await page.keyboard.type('zzz');
await page.keyboard.press('Escape');
assert.equal(await text('h2'), 'Why teams choose us');
await page.click('h2');
await page.keyboard.press('ControlOrMeta+a');
await page.keyboard.press('Backspace');
await page.keyboard.press('Enter');
assert.equal(await text('h2'), 'Why teams choose us');

// The second of two identical texts is edited, and comes back in the right place after a reload.
await page.click('#dup');
await page.keyboard.press('ControlOrMeta+a');
await page.keyboard.type('Results you can show');
await page.keyboard.press('Enter');
s = await state();
assert.equal(s.changes.length, 4);
const dup = s.changes[3];
assert.deepEqual([dup.occurrence, dup.total], [2, 3]);
assert.equal(dup.where.element, '<p id="dup">');
assert.equal(dup.where.path, 'p#dup');
assert.equal(dup.where.heading, 'Measurable results');
assert.equal(s.changes[0].where.path, 'h1#headline');
assert.equal(s.changes[2].where.element, '<p id="lead">');
await page.mouse.move(100, 280);
await page.screenshot({ path: 'test/output/2-edited.png' });
await page.waitForTimeout(300);

await open();
s = await state();
assert.equal(s.changes.length, 4, 'drafts survive a reload');
assert.ok(s.changes.every((c) => !c.missing));
assert.equal(await text('#headline'), 'Your team already has AI.');
assert.equal(await text('#dup'), 'Results you can show');
assert.equal(await text('.cards div:first-child p'), 'Measurable results');
assert.equal(await page.locator('#lead strong').count(), 1);

// Undo one, then discard the rest.
const headline = s.changes.find((c) => c.label === 'H1');
s = await page.evaluate((id) => window.__send({ type: 'flynn:undo', id }), headline.id);
assert.equal(s.changes.length, 3);
assert.equal(await text('#headline'), 'Unlock the power of AI-driven learning for your team');
s = await page.evaluate(() => window.__send({ type: 'flynn:discardAll' }));
assert.equal(s.changes.length, 0);
assert.equal(await text('#cta'), 'Get Started');
assert.match(await text('#lead'), /^Leverage cutting-edge/);
await page.waitForTimeout(300);
assert.equal(await page.evaluate(() => Object.keys(localStorage).length), 0);

// With edit mode off the page behaves normally again.
await page.evaluate(() => window.__send({ type: 'flynn:setEditing', editing: false }));
await page.click('#cta');
assert.equal(await page.evaluate(() => window.clicked), true);

// The side panel, fed a sample state.
const panel = await browser.newPage({ viewport: { width: 380, height: 760 } });
await panel.addInitScript(() => {
  const sample = {
    url: 'https://fieldnote-training.example/', title: 'Fieldnote', editing: true, unitCount: 12,
    changes: [
      { id: 'a', label: 'H1', before: 'Unlock the power of AI-driven learning for your team', after: 'Your team already has AI.', missing: false, occurrence: 0, total: 1, where: { element: '<h1 class="hero-title">', path: 'main > section.hero > h1.hero-title', area: 'Main content' } },
      { id: 'b', label: 'Button', before: 'Get Started', after: 'Book a call', missing: true },
    ],
  };
  const noop = { addListener() {} };
  window.chrome = {
    tabs: { query: async () => [{ id: 1 }], sendMessage: async () => sample, onActivated: noop, onUpdated: noop },
    runtime: { onMessage: noop },
  };
});
await panel.goto(`${base}/dist/panel.html`);
await panel.waitForSelector('.change');
assert.equal(await panel.locator('.change').count(), 2);
await panel.screenshot({ path: 'test/output/3-panel.png' });
await panel.click('#tab-file');
assert.match(await panel.locator('#file').innerText(), /## 1\. Heading 1 \(H1\)\nElement: `<h1 class="hero-title">`\nLocation: Main content\nPath: `main > section\.hero > h1\.hero-title`\nBefore/);

await browser.close();
server.close();
console.log('browser checks passed');
