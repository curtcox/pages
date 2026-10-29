// Apply before the body is parsed so page-only links never flash the editor.
if (new URLSearchParams(location.search).has('view')) document.documentElement.dataset.view = 'true';
