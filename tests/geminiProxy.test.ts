import test from 'node:test';
import assert from 'node:assert/strict';
import {templateFirestore} from './helpers/templateFirestore.js';
import {cleanAiRequest,takeAiQuota,handleGemini,AI_DAILY_LIMIT} from '../api/gemini.js';

const call=async(body:any,headers:any,deps:any)=>{let status=0,out:any;const req:any={method:'POST',headers,body};
 const res:any={setHeader(){},end(v:string){out=JSON.parse(v);},set statusCode(v:number){status=v;},get statusCode(){return status;}};await handleGemini(req,res,deps);return {status,out};};
test('AI proxy keeps only text turns and plain settings; the model and output size are not the browser\'s choice',()=>{
 const r:any=cleanAiRequest({model:'gemini-ultra',contents:[{role:'user',parts:[{text:'안녕'},{inlineData:{x:1}}]}],config:{maxOutputTokens:99999,tools:[{x:1}],systemInstruction:'너는 펫',responseMimeType:'application/json',temperature:0.5}});
 assert.deepEqual(r.contents,[{role:'user',parts:[{text:'안녕'}]}]);assert.equal(r.config.maxOutputTokens,16384);assert.deepEqual(r.config.thinkingConfig,{thinkingLevel:'LOW'});assert.equal(r.config.tools,undefined);assert.equal(r.model,undefined);
 assert.equal(r.config.systemInstruction,'너는 펫');assert.equal(r.config.temperature,0.5);
 assert.equal((cleanAiRequest({contents:[{role:'user',parts:[{text:'x'}]}],config:{thinkingLevel:'MEDIUM'}}) as any).config.thinkingConfig.thinkingLevel,'MEDIUM','변형문제: more careful');
 assert.equal((cleanAiRequest({contents:[{role:'user',parts:[{text:'x'}]}],config:{thinkingLevel:'HIGH'}}) as any).config.thinkingConfig.thinkingLevel,'LOW','never HIGH');
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

test('AI proxy: 지문 분석기 for everyone with a monthly limit (the admin has none), 변형문제 생성기 for the admin only; thinking streams', async () => {
 const {AI_MONTHLY_LIMITS, readAiMonthly, resetAiMonthly} = await import('../api/_lib/aiModel.js');
 const {registrationFirestore} = await import('./helpers/registrationFirestore.js');
 const f = registrationFirestore(), body = {contents: [{role: 'user', parts: [{text: '분석해 줘'}]}]};
 const deps: any = {verify: async (t: string) => ({uid: t}), db: () => f.db, generate: async () => '{"ok":1}', stream: async (_r: any, _f: any, onThought: (t: string) => void) => { onThought('**지문 읽기** 주제를 찾는 중'); return '{"ok":1}'; }, adminUid: 'admin'};
 const send = async (path: string, token: string) => { let status = 200, raw = ''; const headers: Record<string, string> = {};
   const req: any = {method: 'POST', url: path, headers: {authorization: `Bearer ${token}`}, body};
   const res: any = {setHeader(k: string, v: string) { headers[k] = v; }, write(v: string) { raw += v; }, end(v?: string) { if (v) raw += v; }, set statusCode(v: number) { status = v; }, get statusCode() { return status; }};
   await handleGemini(req, res, deps); return {status, raw, headers}; };
 const gen = await send('/api/gemini?task=generator', 'kid');
 assert.equal(gen.status, 403, 'the generator is still the admin\'s');
 const streamed = await send('/api/gemini?task=analyzer&stream=1', 'kid');
 const lines = streamed.raw.trim().split('\n').map(l => JSON.parse(l));
 assert.deepEqual(lines.map(l => l.t), ['thought', 'done']);
 assert.deepEqual([lines[0].text, lines[1].left], ['**지문 읽기** 주제를 찾는 중', AI_MONTHLY_LIMITS.analyzer - 1]);
 assert.match(streamed.headers['Content-Type'], /ndjson/);
 assert.equal(JSON.parse((await send('/api/gemini?task=generator', 'admin')).raw).left, null, 'the admin: no limit');
 const month = new Intl.DateTimeFormat('en-CA', {timeZone: 'Asia/Seoul'}).format(new Date()).slice(0, 7);
 f.rows.set(`aiMonthly/kid_${month}`, {uid: 'kid', month, analyzer: AI_MONTHLY_LIMITS.analyzer});
 const full = await send('/api/gemini?task=analyzer', 'kid');
 assert.deepEqual([full.status, JSON.parse(full.raw).error], [429, 'AI_MONTHLY_LIMIT']);
 await assert.rejects(() => resetAiMonthly(f.db, {admin: false, academyId: 'main'}, {uid: 'kid'}), /FORBIDDEN/);
 await resetAiMonthly(f.db, {admin: true, academyId: 'main'}, {uid: 'kid'});
 assert.equal((await send('/api/gemini?task=analyzer', 'kid')).status, 200, 'reset by the admin: usable again');
 f.rows.set('users/kid', {name: '김하늘', role: 'student'});
 const list = await readAiMonthly(f.db, {admin: true, academyId: 'main'});
 assert.deepEqual(list.rows.map((r: any) => [r.name, r.analyzer]), [['김하늘', 1]]);
});
