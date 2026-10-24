# Files & pages

[Home](index.md) · [Sandbox](sandbox.md) · [Sharing](sharing.md)

## A small file project

Start with `index.html`, `style.css`, and `script.js`. Reference files by relative name just as you would on a hosted site:

```html
<link rel="stylesheet" href="style.css">
<script src="script.js"></script>
<a href="about.md">About</a>
```

Files use case-sensitive paths. Allowed text formats: HTML, HTM, CSS, JS, MJS, Markdown, JSON, SVG, TXT, CSV, XML. Up to 50 files and 5 MiB of text. Renaming a file does **not** rewrite references.

The entry is `index.html`, then `index.md`, then `README.md`, then the first HTML or Markdown file. You can choose another entry in File actions. Keep at least one page.

## Markdown

GFM supports tables, task lists, strikethrough, autolinks and heading IDs. Raw HTML is allowed inside the sandbox. Markdown pages use a readable default style; a sibling `style.css` replaces it.

Optional front matter supports a title and a list of CSS files:

```text
---
title: My page
css: [style.css, extra.css]
---
```

## Data and modules

`fetch('data.json')` and relative XMLHttpRequest calls read project files. CSS imports, SVG images, and local ES module imports work too. Binary file imports and ZIP imports are not supported in v1. Images and fonts can use external URLs.
