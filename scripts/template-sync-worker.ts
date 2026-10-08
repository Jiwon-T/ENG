import {createServer} from 'node:http';
import {templateWorkerFirestore} from '../api/_lib/messageTemplateWorkerFirestore.js';
import {parseJsonBody,sendJson} from '../api/_lib/http.js';
import {authorizeTemplateWorker,runTemplateWorker} from '../api/_lib/messageTemplateWorker.js';
import {authorizeDirectoryWorker,runDirectoryWorker} from '../api/_lib/academyDirectorySource.js';

// Deploy as a separate private Cloud Run service, with IAM authentication enabled.
// Scheduler sends X-Template-Worker-Secret AND an OIDC token handled by Cloud Run.
createServer(async(req,res)=>{
 if(req.method==='GET'&&req.url==='/health'){res.statusCode=200;res.end('ok');return;}
 if(req.method!=='POST'||req.url!=='/run'){res.statusCode=404;res.end();return;}
 try{
  const body=await parseJsonBody(req);
  const directory=['directory-pull','directory-reconcile','directory-resume'].includes(body?.mode);
  if(directory)authorizeDirectoryWorker(req.headers['x-template-worker-secret']);else authorizeTemplateWorker(req.headers['x-template-worker-secret']);
  const result=directory?await runDirectoryWorker(templateWorkerFirestore(),body):await runTemplateWorker(templateWorkerFirestore(),body);
  sendJson(res,200,{ok:true,...result});
 }catch(error:any){
  const known=['FORBIDDEN','TEMPLATE_WORKER_DISABLED','TEMPLATE_BUSY','TEMPLATE_LEASE_LOST','DIRECTORY_WORKER_DISABLED','DIRECTORY_BUSY'].includes(error?.message)?error.message:'TEMPLATE_WORKER_FAILED';
  // Do not print tokens, template bodies, Firebase credentials or upstream errors.
  sendJson(res,known==='FORBIDDEN'?403:known.endsWith('_WORKER_DISABLED')?503:500,{ok:false,error:known});
 }
}).listen(Number(process.env.PORT||8080),'0.0.0.0');
