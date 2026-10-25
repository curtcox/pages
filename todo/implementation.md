# Pages Online implementation

Implemented on 2026-10-24 and published at **https://curtcox.github.io/pages/**.

## Phase checklist

- [x] 1. Buildless skeleton, pinned browser dependencies, independent GitHub Pages deployment and test workflows.
- [x] 2. Validated file projects, Ace modes/workers, starters, file actions, splitter, live/manual rendering, local restore and crash recovery.
- [x] 3. HTML/Markdown bundling, CSS imports, SVG assets, module imports/cycles, virtual fetch/XHR, storage shim, navigation, title reporting and loop guards.
- [x] 4. Console logs/errors, bounded expandable values, repeated-message counts, file/line navigation, annotations, expression evaluation and clear/copy controls.
- [x] 5. All planned URL forms, compressed project sharing, shortening, QR SVG/PNG downloads and sandboxed page-only mode.
- [x] 6. HashBin document shape, CID load, OAuth project restore, quotes, save/disconnect and stale-operation guards; registered public client ID configured on 2026-10-25.
- [x] 7. Current-file, self-contained HTML and store-only ZIP exports; local text-file import with add/replace.
- [x] 8. Phone Preview/Code/Console tabs, More menu, scrolling file tabs, touch targets and desktop device widths.
- [x] 9. Eighteen original samples plus a Markdown guide, generated catalog, searchable/tag-filtered gallery, real 480×270 PNG covers and documentation links.
- [x] 10. Content-versioned atomic offline cache, availability/update/retry controls, manifest and icons.
- [x] 11. Unit and browser suites, generated-file checks, independent CI, README and contributor contracts.

## Verification

- **29 Node tests** cover project constraints, Markdown and asset bundling, source line offsets, module mapping, loop instrumentation, render scheduling, sharing, OAuth/quotes/save, QR vectors, generated files and ZIP archives. Python independently checks ZIP integrity and Unicode content.
- **16 browser test groups per engine** cover real editor interactions, native script ordering and shared lexical scope, module cycles, navigation, data files, console locations/eval, loop interruption, origin/storage/navigation/cache isolation, spoofed messages, sharing, QR/downloads, mocked HashBin flows, crash recovery, all 19 samples in editor and page-only modes, phone layout, and offline reload/editing/gallery use.
- Chromium and WebKit pass locally on macOS. The installed Firefox build fails before launching the app with “Could not find profile folder”; all three engines passed on Ubuntu CI for implementation commit `968d432` ([run](https://github.com/curtcox/pages/actions/runs/40135647423)). The final repository revision runs the same complete matrix.
- `npm run check` checks all application/test/script syntax, catalog freshness, cover source/rendering fingerprints and image hashes, and all 70 offline asset hashes.
- Live GitHub Pages smoke check: HTTP 200, default page interaction works, no application page errors, 19 gallery cards. Deployment of implementation commit `968d432` [succeeded](https://github.com/curtcox/pages/actions/runs/40135647329).

Tests mock HashBin and shortening. They do not spend account funds or prove live HashBin account registration.

## Implementation details resolved during testing

- All project scripts are self-contained **data URLs inside the opaque iframe**. This preserves native parser/defer/module behavior and shared classic-script lexical scope. WebKit redacts errors from inline scripts in opaque `srcdoc`; data scripts expose usable errors, mapped back to files through script metadata and the module import map. No user content is opened top-level as a data/blob URL.
- Module maps work in Chromium and WebKit locally and Firefox in Linux CI. Module entry scripts use the exact mapped data URL, preserving identity during circular imports.
- The local/session storage shims work in the tested engines without giving access to parent or sibling-origin data. Cookies remain a no-op. Storage resets every render.
- Instrumentation adds no newlines and preserves source line numbers; inserted code shifts columns. Inline HTML scripts are padded to their original source lines.
- A clean navigation during rendering clears that instance's pending flag, preventing false crash recovery; a hung page leaves the flag behind.
- Nested Markdown pages inherit the project's root `style.css`, with a sibling stylesheet taking precedence. Explicit front-matter CSS is resolved from the Markdown file.
- File selection preserves tab DOM nodes, so Firefox double-click rename works reliably; long phone filenames keep their own width and scroll without overlap.

## HashBin registration

The owner registered **Pages Online**, and the public client ID was configured on 2026-10-25 with return URL **`https://curtcox.github.io/pages/`**. The static browser app uses no client secret. Browser tests explicitly clear the test store's client ID to retain missing-configuration coverage, and substitute a fixture client ID for mocked OAuth flows.

The v2 items and documented sandbox/storage/loop-protection limits in the master plan remain intentionally out of scope.
