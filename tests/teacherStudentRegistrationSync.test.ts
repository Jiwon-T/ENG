import {admissionNotionSchema} from '../api/_lib/studentAdmission.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {handleWorkspace} from '../api/teacher/workspace.js';
import {registrationFirestore} from './helpers/registrationFirestore.js';
import {saveStudentRegistration,readStudentRegistration} from '../api/_lib/teacherStudentRegistration.js';
import {syncStudentRegistration} from '../api/_lib/teacherStudentRegistrationSync.js';
import {REGISTRATION_STUDENT_DATABASE as studentDB,REGISTRATION_ENROLLMENT_DATABASE as enrollmentDB,registrationStudentProperties,registrationEnrollmentProperties,registrationNotion,assertRegistrationSchema} from '../api/_lib/teacherStudentRegistrationNotion.js';
import {migrateStudentMapping} from '../api/_lib/studentIdentity.js';
import {syncAcademicPage} from '../api/_lib/academic.js';
import {hashStudentKey,generateInternalStudentId} from '../api/_lib/security.js';
import {teacherReadCache,teacherReadKey} from '../api/_lib/teacherReadCache.js';
const actor={uid:'principal',admin:false,principal:true,academyId:'main'};
const input={name:'신입생',school:'학교',grade:'고1',guardianPhone:'01000000000',tuition:0,paymentDeadline:'매월 5일',enrollments:[{subject:'영어',status:'등록',startDate:'2026-10-05'},{subject:'수학',status:'대기',startDate:'2026-10-06'}]};
const requestId='11111111-1111-4111-8111-111111111111',studentId='22222222-2222-4222-8222-222222222222',enrollmentId='33333333-3333-4333-8333-333333333333';
function remoteNotion() {
    const studentTypes:any={'학생':'title','학교':'rich_text','학년':'select','앱 등록 ID':'rich_text','학생 호칭':'rich_text','학생연락처':'phone_number','보호자연락처':'phone_number','보호자이름':'rich_text','수강료':'number','납부기한':'rich_text','등록상태':'status','강의명':'multi_select','수강시작일':'date'};
    const enrollmentTypes:any={'수강 내역':'title','학생':'relation','앱 등록 ID':'rich_text'};
    for(const subject of ['영어','수학','국어','과학','한국사'])Object.assign(enrollmentTypes,{[subject]:'status',[subject+' 시작일']:'date',[subject+' 중단일']:'date'});
    const schemas:any={[studentDB]:{properties:Object.fromEntries(Object.entries(studentTypes).map(([key,type])=>[key,{type}]))},[enrollmentDB]:{properties:Object.fromEntries(Object.entries(enrollmentTypes).map(([key,type])=>[key,{type,...(key==='학생'?{relation:{database_id:studentDB}}:{})}]))}};
    Object.assign(schemas[studentDB].properties,Object.fromEntries(Object.entries(admissionNotionSchema).map(([name,definition])=>[name,{type:Object.keys(definition)[0],...definition}])));
    const pages=new Map<string,any>(),requests:any[]=[];let studentCreate=0,enrollmentCreate=0;
    let failStudent:'none'|'commit-timeout'|'no-commit-timeout'='none',failEnrollment=false,createGate:Promise<void>|undefined;
    const notion=async(path:string,method='GET',body?:any):Promise<any>=>{
        requests.push({path,method,body});
        if(path==='pages' && method==='POST') {
            const isStudent=body.parent.database_id===studentDB;if(createGate)await createGate;
            if(isStudent)studentCreate++;else enrollmentCreate++;
            if(!isStudent && failEnrollment){failEnrollment=false;throw Error('NOTION_400');}
            const id=isStudent?studentId:enrollmentId;
            if(isStudent && failStudent==='no-commit-timeout')throw Error('TIMEOUT');
            const page={id,parent:body.parent,properties:body.properties,last_edited_time:'2026-10-05T00:00:00Z'};pages.set(id,structuredClone(page));
            if(isStudent && failStudent==='commit-timeout'){failStudent='none';throw Error('TIMEOUT');}
            return structuredClone(page);
        }
        if(path.startsWith('pages/'))return structuredClone(pages.get(path.slice(6)));
        if(path.endsWith('/query')) {
            const database=path.split('/')[1],filter=body.filter;
            return {results:[...pages.values()].filter(page=>page.parent.database_id===database && (filter.rich_text ? (page.properties[filter.property]?.rich_text || []).some((part:any)=>part.text.content===filter.rich_text.equals) : (page.properties[filter.property]?.relation || []).some((part:any)=>part.id===filter.relation.contains))).map(page=>structuredClone(page)),has_more:false};
        }
        if(path.startsWith('databases/'))return structuredClone(schemas[path.split('/')[1]]);
        throw Error('UNEXPECTED_NOTION_CALL');
    };
    return {notion,pages,requests,schemas,setStudentFailure:(failure:typeof failStudent)=>{failStudent=failure;},failEnrollmentOnce:()=>{failEnrollment=true;},setCreateGate:(gate:Promise<void>)=>{createGate=gate;},counts:()=>({studentCreate,enrollmentCreate})};
}
async function fixture() {
    process.env.NOTION_STUDENT_DATABASE_ID=studentDB;
    const memory=registrationFirestore(),remote=remoteNotion();
    const saved=await saveStudentRegistration(memory.db,actor,input,requestId);
    const deps={notion:remote.notion,mapStudent:migrateStudentMapping,syncEnrollment:syncAcademicPage};
    return {...memory,remote,saved,deps};
}
test('학생·수강 노션 생성 후 기존 앱 매핑·과목 수강·학원 명부 연결',async()=>{
    const {db,rows,remote,saved,deps}=await fixture();
    await teacherReadCache.get(teacherReadKey(actor,'students'),async()=>['old']);
    const synced=await syncStudentRegistration(db,actor,saved.id,1,deps);
    assert.equal(synced.syncStatus,'synced');assert.deepEqual(remote.counts(),{studentCreate:1,enrollmentCreate:1});
    assert.equal(rows.get('academyStudentMemberships/'+studentId).academyId,'main');
    const mapping=rows.get('notionStudentMappings/'+hashStudentKey(studentId));assert.equal(mapping.firebaseUid,null);assert.equal(mapping.studentDisplayName,'신입생 (학교1)');
    assert.equal(rows.get('studentEnrollments/'+enrollmentId).internalStudentId,mapping.internalStudentId);
    assert.deepEqual(rows.get('studentEnrollments/'+enrollmentId).subjects.map((entry:any)=>[entry.subject,entry.status]),[['영어','등록'],['수학','대기']]);
    assert.deepEqual(await teacherReadCache.get(teacherReadKey(actor,'students'),async()=>['new']),['new']);
    const result=await syncStudentRegistration(db,actor,saved.id,1,deps);assert.equal(result.alreadySynced,true);assert.deepEqual(remote.counts(),{studentCreate:1,enrollmentCreate:1});
    assert.equal((await readStudentRegistration(db,actor,saved.id)).canEdit,false);
    await assert.rejects(saveStudentRegistration(db,actor,input,requestId,1),/REGISTRATION_SYNC_IN_PROGRESS/);
});
test('학생 생성 응답 유실 후 ID 조회로 복구하며 중복 생성하지 않음',async()=>{
    const {db,rows,remote,saved,deps}=await fixture();remote.setStudentFailure('commit-timeout');
    await assert.rejects(syncStudentRegistration(db,actor,saved.id,1,deps),/TIMEOUT/);
    assert.equal(rows.get('teacherStudentRegistrations/'+saved.id).syncStatus,'uncertain');
    await syncStudentRegistration(db,actor,saved.id,1,deps);
    assert.deepEqual(remote.counts(),{studentCreate:1,enrollmentCreate:1});
});
test('생성 여부를 확인할 수 없으면 재생성하지 않고 결과 불명 상태 유지',async()=>{
    const {db,rows,remote,saved,deps}=await fixture();remote.setStudentFailure('no-commit-timeout');
    await assert.rejects(syncStudentRegistration(db,actor,saved.id,1,deps),/TIMEOUT/);
    await assert.rejects(syncStudentRegistration(db,actor,saved.id,1,deps),/NOTION_REGISTRATION_CREATE_UNCERTAIN/);
    assert.deepEqual(remote.counts(),{studentCreate:1,enrollmentCreate:0});assert.equal(rows.get('teacherStudentRegistrations/'+saved.id).syncStatus,'uncertain');
});
test('학생만 저장된 부분 실패는 학생을 유지하고 수강부터 재시도',async()=>{
    const {db,rows,remote,saved,deps}=await fixture();remote.failEnrollmentOnce();
    await assert.rejects(syncStudentRegistration(db,actor,saved.id,1,deps),/NOTION_400/);
    const record=rows.get('teacherStudentRegistrations/'+saved.id);assert.equal(record.syncStatus,'failed');assert.equal(record.studentSaved,true);assert.equal(record.enrollmentCreateAttempted,false);
    await assert.rejects(saveStudentRegistration(db,actor,{...input,name:'다른 이름'},requestId,1),/REGISTRATION_SYNC_IN_PROGRESS/);
    await syncStudentRegistration(db,actor,saved.id,1,deps);assert.deepEqual(remote.counts(),{studentCreate:1,enrollmentCreate:2});
});
test('동시 반영 요청은 한 실행만 원격 생성',async()=>{
    const {db,remote,saved,deps}=await fixture();let release:()=>void=()=>{};const gate=new Promise<void>(resolve=>{release=resolve;});remote.setCreateGate(gate);
    const first=syncStudentRegistration(db,actor,saved.id,1,deps);
    // Queue a second request after the first has acquired its Firestore lease.
    await new Promise(resolve=>setTimeout(resolve,0));
    await assert.rejects(syncStudentRegistration(db,actor,saved.id,1,deps),/REGISTRATION_SYNC_IN_PROGRESS/);
    release();await first;assert.deepEqual(remote.counts(),{studentCreate:1,enrollmentCreate:1});
});
test('만료된 실행은 생성 시도 표시를 먼저 조회해 안전하게 복구',async()=>{
    const {db,rows,remote,saved,deps}=await fixture();
    const record=rows.get('teacherStudentRegistrations/'+saved.id);Object.assign(record,{syncStatus:'syncing',syncLease:'dead-process',syncLeaseUntil:0,studentCreateAttempted:true});
    remote.pages.set(studentId,{id:studentId,parent:{database_id:studentDB},properties:registrationStudentProperties(saved.id,input as any),last_edited_time:'2026-10-05T00:00:00Z'});
    await syncStudentRegistration(db,actor,saved.id,1,deps);assert.deepEqual(remote.counts(),{studentCreate:0,enrollmentCreate:1});
});
test('원격 수동 변경을 덮어쓰지 않고 기존 계정·리포트 ID 유지',async()=>{
    const {db,rows,remote,saved,deps}=await fixture();
    remote.setStudentFailure('commit-timeout');await assert.rejects(syncStudentRegistration(db,actor,saved.id,1,deps));
    remote.pages.get(studentId).properties['학생']={title:[{text:{content:'노션에서 수정한 이름'}}]};
    const internalStudentId=generateInternalStudentId(studentId),mappingKey=hashStudentKey(studentId);
    rows.set('notionStudentMappings/'+mappingKey,{studentKey:studentId,notionStudentPageId:studentId,studentDisplayName:'기존 이름',internalStudentId,firebaseUid:'existing-user',createdAt:'old',updatedAt:'old'});
    rows.set('users/existing-user',{notionStudentKey:studentId});
    rows.set('reportSlugs/existing-slug',{internalStudentId,parentPhonePinHash:'existing-pin-hash',authVersion:7,active:true});
    rows.set('studentReportMappings/'+internalStudentId,{activeReportSlug:'existing-slug'});
    await syncStudentRegistration(db,actor,saved.id,1,deps);
    assert.equal(rows.get('notionStudentMappings/'+mappingKey).firebaseUid,'existing-user');assert.equal(rows.get('notionStudentMappings/'+mappingKey).internalStudentId,internalStudentId);
    assert.equal(rows.get('reportSlugs/existing-slug').authVersion,7);assert.equal(rows.get('reportSlugs/existing-slug').parentPhonePinHash,'existing-pin-hash');
    assert.equal(rows.get('studentReportMappings/'+internalStudentId).activeReportSlug,'existing-slug');
    assert.equal(rows.get('notionStudentMappings/'+mappingKey).studentDisplayName,'노션에서 수정한 이름');
    assert.equal(remote.requests.some(request=>request.method==='PATCH'),false);
});
test('다른 학원 또는 원본 불일치·스키마 변경 시 생성/연결 중단',async()=>{
    const {db,rows,remote,saved,deps}=await fixture();
    await assert.rejects(syncStudentRegistration(db,{...actor,academyId:'other'},saved.id,1,deps),/NOTION_REGISTRATION_SOURCE_REQUIRED/);
    remote.schemas[studentDB].properties['학교'].type='number';await assert.rejects(syncStudentRegistration(db,actor,saved.id,1,deps),/NOTION_REGISTRATION_SCHEMA_REQUIRED/);assert.equal(remote.requests.some(request=>request.path==='pages'),false);
    remote.schemas[studentDB].properties['학교'].type='rich_text';
    remote.pages.set(studentId,{id:studentId,parent:{database_id:'other'},properties:registrationStudentProperties(saved.id,input as any)});
    rows.get('teacherStudentRegistrations/'+saved.id).notionStudentPageId=studentId;
    await assert.rejects(syncStudentRegistration(db,actor,saved.id,1,deps),/NOTION_REGISTRATION_ID_MISMATCH/);
    assert.equal(rows.has('academyStudentMemberships/'+studentId),false);
});
test('수강 학생 관계형 불일치나 타학원 소속을 덮어쓰지 않음',async()=>{
    const {db,rows,remote,saved,deps}=await fixture();
    remote.pages.set(studentId,{id:studentId,parent:{database_id:studentDB},properties:registrationStudentProperties(saved.id,input as any),last_edited_time:'2026-10-05T00:00:00Z'});
    remote.pages.set(enrollmentId,{id:enrollmentId,parent:{database_id:enrollmentDB},properties:registrationEnrollmentProperties(saved.id,input as any,requestId),last_edited_time:'2026-10-05T00:00:00Z'});
    await assert.rejects(syncStudentRegistration(db,actor,saved.id,1,deps),/NOTION_REGISTRATION_ID_MISMATCH/);
    remote.pages.get(enrollmentId).properties['학생']={relation:[{id:studentId}]};
    rows.set('academyStudentMemberships/'+studentId,{academyId:'other',disabled:false});
    await assert.rejects(syncStudentRegistration(db,actor,saved.id,1,deps),/ACADEMY_MEMBERSHIP_CONFLICT/);
    assert.equal(rows.get('academyStudentMemberships/'+studentId).academyId,'other');assert.equal(rows.has('notionStudentMappings/'+hashStudentKey(studentId)),false);
});
test('생성 HTTP 호출은 429 및 5xx를 자동 재전송하지 않음',async()=>{
    const original=globalThis.fetch,token=process.env.NOTION_INTEGRATION_TOKEN;process.env.NOTION_INTEGRATION_TOKEN='test';
    try {for(const status of [429,503]){let count=0;globalThis.fetch=async()=>{count++;return new Response('{}',{status});};await assert.rejects(registrationNotion('pages','POST',{}));assert.equal(count,1);}}
    finally {globalThis.fetch=original;if(token===undefined)delete process.env.NOTION_INTEGRATION_TOKEN;else process.env.NOTION_INTEGRATION_TOKEN=token;}
});

