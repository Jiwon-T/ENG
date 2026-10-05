import test from 'node:test';
import assert from 'node:assert/strict';
import { studentRegistrationSchema, studentRegistrationTitle, saveStudentRegistration, registrationDocumentId } from '../api/_lib/teacherStudentRegistration.js';
const requestId='cb123456-1234-4234-8234-123456789abc';
const actor={uid:'principal',admin:false,principal:true,academyId:'academy-a'};
const input={name:' 홍길동 ',school:'용죽고',grade:'고1',guardianPhone:'010-0000-0000',enrollments:[{subject:'영어',status:'등록',startDate:'2026-10-05'}]};
function memoryDb() {
    const rows=new Map<string,any>();
    let queue=Promise.resolve();
    return {rows,collection:()=>({doc:(id:string)=>({id})}),runTransaction:(fn:any)=>{
        const result=queue.then(async()=>{
            const writes=new Map<string,any>();
            const value=await fn({get:async(ref:any)=>({data:()=>rows.get(ref.id)}),set:(ref:any,data:any)=>writes.set(ref.id,data)});
            for(const [key,data] of writes)rows.set(key,data);
            return value;
        });
        queue=result.then(()=>undefined,()=>undefined);return result;
    }};
}
test('신입생 이름과 연락처 정규화, 과목별 수강 보존',()=>{
    const value=studentRegistrationSchema.parse(input);
    assert.equal(value.name,'홍길동');assert.equal(value.guardianPhone,'01000000000');
    assert.equal(studentRegistrationTitle(value),'홍길동(용죽고 고1)');
    assert.equal(studentRegistrationTitle({...value,school:'',grade:''}),'홍길동');
});
test('중복 과목, 잘못된 날짜와 연락처, 수강일 모순 거절',()=>{
    for(const candidate of [
        {...input,enrollments:[...input.enrollments,...input.enrollments]},
        {...input,enrollments:[{...input.enrollments[0],startDate:'2026-02-30'}]},
        {...input,guardianPhone:'010abc12345678'},
        {...input,enrollments:[{...input.enrollments[0],status:'중단'}]},
        {...input,enrollments:[{...input.enrollments[0],status:'중단',endDate:'2026-10-04'}]},
        {...input,enrollments:[{...input.enrollments[0],endDate:'2026-10-06'}]},
        {...input,academyId:'forged'},
    ])assert.equal(studentRegistrationSchema.safeParse(candidate).success,false);
});
test('동일 등록 요청 중복 저장 방지 및 서로 다른 학원 키 분리',async()=>{
    const db=memoryDb();
    const results=await Promise.all([saveStudentRegistration(db,actor,input,requestId),saveStudentRegistration(db,actor,input,requestId)]);
    assert.equal(db.rows.size,1);assert.equal(results[0].revision,1);assert.equal(results[1].alreadySaved,true);
    assert.notEqual(registrationDocumentId('academy-a',requestId),registrationDocumentId('academy-b',requestId));
    await assert.rejects(saveStudentRegistration(db,actor,{...input,name:'다른 학생'},requestId),/REGISTRATION_REQUEST_CONFLICT/);
});
test('노션 작업 전 입력 수정 및 원격 생성 후 입력 잠금',async()=>{
    const db=memoryDb();const first=await saveStudentRegistration(db,actor,input,requestId);
    const saved=db.rows.get(first.id);saved.syncStatus='failed';
    const updated=await saveStudentRegistration(db,actor,{...input,guardianPhone:'01000000001'},requestId,1);
    assert.equal(updated.revision,2);assert.equal(updated.syncStatus,'pending');
    assert.equal(db.rows.get(first.id).notionStudentPageId,null);
    assert.equal(db.rows.get(first.id).data.guardianPhone,'01000000001');
    await assert.rejects(saveStudentRegistration(db,actor,input,requestId,1),/REGISTRATION_CONFLICT/);
    db.rows.get(first.id).notionStudentPageId='existing-page';db.rows.get(first.id).syncStatus='failed';
    await assert.rejects(saveStudentRegistration(db,actor,input,requestId,2),/REGISTRATION_SYNC_IN_PROGRESS/);
});
test('일반 교사 등록 및 학원 변경 거절',async()=>{
    const db=memoryDb();
    await assert.rejects(saveStudentRegistration(db,{...actor,principal:false},input,requestId),/FORBIDDEN/);
    await assert.rejects(saveStudentRegistration(db,{...actor,academyId:null},input,requestId),/TEACHER_NOT_CONFIGURED/);
    const first=await saveStudentRegistration(db,actor,input,requestId);
    db.rows.get(first.id).academyId='academy-b';
    await assert.rejects(saveStudentRegistration(db,actor,input,requestId,1),/FORBIDDEN/);
    assert.equal(db.rows.size,1);
});
test('데이터 저장 실패는 성공으로 반환하지 않음',async()=>{
    const db={collection:()=>({doc:(id:string)=>({id})}),runTransaction:async()=>{throw new Error('FIRESTORE_UNAVAILABLE');}};
    await assert.rejects(saveStudentRegistration(db,actor,input,requestId),/FIRESTORE_UNAVAILABLE/);
});
