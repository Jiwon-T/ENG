import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {MessageTemplateEditor} from '../src/components/teacher/MessageTemplateManager';
const record={id:'id',title:'안내',body:'{{학생 호칭}} 본문',target:'보호자',archived:false,revision:2,status:'app',error:null};
const noop=()=>{};
test('the template editor keeps values, has a plain save and no send or Notion controls; archived templates are locked',()=>{
 const html=renderToStaticMarkup(<MessageTemplateEditor record={record} busy={false} onSave={noop}/>);
 assert.ok(html.includes('{{학생 호칭}} 본문'));assert.ok(html.includes('실제 문자는 발송하지 않습니다.'));assert.ok(html.includes('>저장<'));
 assert.equal(/Notion|동기화/.test(html),false);assert.equal(/<input[^>]*disabled/.test(html),false);
 assert.ok(/<input[^>]*disabled/.test(renderToStaticMarkup(<MessageTemplateEditor record={{...record,archived:true}} busy={false} onSave={noop}/>)));
});