test('중복 앱 등록 ID는 자동 선택하거나 학생을 새로 만들지 않음',async()=>{
    const {db,rows,remote,saved,deps}=await fixture();
    for(const id of [studentId,requestId])remote.pages.set(id,{id,parent:{database_id:studentDB},properties:registrationStudentProperties(saved.id,input as any),last_edited_time:'2026-10-05T00:00:00Z'});
    await assert.rejects(syncStudentRegistration(db,actor,saved.id,1,deps),/NOTION_REGISTRATION_DUPLICATE/);
    assert.deepEqual(remote.counts(),{studentCreate:0,enrollmentCreate:0});assert.equal(rows.has('academyStudentMemberships/'+studentId),false);
});
test('기존 학원 계정 접근과 revision 검사를 먼저 수행',async()=>{
    const {db,remote,saved,deps}=await fixture();
    await assert.rejects(syncStudentRegistration(db,{...actor,principal:false},saved.id,1,deps),/FORBIDDEN/);
    await assert.rejects(syncStudentRegistration(db,actor,saved.id,2,deps),/REGISTRATION_CONFLICT/);
    const original=process.env.NOTION_STUDENT_DATABASE_ID;delete process.env.NOTION_STUDENT_DATABASE_ID;
    try { await assert.rejects(syncStudentRegistration(db,actor,saved.id,1,deps),/NOTION_REGISTRATION_SOURCE_REQUIRED/); } finally {process.env.NOTION_STUDENT_DATABASE_ID=original;}
    assert.equal(remote.requests.length,0);
});

