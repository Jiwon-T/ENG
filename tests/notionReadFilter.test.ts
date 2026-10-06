import test from 'node:test';import assert from 'node:assert/strict';
import {notionReadFilter} from '../api/_lib/notionReadFilter.js';
import {matchesNotionFilter} from '../api/_lib/teacherNotionMirror.js';
import {readSourceLessons,readSourceSchedules,DEFAULT_SOURCE,rowSource} from '../api/_lib/teacherNotionWorkspace.js';
import {registrationFirestore} from './helpers/registrationFirestore.js';
import {teacherReadCache} from '../api/_lib/teacherReadCache.js';
const scheduleDB='3430f1a4-9dde-4b4c-a5cf-0d11b913b38c',student='22222222-2222-4222-8222-222222222222',teacher='3ec0d0f1-c79a-8108-b714-c1d6fc390ba2',pageId='11111111-1111-4111-8111-111111111111';
test('missing schema properties preserve legacy empty predicates without invalid Notion query targets',()=>{
 const properties={'과목':{type:'select'},'학생':{type:'relation'}};
 const filter={and:[{or:[{property:'학원',rich_text:{equals:'main'}},{and:[{property:'학원',rich_text:{is_empty:true}},{property:'과목',select:{equals:'영어'}}]}]},{property:'학생',relation:{is_not_empty:true}}]};
 assert.deepEqual(notionReadFilter(filter,properties),{and:[{property:'과목',select:{equals:'영어'}},{property:'학생',relation:{is_not_empty:true}}]});
 assert.equal(notionReadFilter({property:'학원',rich_text:{equals:'other'}},properties),false);
 assert.equal(notionReadFilter({property:'학원',rich_text:{is_empty:true}},properties),true);
 assert.equal(notionReadFilter({and:[{property:'학원',rich_text:{equals:'main'}},{property:'학생',relation:{is_not_empty:true}}]},properties),false);
});
test('schema adaptation respects real status/title types and mirrored matching',()=>{
 const filter=notionReadFilter({property:'상태',select:{equals:'진행 중'}},{'상태':{type:'status'}});assert.deepEqual(filter,{property:'상태',status:{equals:'진행 중'}});assert.equal(matchesNotionFilter({properties:{'상태':{status:{name:'진행 중'}}}},filter),true);
 const relation={property:'학생',relation:{is_not_empty:true}};assert.equal(matchesNotionFilter({properties:{학생:{relation:[]}}},relation),false);assert.equal(matchesNotionFilter({properties:{학생:{relation:[{id:student}]}}},relation),true);
 assert.throws(()=>notionReadFilter({property:'과목',select:{equals:'영어'}},{'과목':{type:'number'}}),/NOTION_READ_SCHEMA_MISMATCH/);
});
test('live legacy lesson/schedule schemas without academy field query successfully and retain original identity',async()=>{
 const f=registrationFirestore(),original=globalThis.fetch,token=process.env.NOTION_INTEGRATION_TOKEN,admin=process.env.ADMIN_UID;process.env.NOTION_INTEGRATION_TOKEN='test';process.env.ADMIN_UID='teacher';teacherReadCache.clear();
 f.rows.set('academyNotionConfig/main',{...DEFAULT_SOURCE,mode:'shared'});f.rows.set('teacherWorkspaceAccess/teacher',{academyId:'main',notionTeacherPageId:teacher});
 const actor:any={uid:'teacher',admin:false,academyId:'main',scopes:[{studentKey:student,subject:'영어'}],teachingScopes:[{studentKey:student,subject:'영어'}]};
 const schemas:any={[DEFAULT_SOURCE.lessonDatabaseId]:{properties:{'과목':{type:'select'},'학생':{type:'relation'}}},[scheduleDB]:{properties:{'과목':{type:'select'},'대상 학생':{type:'relation'},'날짜 및 시간':{type:'date'}}}};
 const pages:any={[DEFAULT_SOURCE.lessonDatabaseId]:{id:pageId,parent:{database_id:DEFAULT_SOURCE.lessonDatabaseId},last_edited_time:'2026-10-06T00:00:00Z',properties:{학생:{relation:[{id:student}]},과목:{select:{name:'영어'}},'수업 날짜':{date:{start:'2026-10-06'}}}},[scheduleDB]:{id:pageId,parent:{database_id:scheduleDB},last_edited_time:'2026-10-06T00:00:00Z',properties:{'담당 선생님':{relation:[{id:teacher}]},'대상 학생':{relation:[{id:student}]},과목:{select:{name:'영어'}},'날짜 및 시간':{date:{start:'2026-10-06T14:00:00+09:00',end:'2026-10-06T15:00:00+09:00'}},일정명:{title:[{plain_text:'기존 일정'}]}}}};
 let schemasRead=0,lessonQuery:any;
 globalThis.fetch=(async(url,options)=>{const path=String(url).replace('https://api.notion.com/v1/',''),database=path.split('/')[1];if(options?.method==='POST'){const query=JSON.parse(String(options.body));assert.ok(!JSON.stringify(query).includes('학원'));if(database===DEFAULT_SOURCE.lessonDatabaseId)lessonQuery=query;return new Response(JSON.stringify({results:[pages[database]],has_more:false}));}schemasRead++;return new Response(JSON.stringify(schemas[database]));}) as typeof fetch;
 try{const lessons=await readSourceLessons(f.db,actor),schedules=await readSourceSchedules(f.db,actor,{from:'2026-10-06',to:'2026-10-06'});assert.equal(lessons[0].notionPageId,pageId);assert.equal(schedules[0].ownerUid,'teacher');assert.equal(schedules[0].notionPageId,pageId);assert.match(JSON.stringify(lessonQuery),/is_not_empty/);await readSourceLessons(f.db,actor);assert.equal(schemasRead,2);actor.scopes=[];assert.equal((await readSourceLessons(f.db,actor)).length,0);assert.equal((await readSourceSchedules(f.db,actor)).length,0);}finally{globalThis.fetch=original;teacherReadCache.clear();if(token===undefined)delete process.env.NOTION_INTEGRATION_TOKEN;else process.env.NOTION_INTEGRATION_TOKEN=token;if(admin===undefined)delete process.env.ADMIN_UID;else process.env.ADMIN_UID=admin;}
});
test('legacy schedule access cannot infer owners or cross academy boundaries',async()=>{
 const page={properties:{과목:{select:{name:'영어'}},'담당 선생님':{relation:[{id:teacher},{id:student}]}}},source={shared:true,legacySchedule:true,academyId:'main',profiles:[{uid:'t',notionTeacherPageId:teacher},{uid:'other',notionTeacherPageId:student}]};
 const row=await rowSource(page,source,{uid:'t',academyId:'main'});assert.equal(row.ownerUid,'__unlinked_author__');assert.equal(await rowSource(page,source,{uid:'outsider',academyId:'main'}),null);assert.equal(await rowSource(page,source,{uid:'t',academyId:'other'}),null);assert.equal(await rowSource(page,{...source,academyId:'other'},{uid:'t',academyId:'other'}),null);
});
