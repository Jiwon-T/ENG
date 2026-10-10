import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {registrationFirestore} from './helpers/registrationFirestore.js';
import {prepareTeacherMessage,sendTeacherMessage,batiConfig,readTeacherMessages} from '../api/_lib/teacherMessages.js';
import {renderTeacherMessage,messageVariables} from '../src/lib/teacherMessage.js';
import {hashStudentKey} from '../api/_lib/security.js';
import {templateFirestore} from './helpers/templateFirestore.js';
import {TEMPLATE_COLLECTION,TEMPLATE_STATE,TEMPLATE_SOURCE,TEMPLATE_DATABASE,templateKey} from '../api/_lib/messageTemplateStore.js';
import {directoryRowKey} from '../api/_lib/academyDirectorySource.js';
const key='11111111-1111-4111-8111-111111111111',templateId='22222222-2222-4222-8222-222222222222',studentDB='e2b0d0f1-c79a-8262-a208-8116c9201cfc';
process.env.BATI_WEBHOOK_URL='https://app.bati.ai/webhook/test_only';process.env.BATI_MESSAGE_PARAM='본문';process.env.BATI_RECIPIENT_PARAM='보호자연락처';process.env.BATI_WEBHOOK_METHOD='GET';process.env.BATI_PAYLOAD_MODE='body-only';process.env.BATI_RESPONSE_RULE=JSON.stringify({kind:'status',status:200});
/* App-only: the student comes from the app directory (migrated from Notion, so it keeps its source database ID) and templates from the app store. */
const directoryKey=directoryRowKey('students',key);
function fixture(){const f=registrationFirestore(),t=templateFirestore(),actor={uid:'teacher',admin:false,principal:false,academyId:'main',scopes:[{studentKey:key,subject:'영어'}]};f.rows.set('academyStudentMemberships/'+key,{academyId:'main'});
 f.rows.set('academyCoreAuthority/main',{active:true});
 f.rows.set('academyDirectorySources/'+directoryKey,{kind:'students',academyId:'main',origin:'notion',databaseId:studentDB,remoteEditedAt:'2026-10-05T00:00:00.000Z',fields:{properties:{학생:{title:[{plain_text:'학생'}]},보호자연락처:{phone_number:'01012345678'}}}});
 const data={title:'인사',body:'{{학생 호칭}} 안녕하세요',target:'보호자',archived:false};
 t.rows.set(TEMPLATE_STATE+'/'+TEMPLATE_SOURCE,{ready:true});t.rows.set(TEMPLATE_COLLECTION+'/'+templateKey(templateId),{sourceKey:TEMPLATE_SOURCE,academyId:'main',databaseId:TEMPLATE_DATABASE,notionPageId:templateId,data,dataHash:'h',revision:1,status:'app'});
 t.rows.set('messageTemplateVerificationRuns/run-1',{verified:true,hash:'verified'});t.rows.set('messageTemplateAuthority/main',{active:true,schemaVersion:1,verifiedRunId:'run-1',verificationHash:'verified'});
 let onTemplate:undefined|(()=>void);
 const templates=(name:string)=>{const c=t.db.collection(name);return name!==TEMPLATE_COLLECTION?c:{...c,doc:(id:string)=>{const ref=c.doc(id);return {...ref,get:async()=>{const v=await ref.get();onTemplate?.();return v;}};}};};
 const db={...f.db,collection:(name:string)=>name.startsWith('messageTemplate')?templates(name):f.db.collection(name)};
 const input={action:'prepare-message',id:randomUUID(),studentKey:key,subject:'영어',templateId,lessonId:null,body:'안녕하세요\n수업 안내입니다.'};
 return {...f,db,actor,input,get row(){return f.rows.get('academyDirectorySources/'+directoryKey);},duringTemplateRead:(fn:()=>void)=>{onTemplate=fn;}};}
