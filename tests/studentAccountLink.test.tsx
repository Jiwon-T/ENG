import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import StudentAccountLink from '../src/components/teacher/StudentAccountLink';

test('student detail offers linking for an unlinked student and shows the linked state otherwise',()=>{
 const unlinked=renderToStaticMarkup(<StudentAccountLink studentKey="11111111-1111-4111-8111-111111111111" studentName="류현수 (용죽고1)" linkedUid={null} onChanged={()=>{}}/>);
 assert.match(unlinked,/앱 계정 연결하기/);assert.doesNotMatch(unlinked,/is-linked/);
 const linked=renderToStaticMarkup(<StudentAccountLink studentKey="11111111-1111-4111-8111-111111111111" studentName="김경현 (용죽고1)" linkedUid="u1" onChanged={()=>{}}/>);
 assert.match(linked,/앱 계정 연결됨/);assert.match(linked,/is-linked/);
});
