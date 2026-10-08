import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import MessageTemplateManager,{MessageTemplateEditor} from '../src/components/teacher/MessageTemplateManager';
import WorkspaceSyncPanel from '../src/components/teacher/WorkspaceSyncPanel';
const record={id:'id',title:'안내',body:'{{학생 호칭}} 본문',target:'보호자',archived:false,revision:2,status:'synced',lastSuccessAt:null,error:null,remote:null,remoteHash:null};
const noop=()=>{};
test('template settings have no mount request, and are shown only for the main academy administrator',()=>{
 let calls=0;const props={data:{admin:true,academyId:'main'},busy:false,request:async()=>{calls++;},refresh:async()=>{},act:noop};
 const html=renderToStaticMarkup(<WorkspaceSyncPanel {...props}/>);assert.ok(html.includes('문자 템플릿 영구 저장'));assert.equal(calls,0);assert.ok(html.includes('aria-expanded="false"'));
 for(const data of [{admin:false,academyId:'main'},{admin:true,academyId:'other'}])assert.ok(!renderToStaticMarkup(<WorkspaceSyncPanel {...props} data={data}/>).includes('문자 템플릿 영구 저장'));
});
test('pending/failed/conflict editor preserves values and distinguishes app save from Notion sync without a send button',()=>{
 for(const status of ['pending','failed','conflict']){const r={...record,status,remote:status==='conflict'?{title:'외부',body:'외부 본문',archived:false}:null};const html=renderToStaticMarkup(<MessageTemplateEditor record={r} busy={false} onSave={noop} onRetry={noop} onResolve={noop}/>);
 assert.ok(html.includes('{{학생 호칭}} 본문'));assert.equal(/<input[^>]*disabled/.test(html),status==='conflict');assert.ok(html.includes('실제 문자는 발송하지 않습니다.'));if(status==='failed')assert.ok(html.includes('동기화 다시 시도'));if(status==='conflict')assert.ok(html.includes('Notion 내용 가져오기'));}
});
test('collapsed pilot controls remain mounted and expose explicit dry-run/import rather than automatic sync',()=>{
 const html=renderToStaticMarkup(<MessageTemplateManager busy={false} request={async()=>({})} act={noop}/>);assert.match(html,/<div hidden/);assert.ok(html.includes('이전 대상 dry-run'));assert.ok(html.includes('원본 상태 점검'));assert.ok(!html.includes('send-message'));
});
