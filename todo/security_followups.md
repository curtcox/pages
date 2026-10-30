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

- Saves use the hosted SDK `publish()` (pinned `v0.4.0` with the release's published SRI): the user approves each save on
  hashbin.org and this origin holds no HashBin credential. Tokens left by the earlier OAuth
  flow are revoked server-side on the next load, then cleared (plan C1/C2).
- A share link, `#` project, sample or CID link that would replace work kept in this browser
  asks first; starters and unchanged samples are not treated as work. View links no longer
  overwrite the stored project (plan C5).
- The editor-mode preview is labelled as user content; no HashBin prompt or price appears in
  the app at all (plan C7).
- The editor's inline startup script moved to `src/view-mode.js`. Browser tests reject a
  substituted SDK, exercise popup/redirect saves and ensure edits made during approval survive.
- Redirect returns verify that the restored project matches the saved CID. Invalid return
  state and callbacks that finish after newer edits cannot replace the current project.
- `allow-popups-to-escape-sandbox` and `allow-downloads` reviewed and kept: popups and blob
  documents created by the preview inherit its opaque origin, so escaping removes sandbox
  flags but grants no access to this origin. Opening a sibling app top-level is equivalent to
  following a link.

## Open for Pages Online

- Content-Security-Policy (plan C6). `srcdoc` previews inherit the editor document's policy,
  so any useful `script-src` would also block user scripts (data URLs, inline handlers, CDN
  scripts, console eval). A meaningful policy needs the preview on its own origin or loaded
  from a separate URL with its own policy; revisit with the hosting decision.
  [SN-2026-004](https://hashbin.org/docs/security/sn-2026-004) documents this specifically for
  Pages Online. On 2026-10-29 the owner chose to preserve `srcdoc` and document this limitation.
  On 2026-10-30 the owner added a partial policy, `object-src 'none'`, which previews inherit
  harmlessly; it does not restrict scripts.
- Hosting decision for an origin of its own (plan section B).
