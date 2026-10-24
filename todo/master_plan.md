# Pages Online — master plan

A static GitHub Pages site where people build small web pages and sites (HTML, CSS, JavaScript and
Markdown) in the browser and see them live, the way GraphvizOnline,
[ManimOnline](https://curtcox.github.io/ManimOnline/),
[Gnuplot Online](https://curtcox.github.io/GnuplotOnline/) and
[Python Online](https://curtcox.github.io/PythonOnline/) work for their languages. No server and
no build step.

Published at **https://curtcox.github.io/pages/**. The GitHub repo is `curtcox/pages`; the Pages
path follows that casing, and the HashBin return URL must match it exactly.

## Decisions (agreed)

| Topic | Decision |
|---|---|
| Name | **Pages Online** (page title, PWA name, HashBin app). |
| Authoring model | **Small file project.** A tab bar of files — by default `index.html`, `style.css`, `script.js` — plus any number of `.md` pages and other text files. `index.html` refers to the others by relative name, as a real site would. Markdown files render as pages. |
| Preview | Live, in a **sandboxed iframe with an opaque origin** (no `allow-same-origin`). Re-renders 500 ms after typing stops; an *Auto-refresh* toggle switches to *Run* / Ctrl+Enter only. |
| v1 extras | **View-only page links**, **Console panel**, **Offline / PWA**, **Download .html / .zip**, plus the siblings' standard is.gd shortener and Playwright CI on Chromium/Firefox/WebKit. |
| Publishing | Same `deploy.yml` as ManimOnline/GnuplotOnline/PythonOnline: on push to `main`, upload the repo root with `actions/upload-pages-artifact@v3`, deploy with `actions/deploy-pages@v4`. Deployment is independent of tests. |
| HashBin | You register a "Pages Online" app; the code ships with an empty `hashbin-client-id` meta tag until then. |
| Workflow | Direct commits on `main`, pushed frequently (deploying as it goes). |

## What I checked before planning

- GitHub Pages for `curtcox/pages` is already enabled with `build_type: workflow`, serving
  `https://curtcox.github.io/pages/`. No account setup is needed for deployment.
- ManimOnline has links to its gallery and video series, the phone layout, and HashBin, but **no
  QR code** in the editor. The QR dialog (Project Nayuki encoder in `src/qr.js`, SVG/PNG
  download, warnings) lives in GnuplotOnline and PythonOnline. PythonOnline (2026-10-24) is the
  newest, cleanest descendant, so most shared modules are copied from it and adapted.
- ManimOnline's `ace/` is Ace **1.4.1** (2018), whose touch editing is poor. Mobile is a
  requirement and this app is mostly typing, so we vendor a trimmed, pinned **ace-builds 1.44.x**
  instead (latest 1.44 patch at implementation time; 1.45 is under two weeks old). It has
  `mode-html/css/javascript/markdown/json/svg` and lint workers for HTML, CSS, JS and JSON.
- Libraries (npm, current): marked 18.1.1 (MIT), acorn 8.19.0 (MIT), lz-string 1.5.0 (MIT),
  playwright 1.64.1, linkedom 0.18.14 (ISC, tests only).
- `curtcox.github.io` is **one origin shared by every Pages project** of this account
  (ManimOnline, PythonOnline, …, and HashBin tokens in their sessionStorage). Shared links run
  arbitrary user JavaScript on open, so user code must never run with that origin. This drives
  the preview design below.

## Lineage features to carry over

1. **Links to docs and gallery.** Toolbar (inside *More* on phones): *HTML ↗*
   (https://developer.mozilla.org/en-US/docs/Web/HTML), *CSS ↗* (…/docs/Web/CSS),
   *JavaScript ↗* (…/docs/Web/JavaScript), *Markdown ↗* (https://commonmark.org/help/ and the
   GFM spec), *Guide* (our own guide, see Gallery) and *Sample gallery ↗* (`gallery.html`).
   Each gallery card links to the MDN page for the technique it shows.
2. **Mobile friendly.** Port the `@media (max-width: 760px), (max-height: 500px)` layout:
   *Preview / Code / Console* tabs with Preview first, a horizontally scrolling file tab bar,
   *Run* always visible, rarely used controls behind *More*, ≥40 px touch targets, ≥16 px inputs so
   iOS does not zoom, `100dvh`. A device-width toggle (phone / tablet / full) on the preview on
   desktop, so authors can check their own page's mobile layout.
3. **HashBin load/save.** Copy `src/hashbin.js` and `src/hashbin-panel.js` from PythonOnline and
   adapt (see **HashBin**). `#<cid>` URLs load automatically; the project survives the OAuth
   redirect.
4. **QR code of the URL.** Copy `src/qr.js` (MIT notice kept) and the QR dialog: encodes the CID
   link if saved, else the compressed link; a choice of *Opens the editor* / *Opens the page only*;
   SVG/PNG download; warnings for local hosts, dense codes (version > 20) and overlong URLs, each
   suggesting Save to HashBin.
5. From GraphvizOnline: Ace editor, live render on edit (debounced), draggable splitter,
   hide-editor toggle, share-link box, *Download*, GitHub fork link. Keep `LICENSE-graphvizonline`.

## Repository layout

```
.github/workflows/deploy.yml       # copied from the siblings unchanged
.github/workflows/test.yml         # unit + check + Playwright matrix
index.html                         # editor (also serves ?view page-only mode)
gallery.html                       # sample gallery
manifest.webmanifest, icon.svg, icons/   # PWA install
service-worker.js, offline-assets.js     # offline cache (content-versioned), asset list
ace/                               # trimmed ace-builds 1.44.x + LICENSE
vendor/marked.min.js, vendor/acorn.min.js, vendor/lz-string.min.js (+ licenses)
src/app.js, src/app.css            # editor glue and styles
src/project.js                     # project model: files, names, entry page, validation
src/bundler.js                     # project + page name -> one srcdoc HTML string
src/markdown.js                    # Markdown -> page HTML (marked, GFM) with the default template
src/loop-guard.js                  # acorn-based loop protection, line-preserving
src/preview-runtime.js             # injected first into every preview document (see below)
src/preview.js                     # owns the iframe: render, navigate, messages, device widths
src/console-view.js                # console panel: entries, object previews, eval box
src/render-scheduler.js            # copied (debounce + stale-callback guard)
src/share-links.js                 # adapted (#, ?compressed=, ?doc=, ?example=, ?view, CID)
src/hashbin.js, src/hashbin-panel.js     # adapted / copied
src/qr.js                          # copied
src/export.js                      # downloads: file, self-contained .html, .zip (own zip writer)
src/zip.js                         # store-only zip writer with CRC-32 (no dependency)
src/examples.js                    # GENERATED catalog from examples/ (committed)
src/gallery.js, src/gallery.css    # gallery page
src/offline.js                     # SW registration + status (copied)
examples/<id>/*                    # sample projects, one directory each, plus meta.json
gallery/previews/<id>.png          # generated covers, committed
scripts/build-examples.mjs         # examples/ -> src/examples.js (+ --check)
scripts/render-gallery.mjs         # Playwright screenshots of each sample + fingerprints (+ --check)
scripts/update-offline.mjs         # rewrites offline-assets.js with content hashes (+ --check)
scripts/check.mjs                  # node --check on every script + the --check modes above
tests/*.test.js                    # node --test
tests/browser/all.cjs              # Playwright suite (+ fixtures/hashbin-sdk.mjs from PythonOnline)
README.md, AGENTS.md, LICENSE-graphvizonline, todo/master_plan.md
package.json                       # devDependencies only: playwright, linkedom (pinned)
```

Plain `<script>` files with `?v=N` cache busters; modules export via `module.exports` /
`globalThis` so the same files run in the browser and under `node --test`, as in the siblings.

## Project model (`src/project.js`)

- A project is `{ files: [{ name, text }], entry, active }`. Names are relative paths
  (`[A-Za-z0-9._-]` segments separated by `/`, no `..`, case-sensitive, unique), at most 50
  files and 5 MiB total (the HashBin limit).
- Text files only in v1: `.html .htm .css .js .mjs .md .json .svg .txt .csv .xml`. Images come
  from external URLs or SVG files. (Binary uploads are a v2 idea.)
- **Entry page**: `index.html`, else `index.md`, else `README.md`, else the first `.html`, else
  the first `.md`. A project of just one Markdown file is a valid, first-class "Markdown page".
- File tabs: *+* adds a file (name prompt, mode from extension, templates for new `.html`/`.md`),
  double-click (long-press on touch) renames, a menu deletes (confirmed; the last page cannot be
  deleted). Renaming does not rewrite references (stated in the UI).
- *New* menu with starters: **HTML + CSS + JS** (default), **Blank HTML**, **Markdown page**,
  **Markdown site** (`index.md`, `about.md`, `style.css`).
- Unsaved work is restored from localStorage (try/catch) unless the URL carries a project.

## Preview engine

**Why bundling.** An opaque-origin sandboxed iframe cannot be served project files by a service
worker (sandboxed clients are not controlled), and `blob:` URLs from our origin are not reliably
loadable from an opaque origin. So each render builds **one self-contained HTML string** and sets
it as the iframe's `srcdoc`.

**Bundler (`src/bundler.js`)**, for the page being shown (entry, or the page navigated to):

1. Markdown pages become HTML via `src/markdown.js`: marked (GFM: tables, task lists,
   strikethrough, autolinks, heading ids), raw HTML allowed (the sandbox contains it), wrapped in
   a default template with a readable stylesheet that a project `style.css` replaces if present.
   Optional front matter: `title`, `css` (list of stylesheets).
2. Parse with `DOMParser`. Inline `<link rel=stylesheet href="local.css">` as `<style>`, and
   `<script src="local.js">` as inline scripts. CSS `url(local.svg)` and `@import "local.css"` are
   rewritten (SVG to `data:` URLs, imports inlined, cycles stopped). `<img src="x.svg">` and
   similar attributes become `data:` URLs.
3. Every inlined script gets `//# sourceURL=<file>` so errors report the real file, and inline
   `<script>` blocks in HTML get `<page>.html` with a recorded line offset.
4. **ES modules**: `<script type=module>` files that `import './util.js'` get an **import map**
   mapping each project module's resolved URL to a `data:` URL. (Verify in all three engines in
   phase 3; if WebKit rejects it, fall back to concatenation-free per-module data URLs with
   rewritten specifiers.)
5. External URLs (CDNs, images, fonts) are left untouched and load normally.
6. Inject `preview-runtime.js` as the very first `<head>` script, with the project's file map
   and the page name as JSON.

**Preview runtime (`src/preview-runtime.js`)**, runs inside the iframe before user code:

- **Navigation**: clicks on links to project pages (`about.md`, `page2.html#section`) are
  intercepted and posted to the parent, which re-bundles that page; the preview shows a small
  page path bar with Back. External links open in a new tab. `location.hash` links work in-page.
- **Virtual files**: `fetch()` and `XMLHttpRequest` for relative URLs that name project files are
  answered from the file map (`data.json`, `notes.md`, `poem.txt`); other URLs pass through.
- **Storage shim**: in-memory `localStorage` / `sessionStorage` and a no-op `document.cookie`
  (opaque origins throw on these), so ordinary beginner code works. State resets on each render;
  the guide says so. (Installed with `Object.defineProperty` where the engine allows it; verified
  per engine in phase 3.)
- **Console**: wraps `console.*`, `window.onerror` and `unhandledrejection`, serializing
  arguments (depth- and size-limited, DOM nodes summarized) and posting them to the parent with
  file and line.
- **Title**: reports `document.title` for the page bar and view mode.

**Loop protection (`src/loop-guard.js`)** — the iframe shares the editor's thread in most
browsers, so `while (true)` (often half-typed during auto-refresh) would freeze the editor. Like
CodePen, every `for`/`while`/`do` loop in project JS (files and inline scripts) is rewritten with
acorn to call a guard that throws after a loop runs 1 s continuously. Inserted code adds no
newlines, so line numbers stay exact. On a trip the console shows "Loop stopped after 1 s on
script.js line 12" and the line is marked. Inline event-handler attributes are not covered;
that is documented. Downloaded `.html` files do not include the guard.

**Crash-safe start.** Before each render a `rendering` flag is set in localStorage and cleared
once the page settles. If the editor starts and finds it set (the previous tab hung), it opens
with Auto-refresh off and a notice: "The last preview may have frozen the page. Fix the code, then
press Run."

**Preview chrome**: device-width buttons (phone 375 / tablet 768 / full), *Reload*, the page bar,
and *Open page* (opens the `?view` link in a new tab — never a `blob:` or `data:` URL, which would
carry our origin).

## Console panel (`src/console-view.js`)

- Bottom drawer under the preview on desktop (with a count badge for errors/warnings), the
  *Console* tab on phones.
- Entries show level styling, expandable object previews, repeated-message counts, and a clickable
  `file:line` that switches to that file tab and jumps to the line. Errors also add Ace gutter
  annotations on the right file.
- An eval box runs an expression in the preview's global scope (posted to the runtime) and logs
  the result. *Clear*, *Copy*, and "clear on refresh" (on by default).
- All text is inserted with `textContent`; messages are accepted only when
  `event.source === iframe.contentWindow` and match the expected shape.

## Sharing and URLs

| URL form | Meaning |
|---|---|
| `#<url-encoded text>` | A single-file project (long form; HTML or Markdown, detected). |
| `?compressed=<lz-string>` | Single-file project, compressed (`LZString.compressToEncodedURIComponent`). |
| `?doc=<lz-string>` | Compressed JSON project document (the HashBin shape). Used for multi-file projects. |
| `#<cid>` | Load from HashBin (`HashBinDocuments.isCID` tells it apart from source). |
| `?example=<id>` | Load a gallery sample. |
| `?view` (+ `&page=about.md`) | **Page-only view** of whichever project the URL carries. |
| `?run=0` | Open with Auto-refresh off and the preview not rendered until Run. |

Share dialog: link to *Editor* or *Page only*, *Don't run on open*, *Copy*, and *Shorten link*
(is.gd through AllOrigins via `ShareClient`, same bounded timeout and HashBin guidance). Saving to
HashBin puts `#<cid>` in the address bar; editing turns it back into a source link (sibling
fingerprint logic).

**View-only mode** (`?view`): the same `index.html` skips Ace and the editor UI, renders the page
in a full-viewport sandboxed iframe (same bundler, runtime and loop guard; console hidden), sets
the document title from the page, and shows a slim, non-removable top strip outside the iframe:
"Made with Pages Online · user-created page · Edit". The strip exists because these pages sit on
`curtcox.github.io`; it marks them as user content (see Risks).

## HashBin

- `hashbin.js`: keep `HashBinStore` unchanged apart from the transaction-key prefix
  (`pagesonline:hashbin:return:`).
- Document shape (same envelope as the siblings, so hashbin.org treats them alike). `src` holds
  the entry file's text so anything that reads only `src` still gets the main page:
  ```json
  { "format": "hashbin-diagram", "version": 1, "type": "pages",
    "src": "<!doctype html>…",
    "pages": { "entry": "index.html", "active": "style.css",
               "files": [ { "name": "index.html", "text": "…" },
                          { "name": "style.css",  "text": "…" } ] } }
  ```
  Plain-text CIDs (a bare `.html` or `.md`) load as single-file projects. 5 MiB limit.
- `hashbin-panel.js`: copy with the same element IDs; snapshot is the project.
- **Your action:** register "Pages Online" at https://hashbin.org/developers with return URL
  `https://curtcox.github.io/pages/` (trailing slash, no `index.html`), then give me the public
  client ID for the meta tag. Until then loading works and saving says
  "HashBin sign-in needs a registered client ID."

## Downloads and import (`src/export.js`, `src/zip.js`)

- **Current file** as itself.
- **Page as one .html**: the bundled page without the runtime or loop guard, so it works when
  opened from disk or hosted anywhere. Project links to other pages are left as-is (noted).
- **Project as .zip**: every file at its path, written by our store-only zip writer (CRC-32,
  UTF-8 names). Unzips into a folder you can host on GitHub Pages directly.
- **QR code** SVG/PNG (in the QR dialog).
- **Open files**: pick one or more local text files to add to the project (or replace it).
  (Opening a `.zip` needs inflate via `DecompressionStream`; deferred to v2.)

## Security

- User HTML/JS runs **only** inside `<iframe sandbox="allow-scripts allow-forms allow-modals
  allow-popups allow-popups-to-escape-sandbox allow-downloads">` — never `allow-same-origin`,
  never `allow-top-navigation`. The page therefore cannot read the editor's or other apps'
  localStorage/sessionStorage (HashBin tokens), IndexedDB, cookies or service-worker caches,
  cannot touch the parent DOM, and cannot navigate the editor away.
- The parent never opens user content top-level from our origin (`blob:`/`data:` new tabs);
  *Open page* uses the `?view` link, which sandboxes the same way.
- Messages from the iframe are data: source-checked, shape-validated, rendered with
  `textContent`.
- The rendering flag, loop guard and crash-safe start limit how badly a shared link can hang the
  tab. Network access from user pages is allowed — it is what any web page can do.
- A browser test proves each of these (reading `parent.document`, `localStorage` isolation,
  top navigation, `caches`).

## Gallery

About 18 original samples, each a directory under `examples/` with a `meta.json` (title, tags,
MDN link, description). `scripts/build-examples.mjs` generates `src/examples.js`; a test checks
it is current.

- *Basics*: Hello page; a personal home page (semantic HTML + CSS); a form with validation.
- *CSS*: flexbox and grid layouts; transitions and keyframe animation; a pure-CSS illustration;
  dark/light theme with `prefers-color-scheme`.
- *JavaScript*: counter with DOM events; to-do list (uses the storage shim); `fetch('data.json')`
  from a project file; an ES module split across two files; a live clock; Snake on `<canvas>`.
- *Graphics*: generative SVG; canvas drawing with mouse/touch.
- *Markdown*: a single Markdown page with tables and task lists; a three-page Markdown site with
  shared `style.css` and navigation; a Markdown slide-style page.
- *Guide*: **"How Pages Online works"**, itself a Markdown site (files, linking, Markdown, the
  sandbox, storage shim, virtual fetch, loop guard, sharing, HashBin, offline). The toolbar's
  *Guide* link opens it as `./?example=guide&view`.

`gallery.html` reuses the siblings' card grid, search box and tag filter; each card has *Load in
editor →*, *View page ↗* and the MDN link. Covers are 480×270 PNG screenshots made by
`scripts/render-gallery.mjs` with Playwright (already a dev dependency), which loads each sample
in `?view` mode; `--check` verifies source fingerprints without a browser.

## Offline / PWA

- `offline-assets.js` lists every shipped file (app, Ace subset and workers, vendored libraries,
  gallery covers). The content-versioned `service-worker.js` precaches them, activates only after
  the whole cache is saved, and prefixes caches with `pagesonline-`. `src/offline.js` shows
  *Available offline*, *Retry offline setup*, and *Update and reload* (project saved first).
- External resources a user's page loads (CDN libraries, fonts) are not cached — the sandboxed
  preview is not controlled by the service worker. The guide says so.
- `manifest.webmanifest`, `icon.svg`, PNG icons (180/192/512).
- A unit test checks that `offline-assets.js` covers every file referenced by `index.html`,
  `gallery.html` and the Ace modes/workers we load.

## Tests

**Node (`node --test tests/*.test.js`)**

- `project`: name validation, add/rename/delete rules, entry selection, size/count limits.
- `bundler` (DOM from `linkedom`): CSS/JS inlining, `url()`/`@import` rewriting and cycles, SVG
  data URLs, `sourceURL` comments and inline line offsets, import maps for modules, external URLs
  untouched, runtime injected first, Markdown pages and front matter.
- `loop-guard`: guards every loop form, preserves line/column of all original tokens, leaves
  syntax errors to surface normally, trips after the budget.
- `share-links` (round trips for every URL form, single vs multi-file, `?view`, `?run=0`, CID
  detection), `hashbin` (serialize/parse, limits, plain-text CIDs; ported mocked OAuth/quote/save
  tests), `qr` (copied vectors), `zip` (CRC-32 vectors; the archive is verified with
  `python3 -m zipfile -t` in CI), `examples` (generated catalog current), `offline-assets`
  coverage.

**Browser (Playwright `tests/browser/all.cjs`, served by `python3 -m http.server`)** on Chromium,
Firefox and WebKit:

- Smoke: default project renders; editing CSS and JS updates the preview; Run with Auto-refresh off.
- Multi-file: link to `about.md` navigates the preview and Back returns; `fetch('data.json')`;
  module import; SVG image in CSS.
- Console: `console.log`/error with `file:line`; clicking jumps to the line; eval box.
- Loop guard: `while (true) {}` stops in about 1 s and the editor stays responsive; crash-safe
  start after a simulated hang.
- Security: preview cannot read `parent.document`, the editor's `localStorage`, or navigate top;
  the storage shim works inside the preview.
- Sharing: Share → open → same project (editor and `?view`); QR dialog; mocked is.gd.
- HashBin: mocked OAuth return, quote, save, and `#cid` load with stale-load protection.
- Downloads: single `.html` opens standalone and renders; `.zip` contents.
- Gallery: every card loads in the editor and in `?view` with no console errors.
- Mobile: 375×812 — tabs, *More*, file tabs scroll, no horizontal page scroll, touch-target sizes.
- Offline: after the SW installs, stop the server, reload, edit and render.

**CI (`.github/workflows/test.yml`)**: job 1 runs `npm test` and `npm run check`; a matrix job
runs the browser suite on chromium, firefox and webkit, uploading `test-results/` on failure.

## Phases

1. **Skeleton and deploy.** `deploy.yml`, `test.yml`, `package.json`, minimal `index.html` with
   Ace and a one-file sandboxed preview, `LICENSE-graphvizonline`, README, AGENTS.md. Push and
   confirm https://curtcox.github.io/pages/ is live.
2. **Project model and editor.** File tabs, Ace modes and lint workers, New starters, splitter,
   hide-editor, render-scheduler, Auto-refresh + Run, localStorage restore, crash-safe start.
3. **Preview engine.** Bundler, Markdown, preview runtime (navigation, virtual fetch, storage
   shim, title), loop guard, device widths. Cross-engine checks of import maps and the storage
   shim happen here.
4. **Console panel.**
5. **Sharing, QR and view-only mode.**
6. **HashBin.** Port store and panel, document format, `#cid` auto-load, OAuth return,
   placeholder client ID; swap in the real ID once registered.
7. **Downloads and file import.**
8. **Mobile layout.** Phone CSS, *Preview / Code / Console* tabs, *More*; check WebKit and
   Chromium mobile viewports.
9. **Gallery, guide and docs links.** Samples, generator scripts, covers, toolbar links.
10. **Offline/PWA.** Asset list and update script, service worker, manifest and icons, status UI.
11. **Finish tests, CI and docs.** Unit tests are written alongside each phase; the Playwright
    suite and `test.yml` are completed here, with README (features, limits, local dev) and an
    `AGENTS.md` recording the contracts above for future sessions.

Each phase is one or a few commits pushed to `main`, deploying as it goes.

## Licensing notes

- Ace (BSD-3), marked (MIT), acorn (MIT), lz-string (MIT): vendored with their licence files.
- QR encoder: MIT (Project Nayuki), notice kept in `src/qr.js`.
- GraphvizOnline lineage: keep `LICENSE-graphvizonline` and the credit.
- Gallery samples are original. User-created pages are the user's own.

## Risks and open items

- **Shared origin, phishing.** View-only pages appear under `curtcox.github.io/pages/`, so a
  shared link could imitate a login page. The sandbox stops it reaching real data, and the strip
  labels it as user content, but the address bar still shows your domain. A stronger long-term
  fix is serving previews from a separate origin you control (for example a subdomain of a domain
  you own), which would also allow real service-worker file serving and `allow-same-origin`. Not in
  v1; worth deciding before the site is promoted widely.
- **Same-thread hangs.** The loop guard does not catch every freeze (a huge `Array(1e9).fill()`,
  regex backtracking, guards inside event-handler attributes). Crash-safe start is the backstop.
- **Engine differences.** Import maps with `data:` URLs, `sourceURL` line numbers in WebKit, and
  redefining `localStorage` on an opaque-origin window must be verified per engine in phase 3;
  fallbacks are noted above and will be recorded in AGENTS.md.
- **Storage is per render.** The in-memory shim resets on every refresh; pages that rely on
  persistence will not keep data. Documented in the guide and the to-do sample.
- **Ace on phones.** Better in 1.44 than 1.4.1, but still not a native text field. If touch
  editing tests poorly on WebKit, fall back to a plain `<textarea>` on phones (keeping tabs and
  undo) as a follow-up.
- **v2 ideas, not in v1:** binary assets (images, fonts) stored in the project, `.zip` import,
  Emmet, Prettier formatting, a separate preview origin, collaborative editing.
