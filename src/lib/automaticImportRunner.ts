export async function runAutomaticImport(kind:'templates'|'directory'|'academic',request:(action:string,body?:any)=>Promise<any>,stopped:()=>boolean,progress:(message:string)=>void){
 let steps=0;
 async function drain(action:string,body:any,label:string,review:(r:any)=>number){
  do{if(stopped())return false;if(++steps>10000)throw Error('진행 한도에 도달했습니다. 저장된 위치에서 재개하세요.');
   const r=await request(action,body);progress(`${label} · ${steps}단계 처리`);
   if(review(r)>0)throw Error(`${label}: 확인이 필요한 자료가 있습니다. 기존 저장본을 확인한 뒤 재개하세요.`);
   if(!r.continue)return true;
  }while(true);
 }
 if(kind==='templates'){
  if(!await drain('template-import-step',{confirmed:true},'문자 템플릿 가져오기',r=>r.counts?.conflict||0))return {stopped:true};
  if(!await drain('template-reconcile-step',{confirmed:true},'문자 템플릿 원본 대조',r=>r.counts?.unknown||0))return {stopped:true};
 }else if(kind==='directory'){
  for(const type of ['students','teachers','enrollments']){
   if(!await drain('directory-import-step',{kind:type,confirmed:true},`${type==='students'?'학생':type==='teachers'?'선생님':'수강'} 가져오기`,r=>r.counts?.review||0))return {stopped:true};
  }
  for(const type of ['students','teachers','enrollments']){
   if(!await drain('directory-reconcile-step',{kind:type,confirmed:true},'연결·원본 대조',r=>r.counts?.review||0))return {stopped:true};
   if(stopped())return {stopped:true};
   await request('directory-approve',{kind:type,confirmed:true});
  }
 }else{
  while(!stopped()){
   if(++steps>10000)throw Error('진행 한도에 도달했습니다. 저장된 위치에서 재개하세요.');
   const p=await request('read:academic-migration-preview');if(p.done)return {stopped:false};
   if(p.unknownAuthors)throw Error('작성자 연결을 확인해야 하는 성적이 있습니다. 확인 후 재개하세요.');
   if(stopped())return {stopped:true};
   const r=await request('academic-migration-next',{confirmed:true,reviewToken:p.reviewToken});progress(`과거 성적 ${r.total}건 확인 · 이번 단계 ${r.imported}건 이전 · ${r.skipped}건 보존`);
   if(r.done)return {stopped:false};
  }
  return {stopped:true};
 }
 return {stopped:stopped()};
}
