import {mkdir,readdir,copyFile} from 'node:fs/promises';
import {resolve,dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const target=join(root,'.template-worker-context',randomUUID());
await mkdir(target,{recursive:true});
async function copySource(relative){
 const source=join(root,relative),output=join(target,relative);await mkdir(output,{recursive:true});
 for(const e of await readdir(source,{withFileTypes:true})){
  const next=join(relative,e.name);if(e.isDirectory())await copySource(next);
  else if(e.isFile()&&/\.(ts|tsx|js|mjs)$/.test(e.name))await copyFile(join(root,next),join(target,next));
 }
}
await copySource('api');await copySource('src/lib');await mkdir(join(target,'scripts'));
for(const relative of ['package.json','package-lock.json','firebase-applet-config.json','scripts/template-sync-worker.ts','scripts/template-worker.Dockerfile'])await copyFile(join(root,relative),join(target,relative));
// Only the explicit source/dependency allowlist is uploaded. No .env, key files,
// ZIPs, operating spreadsheets, browser fixtures, tests, node_modules or Git history.
console.log(target);
