import test from 'node:test';
import assert from 'node:assert/strict';
import {templateFirestore} from './helpers/templateFirestore.js';
import {cleanAiRequest,takeAiQuota,handleGemini,AI_DAILY_LIMIT} from '../api/gemini.js';

const call=async(body:any,headers:any,deps:any)=>{let status=0,out:any;const req:any={method:'POST',headers,body};
 const res:any={setHeader(){},end(v:string){out=JSON.parse(v);},set statusCode(v:number){status=v;},get statusCode(){return status;}};await handleGemini(req,res,deps);return {status,out};};
test('AI proxy keeps only text turns and plain settings; the model and output size are not the browser\'s choice',()=>{
 const r:any=cleanAiRequest({model:'gemini-ultra',contents:[{role:'user',parts:[{text:'안녕'},{inlineData:{x:1}}]}],config:{maxOutputTokens:99999,tools:[{x:1}],systemInstruction:'너는 펫',responseMimeType:'application/json',temperature:0.5}});
 assert.deepEqual(r.contents,[{role:'user',parts:[{text:'안녕'}]}]);assert.equal(r.config.maxOutputTokens,8192);assert.equal(r.config.tools,undefined);assert.equal(r.model,undefined);
 assert.equal(r.config.systemInstruction,'너는 펫');assert.equal(r.config.temperature,0.5);
 assert.equal(cleanAiRequest({contents:[]}),null);assert.equal(cleanAiRequest({contents:[{role:'user',parts:[{text:'x'.repeat(20001)}]}]}),null,'too long');
});
test('AI proxy: login required, a daily limit per account, the admin unlimited, no prompt in the logs',async()=>{
 const f=templateFirestore(),deps:any={verify:async(t:string)=>{if(t!=='good'&&t!=='admin')throw Error('bad');return {uid:t==='admin'?'admin':'kid'};},db:()=>f.db,generate:async()=>'{"response":"냥"}',adminUid:'admin'};
 const body={contents:[{role:'user',parts:[{text:'안녕'}]}]};
 assert.equal((await call(body,{},deps)).status,401);assert.equal((await call(body,{authorization:'Bearer nope'},deps)).status,401);
 const ok=await call(body,{authorization:'Bearer good'},deps);assert.equal(ok.status,200);assert.equal(ok.out.text,'{"response":"냥"}');
 for(let i=1;i<AI_DAILY_LIMIT;i++)assert.equal(await takeAiQuota(f.db,'kid'),true);
 assert.equal((await call(body,{authorization:'Bearer good'},deps)).status,429,'limit reached');
 assert.equal((await call(body,{authorization:'Bearer admin'},deps)).status,200,'the admin is not limited');
 const busy=await call(body,{authorization:'Bearer admin'},{...deps,generate:async()=>{throw Error('503 high demand: secret prompt')}});assert.equal(busy.status,503);assert.equal(busy.out.error,'AI_BUSY');assert.ok(!JSON.stringify(busy.out).includes('secret'));
});
