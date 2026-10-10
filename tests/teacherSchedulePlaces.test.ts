import test from 'node:test';
import assert from 'node:assert/strict';
import { handleWorkspace } from '../api/teacher/workspace.js';
import { registrationFirestore } from './helpers/registrationFirestore.js';
const studentKey='33333333-3333-4333-8333-333333333333', id='11111111-1111-4111-8111-111111111111';
const schema=(names=['학원','이충','용죽','고덕','온라인','기타'])=>({properties:{장소:{type:'select',select:{options:names.map(name=>({name}))}}}});
test('app-only: place options come from the app (saved list, else places already used) and never from Notion',async()=>{
 const {templateFirestore}=await import('./helpers/templateFirestore.js');const f=templateFirestore(), actor:any={uid:'t',admin:false,principal:false,academyId:'main',scopes:[{studentKey,subject:'영어'}],db:f.db};
 const original=global.fetch;let notion=0;global.fetch=(async(url:any)=>{if(String(url).includes('api.notion.com'))notion++;throw Error('NETWORK_BLOCKED');}) as any;
 const call=async(values:any)=>{let body:any;const res:any={setHeader(){},end(v:string){body=JSON.parse(v);}};await handleWorkspace({method:'GET',url:'/api/teacher/workspace?'+new URLSearchParams(values)} as any,res,async()=>actor);return {status:res.statusCode,body};};
 try{
  f.rows.set('teacherSchedules/a',{academyId:'main',ownerUid:'t',data:{place:'이충'}});f.rows.set('teacherSchedules/b',{academyId:'main',ownerUid:'t',data:{place:'학원'}});
  assert.deepEqual((await call({action:'schedule-options'})).body.places,['이충','학원']);
  f.rows.set('appScheduleConfig/main',{places:['학원','이충','용죽','온라인']});
  assert.deepEqual((await call({action:'schedule-options'})).body.places,['학원','이충','용죽','온라인']);
  assert.equal(notion,0);
 }finally{global.fetch=original;}
});
