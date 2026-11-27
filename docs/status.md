# Where Flynn stands

Status: 26 November 2026. **Start here** in a new session. Update this page
at the end of each piece of work.

## What works today (version 0.1.0)

Not published. Loaded by hand from `dist` in `chrome://extensions`.

- Select: hover outlines text and labels it (H1, Paragraph, Button, Link).
- Type: click outlined text and rewrite it. Enter keeps, Escape cancels.
- Review: the side panel lists each change with before, after, Show and Undo.
- Copy: one button copies a change file that describes each element (PR #2).
- Drafts: saved in the browser and restored on reload.

## Accounts and settings

| What | Value |
|---|---|
| Chrome Web Store | No listing yet |
| Permissions | `activeTab`, `scripting`, `sidePanel`, `storage` |
| Servers | None. Flynn contacts nothing |

No secrets.

## Roadmap

1. Edit on the page. **Done.**
2. Sign in with GitHub, match each edit to the code, open one pull request.
   **Next.** This is the first step that sends data off the device, so the
   privacy section of the README changes with it.
3. Private beta: page title and other hidden text, clearer handling of text
   that cannot be matched.
4. Chrome Web Store release.

## Open questions

- The panel colours match daarongonzalez.com (Resolution Blue and Sun gold),
  not the Apostrophe Software palette. Decide which brand Flynn wears.

## Background

The research behind Flynn is in the `apostrophe-software` repo:
`reports/Visual copy editing tool research.md`.
