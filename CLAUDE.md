## What this project is
- Flynn, a Chrome extension from Apostrophe Software.
- It lets someone rewrite the words on a site they are building, right on the page, and copy a change file for Claude Code.
- Plain TypeScript, built with esbuild into `dist`. Manifest V3.

## Where the project stands
- Read `docs/status.md` first in a new session. It lists what works, the roadmap and what is left.
- Update it at the end of each piece of work.

## Voice
- Product copy and docs: approachable, not casual. Plain words, no jargon.
- Never use the word "implement".

## Privacy rules (these are promises to users)
- Flynn acts on a page only after the icon is clicked.
- Drafts stay in the browser. This version contacts no servers.
- Do not add a network call, a host permission or a new entry in `permissions` without asking first. The current list is `activeTab`, `scripting`, `sidePanel`, `storage`.

## Design rules
- Panel styles are in `static/panel.css`. Use the variables at the top of that file. Do not write raw hex colours elsewhere.
- The panel supports light and dark. Any new colour needs both.
- Nothing tappable below 44px in the panel.
- If a rule is missing, ask before inventing one.

## Code layout
- `src/content`: runs inside the page.
- `src/panel`: the side panel.
- `src/core`: shared logic. Keep it free of Chrome calls so it stays testable.
- `src/background.ts`: turns Flynn on for a tab.

## Checks
- `npm run typecheck` and `npm test` before a push.
- `npm run test:browser` for anything that touches the page. It needs Playwright and saves screenshots to `test/output`.

## Scope for this project
- Use only this repo's styles and assets.
- Connectors: GitHub only.
- Test pages live in `test/fixtures`. Do not point tests at the owner's live sites.
