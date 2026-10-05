import test from 'node:test';
import assert from 'node:assert/strict';
import {handleWorkspace} from '../api/teacher/workspace.js';
import {saveStudentRegistration,listStudentRegistrations,readStudentRegistration} from '../api/_lib/teacherStudentRegistration.js';
import {workspaceError} from '../api/_lib/teacherWorkspaceError.js';
import {registrationFirestore} from './helpers/registrationFirestore.js';
const requestId='11111111-1111-4111-8111-111111111111',writeId='22222222-2222-4222-8222-222222222222',editWriteId='33333333-3333-4333-8333-333333333333';
const actor={uid:'principal-a',admin:false,principal:true,academyId:'academy-a',scopes:[],teachingScopes:[]};
const input={name:'신입생',school:'학교',grade:'고1',guardianPhone:'01000000000',enrollments:[{subject:'영어',status:'등록',startDate:'2026-10-05'}]};
async function call(db:any,method:string,values:any,actorOverride:any=actor){
    let data:any;const headers=new Map<string,string>();
    const res:any={setHeader:(key:string,value:string)=>headers.set(key,value),end:(value:string)=>{data=JSON.parse(value);}};
    const req:any=method==='POST'?{method,body:values}:{method,url:'/api/teacher/workspace?'+new URLSearchParams(values).toString()};
    await handleWorkspace(req,res,async()=>({...actorOverride,db}) as any);
    return {status:res.statusCode,data,headers};
}
test('등록 API 저장·목록·조회 연결과 연락처의 목록 제외',async()=>{
    const {db}=registrationFirestore();
    const saved=await call(db,'POST',{action:'save-student-registration',requestId,writeId,data:input});
    assert.equal(saved.status,200);assert.equal(saved.data.syncStatus,'pending');
    const list=await call(db,'GET',{action:'student-registrations'});
    assert.equal(list.status,200);assert.equal(list.data.total,1);assert.equal(list.data.records[0].title,'신입생(학교 고1)');
    assert.equal(JSON.stringify(list.data).includes(input.guardianPhone),false);assert.equal('requestId' in list.data.records[0],false);
    assert.equal(list.headers.get('Cache-Control'),'private, no-store, no-cache, must-revalidate');
    const read=await call(db,'GET',{action:'student-registration',id:saved.data.id});
    assert.equal(read.status,200);assert.equal(read.data.record.data.guardianPhone,input.guardianPhone);assert.equal(read.data.record.requestId,requestId);
    assert.equal('ownerUid' in read.data.record,false);assert.equal('notionStudentPageId' in read.data.record,false);
});
test('응답 유실 후 동일 수정 요청 재시도는 revision을 두 번 올리지 않음',async()=>{
    const {db}=registrationFirestore();
    await call(db,'POST',{action:'save-student-registration',requestId,writeId,data:input});
    const body={action:'save-student-registration',requestId,writeId:editWriteId,revision:1,data:{...input,tuition:0,paymentDeadline:'매월 5일'}};
    const first=await call(db,'POST',body),replay=await call(db,'POST',body);
    assert.equal(first.data.revision,2);assert.equal(replay.data.revision,2);assert.equal(replay.data.alreadySaved,true);
    const changed=await call(db,'POST',{...body,data:{...body.data,name:'다른 학생'}});
    assert.equal(changed.status,409);assert.equal(changed.data.error,'REGISTRATION_REQUEST_CONFLICT');
    const freshId=await call(db,'POST',{...body,writeId:'44444444-4444-4444-8444-444444444444'});
    assert.equal(freshId.status,409);assert.equal(freshId.data.error,'REGISTRATION_CONFLICT');
});
test('다른 학원 읽기·일반 교사 쓰기·학원 위조 차단',async()=>{
    const {db}=registrationFirestore();const saved=await saveStudentRegistration(db,actor,input,requestId,undefined,writeId);
    const other={...actor,uid:'principal-b',academyId:'academy-b'};
    assert.deepEqual(await listStudentRegistrations(db,other),[]);
    await assert.rejects(readStudentRegistration(db,other,saved.id),/FORBIDDEN/);
    const read=await call(db,'GET',{action:'student-registration',id:saved.id},other);assert.equal(read.status,403);
    const teacher=await call(db,'POST',{action:'save-student-registration',requestId,writeId,data:input},{...actor,principal:false});assert.equal(teacher.status,403);
    const forged=await call(db,'POST',{action:'save-student-registration',requestId,writeId,data:input,academyId:'academy-b'});assert.equal(forged.status,400);
    assert.equal((await call(db,'GET',{action:'student-registration',id:'x'})).status,400);
});
test('등록 목록 8건 페이지네이션과 유효 범위 보정',async()=>{
    const {db,rows}=registrationFirestore();
    for(let i=0;i<10;i++)rows.set('teacherStudentRegistrations/'+String(i),{academyId:actor.academyId,title:'학생'+i,revision:1,syncStatus:'pending',updatedAt:i,data:{enrollments:[]}});
    rows.set('teacherStudentRegistrations/foreign',{academyId:'other',title:'다른 학원 학생',updatedAt:99,data:{enrollments:[]}});
    const page=await call(db,'GET',{action:'student-registrations',page:'2'});assert.equal(page.data.total,10);assert.equal(page.data.records.length,2);assert.equal(page.data.pages,2);
    const last=await call(db,'GET',{action:'student-registrations',page:'999'});assert.equal(last.data.page,2);
    assert.equal((await call(db,'GET',{action:'student-registrations',page:'0'})).status,400);
});
test('실제 저장 실패와 인증 실패를 성공으로 숨기지 않음',async()=>{
    const {db,failNextCommit,rows}=registrationFirestore();failNextCommit();
    const result=await call(db,'POST',{action:'save-student-registration',requestId,writeId,data:input});assert.equal(result.status,500);assert.equal(result.data.ok,false);assert.equal(rows.size,0);
    let json:any;const res:any={setHeader:()=>{},end:(v:string)=>json=JSON.parse(v)};
    await handleWorkspace({method:'GET',url:'/?action=student-registrations'} as any,res,async()=>{throw Error('UNAUTHORIZED');});assert.equal(res.statusCode,401);assert.equal(json.ok,false);
    assert.equal(workspaceError(Error('REGISTRATION_NOT_FOUND'),'student-registration-read').status,404);
});

