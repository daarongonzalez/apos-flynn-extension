# Flynn

Flynn is a Chrome extension from Apostrophe Software. It lets you rewrite the words on any site you are building, right on the page, and keeps a tidy list of every change.

This is the first iteration. It covers editing on the page and producing a change file you can paste into Claude Code. Sending changes to GitHub as a pull request comes next.

## What it does today

- **Select.** Click the Flynn icon and every piece of text gets an outline and a label: H1, Paragraph, Button, Link and so on.
- **Type.** Click any outlined text and rewrite it in place. Enter keeps the change, Escape cancels it.
- **Review.** The side panel lists each change with before and after, with Show and Undo.
- **Copy.** One button copies a plain-language change file.
- **Drafts.** Edits are saved in your browser and return when you reload the page.

Bold text and links inside a sentence stay as they are while you change the words around them. While edit mode is on, links and buttons on the page do not fire.

## Try it

You need Node.js 22 or newer.

```
npm install
npm run build
```

Then load it in Chrome:

1. Open `chrome://extensions`.
2. Turn on **Developer mode** (top right).
3. Click **Load unpacked** and choose the `dist` folder.
4. Open the site you want to edit and click the Flynn icon in the toolbar.

After changing the code, run `npm run build` again and click the reload arrow on the Flynn card in `chrome://extensions`.

## Privacy

Flynn acts on a page only after you click its icon. Drafts stay in your browser. This version contacts no servers at all.

## How the code is laid out

| Folder | What lives there |
| --- | --- |
| `src/content` | Runs inside the page: finds text, draws outlines, handles typing, saves drafts |
| `src/panel` | The side panel: change list, change file, controls |
| `src/background.ts` | Turns Flynn on for a tab when the icon is clicked |
| `src/core` | Shared logic: finding text, labels, reading and writing words, the change file |
| `static` | The extension's settings file, panel page, styles and icons |
| `test` | Checks for the shared logic, plus a browser run against a sample page |

## Checks

```
npm run typecheck
npm test
npm run test:browser
```

`test:browser` needs Playwright installed (`npm i -D playwright`). It edits a sample page in a real browser and saves screenshots to `test/output`.

## Roadmap

1. Edit on the page (this version)
2. Sign in with GitHub, match each edit to the code, open one pull request
3. Private beta: page title and other hidden text, clearer handling of text that cannot be matched
4. Chrome Web Store release