test('template escaping and line breaks, zero scores, missing variables',()=>{const vars=messageVariables({displayName:'학생',tuition:0},{correct:0,total:10});assert.equal(vars['단어'],0);assert.equal(vars['수강료'],'0');assert.deepEqual(renderTeacherMessage('\\{\\{학생 호칭\\}\\}<br>{{단어}}점\n{{미상}}',vars),{body:'학생\n0점\n{{미상}}',missing:['미상'],dropped:[]});assert.equal(vars['내신 대비 점수'],undefined);});
test('prepare stores the selected template and body in the app with no sends and no Notion copy',async()=>{const f=fixture();const original=globalThis.fetch;let calls=0;globalThis.fetch=(async()=>{calls++;throw Error('NETWORK');}) as any;try{const r=await prepareTeacherMessage(f.db,f.actor,f.input);assert.equal(r?.status,'ready');assert.equal(f.rows.get('teacherMessages/'+f.input.id).body,f.input.body);assert.equal((await prepareTeacherMessage(f.db,f.actor,f.input))?.status,'ready');await assert.rejects(prepareTeacherMessage(f.db,f.actor,{...f.input,body:'다른 내용'}),/MESSAGE_CONFLICT/);assert.equal(calls,0);assert.deepEqual(Object.keys(f.row.fields.properties).sort(),['학생','보호자연락처'].sort());}finally{globalThis.fetch=original;}});
test('permission, wrong source, unresolved placeholders and missing contact reject',async()=>{const f=fixture();await assert.rejects(prepareTeacherMessage(f.db,{...f.actor,scopes:[]},f.input),/FORBIDDEN/);await assert.rejects(prepareTeacherMessage(f.db,f.actor,{...f.input,body:'{{학생}}'}),/MESSAGE_VARIABLE_REQUIRED/);f.row.databaseId=templateId;await assert.rejects(prepareTeacherMessage(f.db,f.actor,f.input),/NOTION_SOURCE_MISMATCH/);f.row.databaseId=studentDB;f.row.fields.properties.보호자연락처.phone_number='';await assert.rejects(prepareTeacherMessage(f.db,f.actor,f.input),/MESSAGE_CONTACT_REQUIRED/);});
test('double click and replay issue one request; accepted means request accepted',async()=>{const f=fixture();await prepareTeacherMessage(f.db,f.actor,f.input);let calls=0;const transport:any=async(url:URL,options:any)=>{calls++;assert.equal(url.searchParams.get('보호자연락처'),'01012345678');assert.equal(url.searchParams.get('본문'),f.input.body);assert.equal(options.redirect,'manual');return {ok:true,status:200};};await Promise.all([sendTeacherMessage(f.db,f.actor,f.input.id,true,transport),sendTeacherMessage(f.db,f.actor,f.input.id,true,transport)]);await sendTeacherMessage(f.db,f.actor,f.input.id,true,transport);assert.equal(calls,1);assert.equal(f.rows.get('teacherMessages/'+f.input.id).status,'accepted');const another={...f.input,id:randomUUID()};await prepareTeacherMessage(f.db,f.actor,another);await assert.rejects(sendTeacherMessage(f.db,f.actor,another.id,true,transport),/MESSAGE_DUPLICATE/);assert.equal(calls,1);});
for(const mode of ['timeout','redirect','http500'])test(`${mode} blocks every resend`,async()=>{const f=fixture();await prepareTeacherMessage(f.db,f.actor,f.input);let calls=0;const transport:any=async()=>{calls++;if(mode==='timeout')throw Error('timeout');return {ok:false};};assert.equal((await sendTeacherMessage(f.db,f.actor,f.input.id,true,transport))?.status,'uncertain');await sendTeacherMessage(f.db,f.actor,f.input.id,true,transport);assert.equal(calls,1);});
test('final confirmation, changed phone, pending contact and revoked membership block sending',async()=>{const f=fixture();await prepareTeacherMessage(f.db,f.actor,f.input);const transport:any=async()=>{throw Error('should not send');};await assert.rejects(sendTeacherMessage(f.db,f.actor,f.input.id,false,transport),/MESSAGE_CONFIRM_REQUIRED/);f.row.fields.properties.보호자연락처.phone_number='01099999999';await assert.rejects(sendTeacherMessage(f.db,f.actor,f.input.id,true,transport),/MESSAGE_CONTACT_CHANGED/);f.row.fields.properties.보호자연락처.phone_number='01012345678';f.rows.set('teacherStudentEdits/'+hashStudentKey(key),{contactChanged:true,status:'uncertain'});await assert.rejects(sendTeacherMessage(f.db,f.actor,f.input.id,true,transport),/STUDENT_PROFILE_CONTACT_PENDING/);f.rows.delete('teacherStudentEdits/'+hashStudentKey(key));f.rows.set('academyStudentMemberships/'+key,{academyId:'main',disabled:true});await assert.rejects(sendTeacherMessage(f.db,f.actor,f.input.id,true,transport),/FORBIDDEN/);});
test('transaction failure before sending produces no network side effect',async()=>{const f=fixture();await prepareTeacherMessage(f.db,f.actor,f.input);let calls=0;f.failNextCommit();await assert.rejects(sendTeacherMessage(f.db,f.actor,f.input.id,true,(async()=>{calls++;return {ok:true,status:200};}) as any),/FIRESTORE_UNAVAILABLE/);assert.equal(calls,0);assert.equal(f.rows.get('teacherMessages/'+f.input.id).status,'ready');});
test('lost result persistence remains sending and cannot resend',async()=>{const f=fixture();await prepareTeacherMessage(f.db,f.actor,f.input);let calls=0;const transport:any=async()=>{calls++;f.failNextCommit();return {ok:true,status:200};};await assert.rejects(sendTeacherMessage(f.db,f.actor,f.input.id,true,transport),/FIRESTORE_UNAVAILABLE/);assert.equal((await sendTeacherMessage(f.db,f.actor,f.input.id,true,transport))?.status,'sending');assert.equal(calls,1);});
test('listing templates and lessons respects subject and academy',async()=>{const f=fixture();f.rows.set('teacherLessonDrafts/'+randomUUID(),{academyId:'main',stage:'published',data:{studentKey:key,subject:'영어',date:'2026-10-05'}});f.rows.set('teacherLessonDrafts/'+randomUUID(),{academyId:'main',stage:'published',data:{studentKey:key,subject:'수학',date:'2026-10-05'}});const r=await readTeacherMessages(f.db,f.actor,key,'영어');assert.equal(r.templates.length,1);assert.equal(r.lessons.length,1);await assert.rejects(readTeacherMessages(f.db,f.actor,key,'수학'),/FORBIDDEN/);});
test('webhook configuration refuses external host, credentials and query',()=>{const original=process.env.BATI_WEBHOOK_URL;for(const value of ['http://app.bati.ai/webhook/key','https://evil.test/webhook/key','https://x:password@app.bati.ai/webhook/key','https://app.bati.ai/webhook/key?x=1']){process.env.BATI_WEBHOOK_URL=value;assert.throws(batiConfig,/MESSAGE_CONFIG_REQUIRED/);}process.env.BATI_WEBHOOK_URL=original;});
test('message parameter cannot overwrite recipient or contain control characters',()=>{const original=process.env.BATI_MESSAGE_PARAM;try{for(const name of ['보호자연락처',' body','body\n']){process.env.BATI_MESSAGE_PARAM=name;assert.throws(batiConfig,/MESSAGE_CONFIG_REQUIRED/);}}finally{process.env.BATI_MESSAGE_PARAM=original;}});
test('membership removed during the template read blocks prepare',async()=>{const f=fixture();f.duringTemplateRead(()=>f.rows.delete('academyStudentMemberships/'+key));await assert.rejects(prepareTeacherMessage(f.db,f.actor,f.input),/FORBIDDEN/);assert.equal(f.rows.has('teacherMessages/'+f.input.id),false);});
test('unknown acceptance contract blocks before lock or network and leaves prepared body reusable',async()=>{
 const f=fixture();await prepareTeacherMessage(f.db,f.actor,f.input);const prior=process.env.BATI_RESPONSE_RULE;delete process.env.BATI_RESPONSE_RULE;let calls=0;
 try{await assert.rejects(sendTeacherMessage(f.db,f.actor,f.input.id,true,(async()=>{calls++;return new Response();}) as any),/MESSAGE_CONFIG_REQUIRED/);assert.equal(calls,0);assert.equal(f.rows.get('teacherMessages/'+f.input.id).status,'ready');assert.equal([...f.rows.keys()].filter(k=>k.startsWith('teacherMessageSendLocks/')).length,0);}finally{process.env.BATI_RESPONSE_RULE=prior;}
});
test('HTML 200 does not count as confirmed JSON acceptance or permit resend',async()=>{
 const f=fixture();await prepareTeacherMessage(f.db,f.actor,f.input);const prior=process.env.BATI_RESPONSE_RULE;process.env.BATI_RESPONSE_RULE=JSON.stringify({kind:'json',status:200,path:['success'],equals:true});let calls=0;
 try{const transport:any=async()=>{calls++;return new Response('<html>완료 페이지</html>',{status:200});};const result=await sendTeacherMessage(f.db,f.actor,f.input.id,true,transport);assert.equal(result?.status,'uncertain');assert.equal(result?.httpStatus,200);assert.equal(result?.outcomeCode,'response-unconfirmed');await sendTeacherMessage(f.db,f.actor,f.input.id,true,transport);assert.equal(calls,1);}finally{process.env.BATI_RESPONSE_RULE=prior;}
});
test('contact edit begins during the template read blocks preparation transaction',async()=>{const f=fixture();f.duringTemplateRead(()=>f.rows.set('teacherStudentEdits/'+hashStudentKey(key),{contactChanged:true,status:'uncertain'}));await assert.rejects(prepareTeacherMessage(f.db,f.actor,f.input),/STUDENT_PROFILE_CONTACT_PENDING/);assert.equal(f.rows.has('teacherMessages/'+f.input.id),false);});
test('templates come only from the app; without the template switch reading and preparing are refused',async()=>{
 const f=fixture();const r=await readTeacherMessages(f.db,f.actor,key,'영어');assert.equal(r.templates[0].title,'인사');
 await prepareTeacherMessage(f.db,f.actor,f.input);assert.equal(f.rows.get('teacherMessages/'+f.input.id).context['메시지템플릿선택'],''); // Preserve the existing title-property context contract.
 await assert.rejects(readTeacherMessages(f.db,{...f.actor,scopes:[]},key,'영어'),/FORBIDDEN/);
 const g=fixture();g.db.collection('messageTemplateAuthority').doc('main');
 const off={...g.db,collection:(name:string)=>name==='messageTemplateAuthority'?{doc:()=>({get:async()=>({exists:false,data:()=>undefined})})}:g.db.collection(name)};
 await assert.rejects(readTeacherMessages(off,g.actor,key,'영어'),/TEMPLATE_APP_REQUIRED/);await assert.rejects(prepareTeacherMessage(off,g.actor,g.input),/TEMPLATE_APP_REQUIRED/);
});

