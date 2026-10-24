(() => {
'use strict';
const lib = typeof module !== 'undefined' ? require('../vendor/marked.min.js') : globalThis.marked;
const escape = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const defaultCSS = 'body{font:18px/1.7 system-ui,sans-serif;max-width:52rem;margin:3rem auto;padding:0 1.5rem;color:#233b3c;background:#faf9f5}h1,h2,h3{line-height:1.2;letter-spacing:-.03em}h1{font-size:2.8rem}a{color:#16786a}pre{overflow:auto;background:#eaece7;padding:1rem;border-radius:8px}code{font-size:.88em}table{border-collapse:collapse;width:100%}th,td{border:1px solid #ccd5cf;padding:.6rem;text-align:left}blockquote{border-left:3px solid #64a592;padding-left:1rem}img,svg{max-width:100%}input[type=checkbox]{margin-right:.5rem}';
function frontMatter(source) {
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  const meta = {};
  if (!match) return { source, meta };
  let list = null;
  for (const line of match[1].split(/\r?\n/)) {
    const item = line.match(/^\s*-\s+(.+)$/);
    if (item && list) { meta[list].push(item[1].replace(/^['"]|['"]$/g,'')); continue; }
    const field = line.match(/^(title|css):\s*(.*)$/); if (!field) continue;
    if (field[1] === 'title') meta.title = field[2].replace(/^['"]|['"]$/g,'');
    else { list = 'css'; meta.css = field[2] ? field[2].replace(/^\[|\]$/g,'').split(',').map(s => s.trim().replace(/^['"]|['"]$/g,'')) : []; }
  }
  return { source: source.slice(match[0].length), meta };
}
function render(source, { name = 'index.md', hasStyle = false, stylePath = 'style.css' } = {}) {
  const parsed = frontMatter(source), used = new Map();
  const engine = new lib.Marked({ gfm: true });
  engine.use({ renderer: { heading(token) {
    const base = token.text.toLowerCase().replace(/<[^>]*>/g,'').replace(/[^\p{L}\p{N}\s_-]/gu,'').trim().replace(/\s+/g,'-') || 'section';
    const n = used.get(base) || 0; used.set(base,n+1);
    return `<h${token.depth} id="${escape(base + (n ? '-' + n : ''))}">${this.parser.parseInline(token.tokens)}</h${token.depth}>\n`;
  } } });
  const title = parsed.meta.title || parsed.source.match(/^#\s+(.+)$/m)?.[1] || name;
  const styles = parsed.meta.css || (hasStyle ? [stylePath] : []);
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escape(title)}</title>${styles.length ? styles.map(path => `<link rel="stylesheet" href="${escape(path)}">`).join('') : `<style>${defaultCSS}</style>`}</head><body>${engine.parse(parsed.source)}</body></html>`;
}
const Markdown = { render, frontMatter, escape };
if (typeof module !== 'undefined') module.exports = Markdown; else globalThis.Markdown = Markdown;
})();