test('실제 workspace 반영 액션 후 앱 명부 조회에서 신규 학생과 수강 상태 표시',async()=>{
    const {db,remote,saved}=await fixture();const original=globalThis.fetch,token=process.env.NOTION_INTEGRATION_TOKEN;
    process.env.NOTION_INTEGRATION_TOKEN='test';
    globalThis.fetch=async(url:any,init:any)=>new Response(JSON.stringify(await remote.notion(String(url).split('/v1/')[1],init?.method || 'GET',init?.body?JSON.parse(init.body):undefined)));
    async function route(req:any,profile:any) {
        let data:any;const response:any={setHeader:()=>{},end:(value:string)=>{data=JSON.parse(value);}};
        await handleWorkspace(req,response,async()=>({...profile,db}) as any);return {status:response.statusCode,data};
    }
    try {
        const synced=await route({method:'POST',body:{action:'sync-student-registration',id:saved.id,revision:1}},actor);
        assert.equal(synced.status,200);assert.equal(synced.data.syncStatus,'synced');
        const profile={...actor,scopes:[{studentKey:studentId,subject:'영어'},{studentKey:studentId,subject:'수학'}],teachingScopes:[]};
        const result=await route({method:'GET',url:'/api/teacher/workspace?action=bootstrap-fast&section=students'},profile);
        assert.equal(result.status,200);assert.equal(result.data.students.length,1);assert.equal(result.data.students[0].studentKey,studentId);assert.equal(result.data.students[0].linkedFirebaseUid,null);
        assert.deepEqual(result.data.students[0].subjects.map((entry:any)=>[entry.subject,entry.status]),[['영어','등록'],['수학','대기']]);
        assert.equal(JSON.stringify(result.data).includes(input.guardianPhone),false);
        const forbidden=await route({method:'POST',body:{action:'sync-student-registration',id:saved.id,revision:1}},{...actor,principal:false});assert.equal(forbidden.status,403);
    } finally {globalThis.fetch=original;if(token===undefined)delete process.env.NOTION_INTEGRATION_TOKEN;else process.env.NOTION_INTEGRATION_TOKEN=token;}
});

