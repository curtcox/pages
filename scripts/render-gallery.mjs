import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import http from 'node:http';
const require = createRequire(import.meta.url), { catalog } = require('../src/examples.js');
const root = new URL('../',import.meta.url), target = new URL('gallery/previews/',root);
const renderer = await Promise.all(['src/bundler.js','src/markdown.js','src/preview-runtime.js','src/loop-guard.js','vendor/marked.min.js'].map(file=>fs.readFile(new URL(file,root))));
const fingerprint = sample => { const hash = createHash('sha256').update(JSON.stringify(sample)); for (const source of renderer) hash.update(source); return hash.digest('hex'); };
if (process.argv.includes('--check')) {
  const saved = JSON.parse(await fs.readFile(new URL('fingerprints.json',target),'utf8'));
  for (const sample of catalog) {
    if (saved[sample.id]?.source !== fingerprint(sample)) throw Error('Gallery preview is stale: '+sample.id);
    const png = await fs.readFile(new URL(sample.id+'.png',target));
    if (!png.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])) || png.readUInt32BE(16) !== 480 || png.readUInt32BE(20) !== 270) throw Error('Invalid preview PNG: '+sample.id);
    if (saved[sample.id].image !== createHash('sha256').update(png).digest('hex')) throw Error('Preview was modified: '+sample.id);
  }
  console.log(catalog.length+' gallery previews verified.');
} else {
  const { chromium } = require('playwright');
  const server = http.createServer(); await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve)); const port = server.address().port; await new Promise(resolve=>server.close(resolve));
  const child = spawn('python3',['-m','http.server',String(port),'--bind','127.0.0.1'],{cwd:root,stdio:'ignore'});
  let browser;
  try {
    for (let i=0;i<50;i++) { try { if ((await fetch(`http://127.0.0.1:${port}/index.html`)).ok) break; } catch (_) {} await new Promise(resolve=>setTimeout(resolve,100)); }
    browser = await chromium.launch(); const page = await browser.newPage({viewport:{width:960,height:576},deviceScaleFactor:1,serviceWorkers:'block'}), hashes = {};
    await fs.mkdir(target,{recursive:true});
    for (const sample of catalog) {
      await page.goto(`http://127.0.0.1:${port}/?example=${sample.id}&view`);
      await page.waitForFunction(()=>document.getElementById('preview').getAttribute('srcdoc'));
      await page.waitForTimeout(350);
      // The locator screenshot contains only the user page, without the editor's strip.
      const png = await page.locator('#preview').screenshot({animations:'disabled'});
      const resized = await page.evaluate(async bytes=>{
        const image = new Image(); image.src = 'data:image/png;base64,'+bytes; await image.decode();
        const canvas = document.createElement('canvas'); canvas.width = 480; canvas.height = 270; canvas.getContext('2d').drawImage(image,0,0,480,270); return canvas.toDataURL('image/png').split(',')[1];
      },png.toString('base64'));
      const image = Buffer.from(resized,'base64'); await fs.writeFile(new URL(sample.id+'.png',target),image);
      hashes[sample.id] = {source:fingerprint(sample),image:createHash('sha256').update(image).digest('hex')}; console.log('Rendered '+sample.id);
    }
    await fs.writeFile(new URL('fingerprints.json',target),JSON.stringify(hashes,null,2)+'\n');
  } finally { await browser?.close(); child.kill(); }
}
