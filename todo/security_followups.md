# Security follow-ups

The cross-client plan lives in hashbin.org:
[`todo/browser_client_safety.md`](https://github.com/curtcox/hashbin.org/blob/main/todo/browser_client_safety.md).
It covers HashBin tokens on the shared `curtcox.github.io` origin, hosted per-save approval,
DPoP-bound allowances, SDK CID verification and the hosting options for giving each app its
own origin.

## Done here

- The service worker verifies cached assets against `offline-assets.js` hashes, so a sibling
  app on the origin cannot poison the offline cache (`a98d857`).
- HashBin loads verify bytes against the CID, and saves verify the returned CID (`a98d857`).
  Drop this local copy once the SDK verifies (plan A3).

## Open for Pages Online

- HashBin tokens are still in `localStorage`, readable by every app on the origin. Switch
  saves to the SDK's hosted `publish()` once it exists (plan A1/C1).
- A share link or `#` project replaces the saved project without asking (`src/app.js`
  restores and persists it on load). Confirm before replacing unsaved work (plan C5).
- Add an editor Content-Security-Policy (plan C6).
- Label the editor-mode preview as user content; credential and price prompts stay outside
  it (plan C7).
- Review whether `allow-popups-to-escape-sandbox` and `allow-downloads` are needed. Escaped
  popups can open sibling apps on the shared origin as normal top-level pages.
- Hosting decision for an origin of its own (plan section B).
