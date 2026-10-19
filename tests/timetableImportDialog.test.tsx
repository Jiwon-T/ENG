import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import TimetableImport from '../src/components/teacher/TimetableImport';
import type { SheetCells } from '../src/lib/timetableImport';

const k = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const data: any = {uid: 'me', classes: [], teachingScopes: [], students: [
  {studentKey: k(1), studentDisplayName: '김민준 (용인중1)'}, {studentKey: k(2), studentDisplayName: '정우진 (용인중3)'}, {studentKey: k(3), studentDisplayName: '정우진 (고덕중1)'},
]};
const cells: SheetCells[] = [{weekday: 1, lesson: '4:10~5:30\n김민준, 한새봄, 정우진', study: '', test: ''}];
const render = (onRegister?: (name: string) => void) => renderToStaticMarkup(<TimetableImport fileName="10월 시간표.xlsx" cells={cells} data={data} request={async () => ({})} onSaved={() => {}} onRegister={onRegister} onClose={() => {}}/>);

test('가져오기 › a name not in the app: 원장님·관리자 can register it; other teachers are told to ask; a shared name is only chosen', () => {
  const admin = render(() => {});
  assert.equal((admin.match(/새 학생 등록/g) || []).length, 1, 'only for 한새봄, not for 정우진 (two students of that name)');
  assert.match(admin, /새 학생을 등록한 뒤 다시 가져오면 맞춰져요/);
  assert.doesNotMatch(admin, /원장님께 등록을 요청/);
  const teacher = render();
  assert.doesNotMatch(teacher, /새 학생 등록/);
  assert.equal((teacher.match(/원장님께 등록을 요청해 주세요/g) || []).length, 1);
});
