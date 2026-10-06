import test from 'node:test';import assert from 'node:assert/strict';
import {batiConfig,batiRequest,batiAccepted,batiReadiness} from '../api/_lib/batiTransport.js';
const keys=['BATI_WEBHOOK_URL','BATI_MESSAGE_PARAM','BATI_RECIPIENT_PARAM','BATI_WEBHOOK_METHOD','BATI_PAYLOAD_MODE','BATI_RESPONSE_RULE','BATI_SECURITY_HEADER_NAME','BATI_SECURITY_HEADER_VALUE'];
async function fixture(run:()=>Promise<void>|void){const before=new Map(keys.map(key=>[key,process.env[key]]));Object.assign(process.env,{BATI_WEBHOOK_URL:'https://app.bati.ai/webhook/mock_only',BATI_MESSAGE_PARAM:'내용',BATI_RECIPIENT_PARAM:'보호자연락처',BATI_WEBHOOK_METHOD:'GET',BATI_PAYLOAD_MODE:'body-only',BATI_RESPONSE_RULE:JSON.stringify({kind:'json',status:200,path:['result','accepted'],equals:true}),BATI_SECURITY_HEADER_NAME:'',BATI_SECURITY_HEADER_VALUE:''});try{await run();}finally{for(const [key,value]of before)value===undefined?delete process.env[key]:process.env[key]=value;}}
test('unconfirmed response/recipient/method/payload contracts block configuration',async()=>fixture(()=>{
 for(const key of ['BATI_RESPONSE_RULE','BATI_RECIPIENT_PARAM','BATI_WEBHOOK_METHOD','BATI_PAYLOAD_MODE']){const saved=process.env[key];delete process.env[key];assert.throws(batiConfig,/MESSAGE_CONFIG_REQUIRED/);assert.equal(batiReadiness().configured,false);process.env[key]=saved;}
 process.env.BATI_RECIPIENT_PARAM='내용';assert.throws(batiConfig,/MESSAGE_CONFIG_REQUIRED/);
}));
test('GET encoding preserves Korean, multiline, literal ampersand/plus/percent and leading zero phone',async()=>fixture(()=>{
 const body='학생 & 보호자 + 100%\n안녕하세요 😀',request=batiRequest(batiConfig(),'01000000000',body);assert.equal(request.url.searchParams.get('내용'),body);assert.equal(request.url.searchParams.get('보호자연락처'),'01000000000');assert.equal(request.options.redirect,'manual');assert.equal(request.options.method,'GET');assert.equal(request.url.searchParams.size,2);
}));
test('legacy mode supplies all 12 formula keys with immutable context and no key overwrite',async()=>fixture(()=>{
 process.env.BATI_PAYLOAD_MODE='legacy-student';const names=['메시지템플릿선택','학생 호칭','강의명','수강료','납부기한','등록상태','수강시작일','학년','학생연락처','보호자이름'],context=Object.fromEntries(names.map(key=>[key,key==='수강료'?'0':'모의 값']));
 const request=batiRequest(batiConfig(),'01000000000','확인한 본문',{...context,내용:'덮어쓰기 시도'});assert.equal(request.url.searchParams.size,12);assert.equal(request.url.searchParams.get('내용'),'확인한 본문');assert.equal(request.url.searchParams.get('수강료'),'0');assert.throws(()=>batiRequest(batiConfig(),'01000000000','본문'),/MESSAGE_CONTEXT_REQUIRED/);
}));
test('explicit POST JSON and security header remain server-only and redirect-safe',async()=>fixture(()=>{
 process.env.BATI_WEBHOOK_METHOD='POST_JSON';process.env.BATI_SECURITY_HEADER_NAME='X-Bati-Key';process.env.BATI_SECURITY_HEADER_VALUE='mock-secret';const request=batiRequest(batiConfig(),'01000000000','문자\n본문');assert.equal(request.url.search,'');assert.deepEqual(JSON.parse(request.options.body!),{'보호자연락처':'01000000000','내용':'문자\n본문'});assert.equal(request.options.headers['X-Bati-Key'],'mock-secret');assert.equal(request.options.redirect,'manual');process.env.BATI_SECURITY_HEADER_VALUE='invalid\nvalue';assert.throws(batiConfig,/MESSAGE_CONFIG_REQUIRED/);
}));
test('exact JSON acceptance rejects HTML, negative 2xx, wrong status and malformed response',async()=>fixture(async()=>{
 const rule=batiConfig().response;assert.equal(await batiAccepted(new Response(JSON.stringify({result:{accepted:true}}),{status:200}),rule),true);
 for(const response of [new Response('<html>실패</html>',{status:200}),new Response(JSON.stringify({result:{accepted:false}}),{status:200}),new Response(JSON.stringify({result:{accepted:true}}),{status:201}),new Response('not json',{status:200}),new Response('{}',{status:500})])assert.equal(await batiAccepted(response,rule),false);
}));
test('text and status rules require explicitly configured exact results; redirects never mean accepted',async()=>fixture(async()=>{
 process.env.BATI_RESPONSE_RULE=JSON.stringify({kind:'text',status:200,equals:'accepted'});assert.equal(await batiAccepted(new Response('accepted',{status:200}),batiConfig().response),true);assert.equal(await batiAccepted(new Response('accepted ',{status:200}),batiConfig().response),false);
 process.env.BATI_RESPONSE_RULE=JSON.stringify({kind:'status',status:202});assert.equal(await batiAccepted(new Response(null,{status:202}),batiConfig().response),true);assert.equal(await batiAccepted(new Response(null,{status:200}),batiConfig().response),false);assert.equal(await batiAccepted(new Response(null,{status:302}),batiConfig().response),false);
}));
