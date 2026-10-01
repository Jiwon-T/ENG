import test from 'node:test';
import assert from 'node:assert/strict';
import { studentDirectoryError } from '../api/_lib/studentDirectoryError.js';

test('Notion status is retained without exposing raw response or secrets', () => {
  assert.equal(studentDirectoryError(new Error('NOTION_QUERY_FAILED: 403')).error, 'NOTION_QUERY_FAILED');
  assert.equal(studentDirectoryError(new Error('NOTION_QUERY_FAILED: 403')).upstreamStatus, 403);
  const privateMessage = 'secret-token private-contact';
  assert.ok(!JSON.stringify(studentDirectoryError(new Error(privateMessage))).includes(privateMessage));
});
test('configuration, mapping conflicts and Firestore failures are distinguished', () => {
  assert.equal(studentDirectoryError(new Error('CONFIG_ERROR: secret')).error, 'SERVER_CONFIG_ERROR');
  assert.equal(studentDirectoryError(new Error('STUDENT_MAPPING_CONFLICT')).error, 'STUDENT_MAPPING_CONFLICT');
  assert.equal(studentDirectoryError(Object.assign(new Error('private'), { code: 9 })).error, 'FIRESTORE_PRECONDITION_FAILED');
  assert.equal(studentDirectoryError(Object.assign(new Error('private'), { code: 7 })).error, 'FIRESTORE_PERMISSION_DENIED');
  assert.equal(studentDirectoryError(null).error, 'SERVER_ERROR');
});