test('새 담당·반 선택 액션은 일반 교사의 조회와 잘못된 배정을 원격 생성 전에 차단',async()=>{
    const {db,rows}=registrationFirestore();
    const original=globalThis.fetch;let remoteCalls=0;
    globalThis.fetch=async()=>{remoteCalls++;throw Error('NO_REMOTE_CALL_EXPECTED');};
    try {
        assert.equal((await call(db,'GET',{action:'registration-options'},{...actor,principal:false})).status,403);
        const invalid=await call(db,'POST',{action:'save-student-registration',requestId,writeId,data:{...input,enrollments:[{...input.enrollments[0],teacherUid:'outside-teacher'}]}},{...actor,academyId:'main'});
        assert.equal(invalid.data.error,'NOTION_REGISTRATION_ASSIGNMENT_REQUIRED');assert.equal(rows.size,0);assert.equal(remoteCalls,0);
    } finally {globalThis.fetch=original;}
});

test('체크포인트 3에 저장한 초안의 새 선택 필드 기본값은 동일 요청 재시도를 유지',async()=>{
    const {db,rows}=registrationFirestore();
    const saved=await saveStudentRegistration(db,actor,input,requestId,undefined,writeId);
    const record=rows.get('teacherStudentRegistrations/'+saved.id);
    for(const item of record.data.enrollments){delete item.teacherUid;delete item.classIds;}
    const replay=await saveStudentRegistration(db,actor,input,requestId,undefined,writeId);
    assert.equal(replay.alreadySaved,true);assert.equal(replay.revision,1);
});
