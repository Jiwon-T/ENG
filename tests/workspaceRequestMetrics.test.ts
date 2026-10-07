import test from 'node:test';import assert from 'node:assert/strict';
import {beginWorkspaceRequest,finishWorkspaceRequest,workspaceRequestMetrics,clearWorkspaceRequestMetrics} from '../src/lib/workspaceRequestMetrics';
test('development metrics keep bounded action-only snapshots and clear on account reset',()=>{
 clearWorkspaceRequestMetrics();const item=beginWorkspaceRequest('save-draft');finishWorkspaceRequest(item,true);
 const snapshot=workspaceRequestMetrics();assert.equal(snapshot[0].action,'save-draft');assert.equal(snapshot[0].ok,true);assert.ok(snapshot[0].elapsed!>=0);
 snapshot[0].action='changed';assert.equal(workspaceRequestMetrics()[0].action,'save-draft');
 assert.deepEqual(Object.keys(snapshot[0]).sort(),['action','elapsed','ok','started']);
 for(let index=0;index<205;index++)beginWorkspaceRequest('read:bootstrap');assert.equal(workspaceRequestMetrics().length,200);
 clearWorkspaceRequestMetrics();assert.deepEqual(workspaceRequestMetrics(),[]);
});
