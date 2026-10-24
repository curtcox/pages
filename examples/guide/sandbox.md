# The preview sandbox

[Home](index.md) · [Files](files.md) · [Sharing](sharing.md)

Your code runs in an iframe with an **opaque origin**. It cannot access the editor DOM, its cookies, storage, or service-worker caches. The editor never opens user HTML at the top level of its own origin.

Network access is allowed. External links open in a new tab. Links to project pages navigate within the preview.

## Storage resets on refresh

The preview supplies in-memory `localStorage` and `sessionStorage` so beginner examples work. They reset on **every render**, including live refresh. Cookies are a no-op. An exported page uses the real browser storage of its host.

## Loop protection

Project scripts and inline script blocks get a guard that interrupts continuous loops after about one second. It preserves original line numbers, although inserted code shifts columns. Exported HTML has no guard.

The guard does not cover inline event-handler attributes, eval expressions, huge allocations, or expensive regular expressions. If a previous preview may have frozen, the editor starts with Auto-refresh off. Fix the source, then press Run.

Console output is bounded to keep repeated logs from flooding the editor. It includes logs, warnings, errors, expandable objects, and file/line links when the browser supplies them.