test('앱 등록 ID가 다른 수강 행이 이미 학생과 연결되면 중복 수강 행을 만들지 않음',async()=>{
    const {db,rows,remote,saved,deps}=await fixture();
    remote.pages.set(studentId,{id:studentId,parent:{database_id:studentDB},properties:registrationStudentProperties(saved.id,input as any),last_edited_time:'2026-10-05T00:00:00Z'});
    remote.pages.set(enrollmentId,{id:enrollmentId,parent:{database_id:enrollmentDB},properties:registrationEnrollmentProperties('different-registration',input as any,studentId),last_edited_time:'2026-10-05T00:00:00Z'});
    await assert.rejects(syncStudentRegistration(db,actor,saved.id,1,deps),/NOTION_DUPLICATE_ENROLLMENT/);
    assert.deepEqual(remote.counts(),{studentCreate:0,enrollmentCreate:0});assert.equal(rows.has('academyStudentMemberships/'+studentId),false);
});

const assignmentTeacherId='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',assignmentClassId='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const classDB='1a554024-20f2-42c5-8837-983bd1a4f61e',teacherDB='3d274aff-32ce-4a33-870d-2689259113a6';
async function assignedFixture() {
    const f=await fixture();
    f.rows.set('teacherWorkspaceAccess/teacher',{academyId:'main',notionTeacherPageId:assignmentTeacherId});
    f.rows.set('users/teacher',{role:'teacher'});
    f.remote.pages.set(assignmentTeacherId,{id:assignmentTeacherId,parent:{database_id:teacherDB},properties:{상태:{select:{name:'재직'}},'담당 과목':{multi_select:[{name:'영어'}]}}});
    f.remote.pages.set(assignmentClassId,{id:assignmentClassId,parent:{database_id:classDB},properties:{학원:{rich_text:[{text:{content:'main'}}]},상태:{status:{name:'진행 중'}},과목:{select:{name:'영어'}},'담당 선생님':{relation:[{id:assignmentTeacherId}]},'대상 학생':{relation:[{id:'cccccccc-cccc-4ccc-8ccc-cccccccccccc'}]}}});
    f.remote.schemas[studentDB].properties['소속반']={id:'student-class',type:'relation',relation:{database_id:classDB,type:'dual_property',dual_property:{synced_property_id:'class-student'}}};
    f.remote.schemas[enrollmentDB].properties['영어 담당']={type:'relation',relation:{database_id:teacherDB}};
    f.remote.schemas[classDB]={properties:{'대상 학생':{id:'class-student',type:'relation',relation:{database_id:studentDB,type:'dual_property',dual_property:{synced_property_id:'student-class'}}}}};
    const saved=await saveStudentRegistration(f.db,actor,{...input,enrollments:[{...input.enrollments[0],teacherUid:'teacher',classIds:[assignmentClassId]}]},requestId,1);
    return {...f,saved};
}
test('담당·반 배정은 수강 관계형과 학생 소속반만 기록하고 공동 반 명단을 PATCH하지 않음',async()=>{
    const f=await assignedFixture();
    await syncStudentRegistration(f.db,actor,f.saved.id,2,f.deps);
    assert.deepEqual(f.remote.pages.get(studentId).properties['소속반'].relation,[{id:assignmentClassId}]);
    assert.deepEqual(f.remote.pages.get(enrollmentId).properties['영어 담당'].relation,[{id:assignmentTeacherId}]);
    assert.equal(f.remote.requests.some(r=>r.method==='PATCH'),false);
    assert.equal(f.rows.get('teacherStudentRegistrations/'+f.saved.id).syncStatus,'synced');
    await syncStudentRegistration(f.db,actor,f.saved.id,2,f.deps);assert.deepEqual(f.remote.counts(),{studentCreate:1,enrollmentCreate:1});
});
test('학생 소속반이 반 대상 학생의 양방향 속성이 아니면 생성 전에 중단',async()=>{
    const f=await assignedFixture();f.remote.schemas[studentDB].properties['소속반'].relation.dual_property.synced_property_id='different-relation';
    await assert.rejects(syncStudentRegistration(f.db,actor,f.saved.id,2,f.deps),/NOTION_REGISTRATION_SCHEMA_REQUIRED/);
    assert.deepEqual(f.remote.counts(),{studentCreate:0,enrollmentCreate:0});
});
test('수강 저장 부분 실패 중 담당 계정의 노션 연결이 바뀌면 임의 재배정 없이 중단',async()=>{
    const f=await assignedFixture();f.remote.failEnrollmentOnce();
    await assert.rejects(syncStudentRegistration(f.db,actor,f.saved.id,2,f.deps),/NOTION_400/);
    const other='dddddddd-dddd-4ddd-8ddd-dddddddddddd';
    f.rows.set('teacherWorkspaceAccess/teacher',{academyId:'main',notionTeacherPageId:other});
    f.remote.pages.set(other,{id:other,parent:{database_id:teacherDB},properties:{상태:{select:{name:'재직'}},'담당 과목':{multi_select:[{name:'영어'}]}}});
    await assert.rejects(syncStudentRegistration(f.db,actor,f.saved.id,2,f.deps),/NOTION_REGISTRATION_ASSIGNMENT_REQUIRED/);
    assert.deepEqual(f.remote.counts(),{studentCreate:1,enrollmentCreate:1});
});
test('입학 상담 본문을 학생 최초 생성에 함께 저장하고 응답 유실에도 복제하지 않음',async()=>{
 const {emptyAdmission}=await import('../src/lib/studentAdmission.js');const {db,rows,remote,saved,deps}=await fixture();
 const admission=emptyAdmission();admission.address='테스트 주소';admission.goal='진단 후 목표';admission.levels[1].schoolScore=0;
 rows.get('teacherStudentRegistrations/'+saved.id).data.admission=admission;
 remote.setStudentFailure('commit-timeout');await assert.rejects(syncStudentRegistration(db,actor,saved.id,1,deps));
 const creation=remote.requests.find(r=>r.path==='pages'&&r.body.parent.database_id===studentDB);assert.ok(creation.body.children.length);assert.match(JSON.stringify(creation.body.children),/테스트 주소/);assert.match(JSON.stringify(creation.body.children),/내신 점수: 0/);
 await syncStudentRegistration(db,actor,saved.id,1,deps);assert.deepEqual(remote.counts(),{studentCreate:1,enrollmentCreate:1});assert.equal(remote.requests.some(r=>r.method==='PATCH'),false);
});

