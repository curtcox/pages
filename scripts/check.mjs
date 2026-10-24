import fs from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
const root = new URL('../',import.meta.url);
async function walk(dir) { for (const item of await fs.readdir(new URL(dir,root),{withFileTypes:true})) { const path = dir+item.name; if (['node_modules','.git','examples','vendor','ace'].includes(item.name)) continue; if (item.isDirectory()) await walk(path+'/'); else if (/\.(js|cjs|mjs)$/.test(item.name)) execFileSync(process.execPath,['--check',new URL(path,root).pathname]); } }
await walk('');
for (const script of ['build-examples','render-gallery','update-offline']) process.stdout.write(execFileSync(process.execPath,[new URL('scripts/'+script+'.mjs',root).pathname,'--check']));
console.log('All scripts parse. Generated files are current.');
