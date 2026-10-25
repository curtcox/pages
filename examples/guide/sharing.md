# Sharing & offline

[Home](index.md) · [Files](files.md) · [Sandbox](sandbox.md)

## Share a project

**Share** creates a compressed link containing your project. Choose Editor or Page only, and optionally Don't run on open. Anyone with the link can read its source. Avoid including secrets.

Page-only links keep a small strip identifying the content as a user-created page. The Edit link brings the same project into the editor.

**QR** encodes the link and downloads SVG or PNG. Large projects make dense QR codes; Save to HashBin creates a shorter link. The optional is.gd shortener uses the AllOrigins proxy and needs a connection.

## HashBin

Load a CID without signing in. Saving uses your HashBin account balance and retention settings, with a quote before saving. Sign-in preserves your project in this tab.

Pages Online has a registered public client ID. Choose **More → Save to HashBin** to connect your account; sign-in returns to `https://curtcox.github.io/pages/`. The browser app uses no client secret. The JSON document can be larger than the raw files because it includes the entry source for compatibility; HashBin checks the full document against its 5 MiB limit.

## Take your files with you

Download the current file, the displayed page as one HTML file, or the project ZIP. A ZIP preserves every file path and can be hosted directly. One-page HTML downloads keep links to other pages, which must be downloaded separately. Markdown source files need conversion to HTML before ordinary static hosting will render them as pages.

Open files can add local text files or replace the project. Importing a ZIP or binary image is deferred.

## Offline

When the footer says **Available offline**, the app, editor, bundled libraries, samples, and gallery covers are cached. You can install it as a PWA. External resources in your page (CDN scripts, fonts, photos) are not cached, because the sandbox is not controlled by the editor's service worker. HashBin and link shortening also need internet.

Updates offer **Update and reload** after preserving your project. Browser storage is best-effort: download a backup of work you want to keep.
