// Renders static/icons/flynn.svg to the PNG sizes Chrome needs. Run: node scripts/make-icons.mjs
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';

const { chromium } = createRequire(import.meta.url)('playwright');
const svg = await readFile('static/icons/flynn.svg', 'utf8');
const browser = await chromium.launch();
for (const size of [16, 32, 48, 128]) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  await page.setContent(`<style>html,body{margin:0;background:transparent}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`);
  await page.screenshot({ path: `static/icons/${size}.png`, omitBackground: true });
  await page.close();
}
await browser.close();
