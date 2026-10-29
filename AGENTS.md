# Pages Online contracts

A buildless, static GitHub Pages editor. Read `todo/master_plan.md` for the design and `README.md` for development. Work directly on `main` and push completed changes as requested in that plan. Deployment and test workflows run independently.

## Preview isolation

- User code runs **only** in the `srcdoc` of `#preview`. Keep the sandbox opaque: never add `allow-same-origin` or `allow-top-navigation`.
- Never open user HTML through a same-origin blob/data URL in a top-level tab. Open the app's `?view` link. Keep its user-content strip outside the iframe.
- Parent message handlers must check the iframe's `contentWindow`, the per-render token, type, shape and size. Use `textContent` for user messages, paths, titles and console values.
- The editor holds no HashBin credentials. Never show HashBin prompts or prices inside the preview.
- The runtime's storage shims are in memory and reset on every render. Do not imply persistence. External resources are not cached for preview frames.

## Project and bundler

- `{files:[{name,text}],entry,active}`; case-sensitive safe relative names, supported text extensions only, at most 50 files/5 MiB. Keep at least one HTML/Markdown page. Validate imports and decoded links through `Project.validate`.
- The HashBin envelope is `{format:'hashbin-diagram',version:1,type:'pages',src,pages}`. Its full serialized size must also fit 5 MiB. `src` duplicates the entry page for compatibility.
- Local styles, SVG assets, project JS and modules are bundled. User scripts are self-contained data URLs inside the opaque iframe, preserving native script order/global scope. WebKit redacts inline-srcdoc errors; data scripts expose diagnostics, mapped back through `data-pages-file`/the import map. ES modules use an import map with absolute synthetic URLs mapped to data URLs. Local module entry scripts use exactly the same data URL as their map entry, so circular dependencies share module identity.
- Acorn instrumentation inserts no newlines, preserving line numbers; columns shift. Syntax errors are passed through for native browser reporting. HTML inline scripts get original line padding. Exported HTML omits runtime and loop guards.
- Loop guards interrupt continuous loops around one second; they do not protect inline event attributes, eval, huge allocations or regex backtracking. Crash-safe mode is the backstop. A clean navigation during rendering clears that instance's pending flag; a hung tab leaves it behind.
- Renaming does not rewrite references. Markdown default styling is replaced by sibling `style.css` or front-matter CSS. ZIP downloads preserve original text files, including Markdown source.

## Browser assets and generated files

Plain browser scripts use IIFEs and export via `module.exports`/`globalThis`. No production build step or runtime npm dependencies.

Pinned vendored libraries: Ace 1.44.0, marked 18.1.1, acorn 8.19.0, lz-string 1.5.0. Keep licenses alongside them and the Nayuki MIT notice in `src/qr.js`. Preserve `LICENSE-graphvizonline` and lineage credit.

Edit `examples/<id>/` and its `meta.json`, then run these in order:

```
npm run examples
npm run gallery       # real Chromium screenshots; requires installed Playwright browser
npm run offline       # after every shipped asset edit, including screenshots
npm test
npm run check
```

`npm run check` verifies JS syntax, the catalog, preview fingerprints and content hashes. Do not hand-edit generated catalogs/hashes to bypass checks. `npm run test:browser` starts its own static server. Set `BROWSER=chromium`, `firefox`, or `webkit`. Test the preview security boundary for bundler/runtime changes. Firefox 1555 can fail to launch on recent macOS with “Could not find profile folder”; run its CI job on Ubuntu rather than hiding/skipping the failure.

The service worker installs a content-versioned complete cache before activation. Cache names start `pagesonline-`; never delete unrelated app caches. Preserve the project before update reload.

## HashBin configuration

The `hashbin-client-id` meta value contains the registered public Pages Online client ID. This static browser app uses no client secret; never add one to the repository, browser assets, or preview. Redirect URI must be exactly `https://curtcox.github.io/pages/`. Saves use the pinned SDK's `publish()` (HashBin Publish draws price and approval); never reintroduce OAuth tokens on this shared origin. Upgrade the SDK URL and its published SRI hash together in `src/hashbin.js`; do not replace the integrity-checked module script with a plain import. `publish()` must run synchronously in the click, after `init()`. Redirect saves return as `#hashbin_publish=…` with the project in `clientState`. Links never silently replace stored work, and stale loads/saves cannot overwrite newer edits. Tests mock the SDK and spend no balance; explicitly clear the test store's client ID when exercising the missing-configuration error.
