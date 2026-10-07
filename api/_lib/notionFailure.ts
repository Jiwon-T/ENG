// Never retain Notion's raw message: it can echo student names or field values.
export function notionFailureDiagnostic(path:string,method:string,body:any,error:any){
 const properties=body?.properties||{};
 const message=typeof error?.message==='string'?error.message:'';
 const fields=Object.keys(properties).filter(name=>message.includes(name)).slice(0,12);
 return {
  operation:method+' '+(path==='pages'?'pages':path.startsWith('pages/')?'pages/:id':path.endsWith('/query')?'databases/:id/query':'databases/:id'),
  code:['validation_error','object_not_found','unauthorized','restricted_resource','rate_limited','conflict_error','internal_server_error'].includes(error?.code)?error.code:'unknown',
  requestId:typeof error?.request_id==='string'&&/^[a-zA-Z0-9-]{1,80}$/.test(error.request_id)?error.request_id:null,
  fields:fields.map(name=>({name,type:Object.keys(properties[name]||{})[0]||'unknown'})),
 };
}
