import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import AdmissionFormSheet from '../src/components/print/AdmissionFormSheet';
import { emptyAdmission } from '../src/lib/studentAdmission';

test('입학원서 인쇄: the 원서 fills the academy form (scores, days, consent, date, signer); blank prints the empty form', () => {
  const admission = { ...emptyAdmission(), birthDate: '2010-03-02', referral: '지인 소개', goal: '영어 1등급', availableDays: ['월', '수'], availableTimes: '오후 6시 이후', consent: '동의' as const, consentDate: '2026-10-22', signerName: '김보호',
    levels: emptyAdmission().levels.map(l => l.subject === '영어' ? { ...l, schoolGrade: '2', schoolScore: 88 } : l) };
  const html = renderToStaticMarkup(<AdmissionFormSheet value={{ name: '김동하', school: '용죽고', grade: '고1', guardianPhone: '010-0000-1234', admission } as any} />);
  for (const text of ['입 학 원 서', '김동하', '용죽고 · 고1', '010-0000-1234', '2010-03-02', '지인 소개', '2등급 · 88점', '월, 수 · 오후 6시 이후', '영어 1등급', '■ 동의', '□ 미동의', '김보호', '2026', '/branding/chaeum-logo.png']) assert.ok(html.includes(text), text);
  const blank = renderToStaticMarkup(<AdmissionFormSheet value={null} />);
  assert.ok(blank.includes('학 생 성 명') && blank.includes('참 고 사 항'));
  assert.ok(blank.includes('□ 동의') && blank.includes('□ 미동의') && !blank.includes('점<'), 'nothing filled in');
});
