import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import ConsultPane from '../src/components/teacher/ConsultPane';

const k = '11111111-1111-4111-8111-111111111111';
const render = (consult: any) => renderToStaticMarkup(<ConsultPane consult={consult} data={{ students: [{ studentKey: k, studentDisplayName: '전수현 (평여중1)' }] }} request={async () => ({})} onBack={() => {}} leaveRef={{ current: null }} />);

test('상담 공간 (일지 오른쪽 칸): the 상담 heading, time·place, 신입생 or 재원생, and ← 일지로', () => {
  const fresh = render({ id: 'consult:s1', scheduleId: 's1', title: '김동하 학생 상담', start: '21:00', end: '22:00', place: '용죽', students: [], prospects: [{ name: '김동하', registrationId: null, studentKey: null }] });
  for (const text of ['김동하 학생 상담', '21:00–22:00 · 용죽', '신입생', '일지로', '원서를 불러오는 중']) assert.ok(fresh.includes(text), text);
  const enrolled = render({ id: 'consult:s2', title: '학부모 상담', start: '16:00', end: '16:30', place: '', students: [k], prospects: [] });
  for (const text of ['학부모 상담', '16:00–16:30', '재원생', '학습 리포트를 불러오는 중']) assert.ok(enrolled.includes(text), text);
  assert.equal(enrolled.includes('상담 학생'), false, 'one student: no chips');
});
