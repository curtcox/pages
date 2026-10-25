# Pages Online

A small workspace for the web. Edit HTML, CSS, JavaScript, and Markdown in your browser and see your page live.

**[Open Pages Online](https://curtcox.github.io/pages/)** · **[Sample gallery](https://curtcox.github.io/pages/gallery.html)** · **[Guide](https://curtcox.github.io/pages/?example=guide&view)**

- A small file project with Ace syntax modes, lint workers, starters, imports, file tabs, and local restore.
- Live previews after a 500 ms pause, or manual Run / Ctrl+Enter (Command+Enter on Mac).
- Linked Markdown pages, GFM, front matter, local CSS imports, SVG assets, ES modules, and virtual `fetch`/XHR for project data.
- Console output with expandable objects, repeat counts, error annotations, file/line navigation, and expression evaluation.
- Compressed editor/page-only links, QR SVG/PNG downloads, optional is.gd shortening, and HashBin CID loading.
- Current-file, self-contained HTML, and project ZIP downloads.
- Phone tabs, desktop device widths, a draggable keyboard-accessible splitter, and a gallery of 18 samples plus a guide.
- Offline/PWA support after the footer confirms **Available offline**.

User code runs in an opaque-origin sandboxed iframe, isolated from the editor and other projects on the shared GitHub Pages origin. Page-only links keep a visible user-content label and an Edit link outside the iframe. Continuous loops in project scripts are guarded around one second, and a previous unfinished render triggers a manual-run recovery mode.

## Run locally

The site has **no build step**. Serve the repository root:

```sh
python3 -m http.server 8000
```

Open [localhost:8000](http://localhost:8000/). A web server is needed for service workers and browser editor assets; opening `index.html` directly as a file is not supported.

For development and tests, use Node 22 or later and Python 3:

```sh
npm ci
npx playwright install chromium firefox webkit
npm test
npm run check
BROWSER=chromium npm run test:browser
BROWSER=firefox npm run test:browser
BROWSER=webkit npm run test:browser
```

Browser tests start an isolated local server, use mocked HashBin/shortening services, and spend no account funds. On this macOS host, the installed Firefox build can fail before the app loads with “Could not find profile folder”; the GitHub Actions matrix runs all three engines on Ubuntu. Failure screenshots are saved in `test-results/`.

## Edit samples and offline assets

Each `examples/<id>/` directory contains an original project and a `meta.json` with its title, tags, description, and MDN reference. Regenerate after changing samples:

```sh
npm run examples
npm run gallery
npm run offline
```

`gallery` captures actual sandboxed pages as 480×270 PNG covers. Its `--check` mode verifies source fingerprints and image hashes without launching a browser. Run `npm run offline` after **any** shipped asset change. The offline manifest hashes its inventory and the service worker; updates are complete before activation.

## HashBin setup

**Pages Online** is registered with HashBin, and its public client ID is configured in the `hashbin-client-id` meta tag in `index.html`. Choose **More → Save to HashBin** to connect your account. The exact return URL is **`https://curtcox.github.io/pages/`**. This static browser app uses no client secret. CID loading works without signing in.

Sign-in preserves the whole project in the current tab. The save dialog shows account retention, cost, and balance before saving. Documents use the sibling apps' `hashbin-diagram` envelope with `type: "pages"`, `src` containing the entry page, and `pages` containing the project. Editing invalidates a saved CID link and restores a complete source link.

## Limits

Projects contain at most **50 text files and 5 MiB**. Supported extensions: `.html .htm .css .js .mjs .md .json .svg .txt .csv .xml`. File paths are case-sensitive; renaming does not rewrite references. HashBin also checks the full serialized envelope, which can be larger because it duplicates entry text.

Preview local/session storage is an **in-memory shim that resets on every render**; cookies are a no-op. Exported pages use their host's normal storage. External URLs load normally and are not included in the preview's offline cache. Binary assets and ZIP imports are deferred; use external image URLs or project SVG files.

A one-page HTML download includes its local styles/scripts/assets and leaves links to other pages as written. Download the project ZIP for all source files. Markdown source needs conversion before a generic static host can render it as HTML.

Loop instrumentation preserves source line numbers; inserted code shifts columns. It does not cover inline event attributes, eval, huge allocations, or expensive regexes. The sandbox allows networking; do not include secrets in shared projects. Browser storage is best-effort; download a backup of work you want to keep.

## Deployment and credits

Pushes to `main` independently deploy the repository root using GitHub Pages Actions and run unit/generated-file checks plus the Chromium/Firefox/WebKit test matrix.

Inspired by GraphvizOnline, [ManimOnline](https://curtcox.github.io/ManimOnline/), [Gnuplot Online](https://curtcox.github.io/GnuplotOnline/), and [Python Online](https://curtcox.github.io/PythonOnline/). GraphvizOnline's license is preserved in `LICENSE-graphvizonline`. Vendored Ace (BSD-3), marked (MIT), acorn (MIT), lz-string (MIT), and Project Nayuki's QR encoder (MIT) retain their licenses. Gallery samples are original; your pages are your own.

The implementation design is in [`todo/master_plan.md`](todo/master_plan.md); future contributors should read [`AGENTS.md`](AGENTS.md).
