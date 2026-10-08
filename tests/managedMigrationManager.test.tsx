import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import ManagedMigrationManager from '../src/components/teacher/ManagedMigrationManager';
test('managed migration is mounted/collapsed with zero automatic fetch and explicit final comparison',()=>{
 let calls=0;const html=renderToStaticMarkup(<ManagedMigrationManager busy={false} request={async()=>{calls++;}} act={()=>{}}/>);assert.equal(calls,0);assert.match(html,/<div hidden/);assert.ok(html.includes('교재 → 반·연결 시간표'));assert.ok(html.includes('반·교재 앱 저장본 확정'));
});
