# Pages Online guide

Build small HTML, CSS, JavaScript and Markdown projects in your browser. Start with a [gallery example](../gallery.html) or open the [interactive guide](../?example=guide&view).

## Edit and preview

Choose a file tab to edit it. File actions rename files, change the entry page or delete files; Add file creates a new text file. Keep at least one HTML or Markdown page. Projects contain at most 50 files and 5 MiB, and the saved envelope must also fit 5 MiB.

Auto-refresh renders after a pause. Turn it off for manual Run, or use Ctrl+Enter / Command+Enter. Preview links navigate within the project. Console messages and errors point back to their source file and line. On a phone, Preview, Code and Console have their own tabs.

Your code runs in an opaque child iframe inside a trusted preview host. The editor never executes project code. Preview storage resets with each render. External resources are not part of the offline copy. Loop guards help with continuous loops; crash-safe mode waits for a manual run after an unfinished render.

## Share and recover

Share contains the complete project. Choose Editor or Page only, and whether it runs on open. The selected preview page travels in the link. Page-only views keep a visible user-content label and an Edit link outside the iframe.

QR can show a share link or load a code from the camera, an uploaded image, paste or drop. A dense code offers Save to HashBin for a short CID link. HashBin content is verified before it replaces the project. Publish approval stays on hashbin.org; this editor stores no HashBin credentials.

Explicit project, example and CID links open their document independently of saved work. More → Resume saved work restores prior drafts. Invalid links report an error. Editing a linked document retains the previous draft for recovery.

## Files and offline

More downloads the current source file, a self-contained HTML page or the whole project ZIP. ZIPs preserve original paths and Markdown text. Renaming a file does not rewrite references.

Wait for Available offline before disconnecting. More → Repair offline copy verifies and restores damaged app files. Update and reload preserves the current project. The trusted local preview host is included; user-content networking stays outside application caching.

Canonical hosting is [pages.hashbin.page](https://pages.hashbin.page/); [GitHub Pages](https://curtcox.github.io/pages/) remains the recovery origin. See the [migration notes](fragment-kit-migration.md).
