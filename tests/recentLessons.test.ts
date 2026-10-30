import test from 'node:test';
import assert from 'node:assert/strict';
import {registrationFirestore} from './helpers/registrationFirestore.js';
import {recentLessons} from '../api/_lib/recentLessons.js';
import {appendLessonText} from '../src/components/teacher/RecentLessons.tsx';

const K = '11111111-1111-4111-8111-111111111111';
const me = {uid: 't1', admin: false, academyId: 'main', scopes: [{studentKey: K, subject: '영어'}]};

test('지난 수업: my saved lessons and any teacher’s published ones, the migrated history not taken over; newest first, 3 at most', async () => {
  const f = registrationFirestore();
  f.rows.set('users/t1', {alias: '이지원T'}); f.rows.set('users/t2', {name: '박선생'});
  const draft = (id: string, owner: string, stage: string, data: any, x: any = {}) => f.rows.set(`teacherLessonDrafts/${id}`, {academyId: 'main', ownerUid: owner, stage, data: {studentKey: K, subject: '영어', classSession: '있음', start: '16:00', ...data}, ...x});
  draft('mine', 't1', 'draft', {date: '2026-10-28', content: '어법 2장', assignment: '어법 3장'});
  draft('theirs', 't2', 'published', {date: '2026-10-26', content: '단어 Day 3'});
  draft('theirs-draft', 't2', 'draft', {date: '2026-10-27', content: '아직 반영 안 함'});           // another teacher's, not published
  draft('gone', 't1', 'published', {date: '2026-10-29', content: '삭제'}, {archived: true});
  draft('math', 't1', 'published', {date: '2026-10-29', subject: '수학', content: '수학'});
  draft('later', 't1', 'published', {date: '2026-11-02', content: '다음 주'});                      // after the lesson being written
  draft('now', 't1', 'draft', {date: '2026-10-30', content: '지금 쓰는 일지'});                     // the open one
  draft('linked', 't2', 'published', {date: '2026-10-20', content: '앱에서 고친 내용'}, {notionPageId: 'src-1'});
  const source = (id: string, data: any, x: any = {}) => f.rows.set(`lessonSourceRecords/${id}`, {academyId: 'main', studentKey: K, subject: '영어', sourceId: id, ownerUid: 't2', data: {classSession: '없음', selfStudyStart: '17:00', ...data}, ...x});
  source('src-1', {date: '2026-10-20', content: '옛 내용'});                                       // taken over by 'linked'
  source('src-2', {date: '2026-10-23', content: '누적 테스트'});
  const r: any = await recentLessons(f.db, me, K, '영어', '2026-10-30', 'now');
  assert.deepEqual(r.lessons.map((l: any) => [l.id, l.kind, l.teacher]), [['mine', '수업', '이지원T'], ['theirs', '수업', '박선생'], ['src-2', '테스트', '박선생']]);
  assert.deepEqual(r.lessons[0], {id: 'mine', date: '2026-10-28', start: '16:00', kind: '수업', content: '어법 2장', assignment: '어법 3장', teacher: '이지원T'});
  const more: any = await recentLessons(f.db, me, K, '영어', '2026-10-30', 'now', 10);
  assert.ok(more.lessons.some((l: any) => l.id === 'linked') && !more.lessons.some((l: any) => l.id === 'src-1'), 'the migrated row an app lesson stands for: once');
  await assert.rejects(recentLessons(f.db, {...me, scopes: []}, K, '영어', '2026-10-30'), /FORBIDDEN/);
});

test('내용에 넣기: into an empty box as it is, else on a new line after what is there', () => {
  assert.equal(appendLessonText('', '단어 Day 3'), '단어 Day 3');
  assert.equal(appendLessonText('어법 2장  \n', '단어 Day 3'), '어법 2장\n단어 Day 3');
});
