import ts from 'typescript';
import {mkdtemp,readFile,mkdir,writeFile,rm,readdir} from 'node:fs/promises';
import {join,dirname,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const temp=await mkdtemp(join(root,'.server-import-check-'));
async function compile(directory){
 for(const entry of await readdir(join(root,directory),{withFileTypes:true})){
  const path=join(directory,entry.name);
  if(entry.isDirectory())await compile(path);
  else if(/\.tsx?$/.test(entry.name)&&!entry.name.endsWith('.d.ts')){
   const source=await readFile(join(root,path),'utf8');
   const emitted=ts.transpileModule(source,{fileName:path,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
   const output=join(temp,path.replace(/\.tsx?$/,'.js'));await mkdir(dirname(output),{recursive:true});await writeFile(output,emitted);
  }
 }
}
try{
 await Promise.all([compile('api'),compile('src/lib')]);
 // Plain Node ESM, without tsx or a bundler that resolves extensionless paths.
 // Import only; no handler invocation, network request or operational write.
 const entry=join(temp,'api/teacher/workspace.js');
 const script=`const m=await import(${JSON.stringify(entry)});if(typeof m.handleWorkspace!=='function')throw Error('Missing workspace handler');console.log('Native Node workspace import passed');`;
 const result=spawnSync(process.execPath,['--input-type=module','-e',script],{cwd:root,encoding:'utf8',env:{...process.env,NODE_OPTIONS:''}});
 if(result.stdout)process.stdout.write(result.stdout);if(result.stderr)process.stderr.write(result.stderr);
 if(result.status!==0)process.exitCode=1;
}finally{await rm(temp,{recursive:true,force:true});}
