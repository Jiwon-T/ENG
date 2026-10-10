import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import LinkCodeDialog from '../src/components/student/LinkCodeDialog';
import Home from '../src/components/Home';
test('학원 연결 is a home button for unlinked students; the dialog shows 8 code boxes and a note for teachers',()=>{
 const dialog=renderToStaticMarkup(<LinkCodeDialog onClose={()=>{}} onLinked={()=>{}}/>);
 assert.match(dialog,/학원 연결하기/);assert.equal((dialog.match(/h-12 w-9/g)||[]).length,8);assert.match(dialog,/선생님은 입력하지 않아도 돼요/);
 const props:any={onNavigate:()=>{},userRole:'student',userEmail:'',hasNewAssignment:false,userUid:'',pendingAssignmentCount:0,onLinked:()=>{}};
 assert.match(renderToStaticMarkup(<Home {...props} studentLinked={false}/>),/학원 연결/);
 assert.doesNotMatch(renderToStaticMarkup(<Home {...props} studentLinked/>),/학원 연결/);
 assert.doesNotMatch(renderToStaticMarkup(<Home {...props} userRole="teacher" studentLinked={false}/>),/학원 연결/);
 assert.doesNotMatch(renderToStaticMarkup(<Home {...props} studentLinked={false}/>),/학원에서 받은 연결 코드가 있나요/,'no card pops up by itself');
});
