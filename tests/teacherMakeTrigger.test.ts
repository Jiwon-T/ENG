import test from 'node:test';
import assert from 'node:assert/strict';
import {teacherMakeTrigger} from '../api/_lib/teacherMakeTrigger.ts';
import {publishTeacherDraft} from '../api/_lib/teacherNotionPublish.ts';
test('trusted transmission properties accept regional Make links and rich text hyperlinks',()=>{
 assert.equal(teacherMakeTrigger({properties:{전송하기:{formula:{string:'전송 https://hook.eu1.make.com/abc123?pageId=page'}}}}),'https://hook.eu1.make.com/abc123?pageId=page');
 assert.equal(teacherMakeTrigger({properties:{전송:{url:'https://hook.us2.make.com/abc123?id=page'}}}),'https://hook.us2.make.com/abc123?id=page');
 assert.equal(teacherMakeTrigger({properties:{'반영 요청':{rich_text:[{text:{link:{url:'https://hook.eu2.make.com/abc123'}}}]}}}),'https://hook.eu2.make.com/abc123');
 for(const url of ['https://evil.test/abc','https://hook.eu1.make.com.evil.test/abc','https://hook.eu1.make.com/abc/extra'])assert.equal(teacherMakeTrigger({properties:{전송하기:{url}}}),null);
 assert.equal(teacherMakeTrigger({properties:{'수업 내용':{url:'https://hook.eu1.make.com/abc'}}}),null);
});
test('saved Notion revision retries only Make trigger without writing another page',async()=>{
 const previousFetch=globalThis.fetch,token=process.env.NOTION_INTEGRATION_TOKEN,calls:string[]=[],updates:any[]=[];
 process.env.NOTION_INTEGRATION_TOKEN='test';
 globalThis.fetch=async(input:any,options:any)=>{calls.push(String(input));assert.ok(!options?.method||options.method==='GET');return new Response(JSON.stringify(String(input).includes('notion.com')?{properties:{전송:{url:'https://hook.us1.make.com/abc123?id=page'}}}:{}),{status:200});};
 const db:any={collection:()=>({doc:()=>({update:async(p:any)=>updates.push(p)})})};
 try{const page=await publishTeacherDraft(db,'draft',{stage:'reflection_pending',notionPageId:'page',revision:2,notionSavedRevision:2});assert.equal(page,'page');assert.equal(calls.length,2);assert.equal(updates[0].stage,'processing');assert.equal(updates[0].lastSubmittedRevision,2);}finally{globalThis.fetch=previousFetch;if(token===undefined)delete process.env.NOTION_INTEGRATION_TOKEN;else process.env.NOTION_INTEGRATION_TOKEN=token;}
});