test('an app-registered student can be messaged with no Notion page',async()=>{
 const f=fixture();const original=globalThis.fetch;let calls=0;globalThis.fetch=(async()=>{calls++;throw Error('NETWORK');}) as any;
 f.rows.set('academyDirectorySources/'+directoryKey,{kind:'students',academyId:'main',origin:'app',databaseId:null,appEditedAt:'2026-10-05T00:00:00.000Z',fields:{properties:{학생:{title:[{plain_text:'앱 학생'}]},보호자연락처:{phone_number:'01012345678'}}}});
 try{const prepared=await prepareTeacherMessage(f.db,f.actor,f.input);assert.equal(prepared.status,'ready');assert.equal(prepared.recipient,'01012345678');assert.equal(calls,0);}finally{globalThis.fetch=original;}
});

test('optional score lines drop out when the lesson has no value',()=>{
 const t='{{학생 호칭}} 수업 결과\n단어 {{단어}}점\n테스트 {{테스트}}\n내신 대비 {{내신 대비 점수}}점\n감사합니다';
 const both=renderTeacherMessage(t,messageVariables({displayName:'민수'},{correct:9,total:10,test:'상',examCorrect:18,examTotal:20}));
 assert.equal(both.body,'민수 수업 결과\n단어 90점\n테스트 상\n내신 대비 90점\n감사합니다');
 const examOnly=renderTeacherMessage(t,messageVariables({displayName:'민수'},{test:'미확인',examCorrect:18,examTotal:20}));
 assert.equal(examOnly.body,'민수 수업 결과\n내신 대비 90점\n감사합니다');assert.deepEqual(examOnly.dropped,['단어','테스트']);assert.deepEqual(examOnly.missing,[]);
 assert.equal(renderTeacherMessage(t,messageVariables({displayName:'민수'},{})).body,'민수 수업 결과\n감사합니다');
 assert.deepEqual(renderTeacherMessage('{{보호자이름}}님',messageVariables({displayName:'민수'},{})).missing,['보호자이름']);
});

test('보호자 문자 needs the app-only switch, not the Notion student database setting', async () => {
    const { templateFirestore } = await import('./helpers/templateFirestore.js');
    const { readTeacherMessages } = await import('../api/_lib/teacherMessages.js');
    const saved = process.env.NOTION_STUDENT_DATABASE_ID; delete process.env.NOTION_STUDENT_DATABASE_ID;
    try {
        const key = '11111111-1111-4111-8111-111111111111', actor = { uid: 't', admin: false, principal: false, academyId: 'main', scopes: [] };
        const before = templateFirestore();
        await assert.rejects(readTeacherMessages(before.db, actor, key, '영어'), /CORE_NOT_READY/);
        const after = templateFirestore(); after.rows.set('academyCoreAuthority/main', { active: true });
        // Past the setting check, the usual membership/permission check decides.
        await assert.rejects(readTeacherMessages(after.db, actor, key, '영어'), /FORBIDDEN/);
    } finally { if (saved === undefined) delete process.env.NOTION_STUDENT_DATABASE_ID; else process.env.NOTION_STUDENT_DATABASE_ID = saved; }
});