test('상담 원서의 구조화 속성은 최초 학생 생성과 응답 유실 복구에 함께 보존됨',async()=>{
 const f=await fixture();const {emptyAdmission}=await import('../src/lib/studentAdmission.js');const admission=emptyAdmission();admission.birthDate='2010-01-02';admission.notes='상담 기록';admission.availableDays=['월','목'];admission.levels[1].schoolScore=0;admission.consent='동의';admission.signedPaper=true;
 const row=f.rows.get('teacherStudentRegistrations/'+f.saved.id);row.data.admission=admission;f.remote.setStudentFailure('commit-timeout');
 await assert.rejects(syncStudentRegistration(f.db,actor,f.saved.id,1,f.deps),/TIMEOUT/);await syncStudentRegistration(f.db,actor,f.saved.id,1,f.deps);
 const props=f.remote.pages.get(studentId).properties;assert.equal(props['생년월일'].date.start,admission.birthDate);assert.equal(props['영어 입학 내신 점수'].number,0);assert.equal(props['국어 입학 내신 점수'].number,null);assert.equal(props['상담 참고 사항'].rich_text[0].text.content,admission.notes);assert.equal(props['서명 원서 보관'].checkbox,true);assert.deepEqual(f.remote.counts(),{studentCreate:1,enrollmentCreate:1});assert.ok(!f.remote.requests.some(r=>r.method==='PATCH'));
});
test('상담 속성 형식이 잘못되면 학생 생성 전에 중단하며 자세한 실패 원인을 보존함',async()=>{
 const f=await fixture();f.remote.schemas[studentDB].properties['생년월일'].type='rich_text';
 await assert.rejects(syncStudentRegistration(f.db,actor,f.saved.id,1,f.deps),/NOTION_ADMISSION_SCHEMA_REQUIRED/);assert.deepEqual(f.remote.counts(),{studentCreate:0,enrollmentCreate:0});assert.equal(f.rows.get('teacherStudentRegistrations/'+f.saved.id).syncError,'NOTION_ADMISSION_SCHEMA_REQUIRED');
});
