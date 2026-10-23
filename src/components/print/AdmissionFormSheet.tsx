import type { RegistrationInput } from '../../lib/studentRegistration';
import { admissionSubjects, emptyAdmission } from '../../lib/studentAdmission';
// styles: admissionForm.css (imported by the screens that print it, so this stays renderable in tests)

// 입학원서 (채움학원's paper form, the same layout): one A4 page filled from a 상담·신입생 원서, or blank to print and write
// by hand. Printed with PrintPortal; the browser's 'PDF로 저장' makes the file.
const LOGO = '/branding/chaeum-logo.png';
// 점수 is free text (several 학기): a bare number still gets '점'
const score = (grade: string, value: string) => [grade && (/등급$/.test(grade) ? grade : `${grade}등급`), /^\d+(\.\d+)?$/.test(value.trim()) ? `${value.trim()}점` : value.trim()].filter(Boolean).join(' · ');
const dateParts = (day: string) => /^\d{4}-\d{2}-\d{2}$/.test(day) ? [day.slice(0, 4), String(Number(day.slice(5, 7))), String(Number(day.slice(8, 10)))] : ['', '', ''];

export default function AdmissionFormSheet({ value }: { value?: RegistrationInput | null }) {
  const v: any = value || {}, a = { ...emptyAdmission(), ...(v.admission || {}) };
  const level = (subject: string) => a.levels.find((l: any) => l.subject === subject);
  const [year, month, day] = dateParts(a.consentDate || '');
  const history = [a.previousAcademy, a.previousBooks, a.previousContent].filter(Boolean).join('\n');
  const days = [a.availableDays?.join(', '), a.availableTimes].filter(Boolean).join(' · ');
  const mark = (on: boolean) => on ? '■' : '□';
  return <section className="admission-sheet">
    <header className="admission-band"><h1>입 학 원 서</h1><img src={LOGO} alt="채움학원" /></header>
    <div className="admission-stripe" />
    <h2>■ 학생 정보</h2>
    <table className="admission-table"><colgroup><col style={{ width: '16.5%' }} /><col style={{ width: '33.5%' }} /><col style={{ width: '16.5%' }} /><col /></colgroup><tbody>
      <tr><th>학 생 성 명</th><td>{v.name}</td><th>생 년 월 일</th><td>{a.birthDate}</td></tr>
      <tr><th>학 생 연 락 처</th><td>{v.studentPhone}</td><th>보호자 연락처</th><td>{v.guardianPhone}</td></tr>
      <tr><th>학 교 . 학 년</th><td>{[v.school, v.grade].filter(Boolean).join(' · ')}</td><th>알게 된 경로</th><td>{a.referral}</td></tr>
      <tr><th>주 &nbsp; 소</th><td colSpan={3}>{a.address}</td></tr>
    </tbody></table>
    <h2>■ 학습 수준 및 현황</h2>
    <table className="admission-table"><colgroup><col style={{ width: '16.5%' }} /><col style={{ width: '16.5%' }} /><col /><col /><col /><col /></colgroup><tbody>
      <tr><th>이전 학습 이력</th><th>기 간</th><th colSpan={4}>학원명, 사용교재, 학습내용</th></tr>
      <tr className="admission-tall"><td /><td>{a.previousPeriod}</td><td colSpan={4} className="admission-pre">{history}</td></tr>
      <tr><th rowSpan={4}>현 재 수 준</th><th /><>{admissionSubjects.map(s => <th key={s}>{s.split('').join(' ')}</th>)}</></tr>
      <tr><th className="admission-sub">내신 (등급.점수)</th>{admissionSubjects.map(s => <td key={s}>{score(level(s)?.schoolGrade || '', String(level(s)?.schoolScore ?? ''))}</td>)}</tr>
      <tr><th className="admission-sub">모평 (등급.점수)</th>{admissionSubjects.map(s => <td key={s}>{score(level(s)?.mockGrade || '', String(level(s)?.mockScore ?? ''))}</td>)}</tr>
      <tr><th className="admission-sub">진단평가 결과</th>{admissionSubjects.map(s => <td key={s} className="admission-pre">{level(s)?.diagnostic}</td>)}</tr>
      <tr><th>목 &nbsp; 표</th><td colSpan={5} className="admission-pre">{a.goal}</td></tr>
      <tr className="admission-mid"><th>수업 가능<br />요일. 시간</th><td colSpan={5} className="admission-pre">{days}</td></tr>
      <tr className="admission-notes"><th>참 고 사 항</th><td colSpan={5} className="admission-pre">{a.notes}</td></tr>
    </tbody></table>
    <div className="admission-consent">
      <p>본원은 수강 등록 및 교육서비스의 제공을 위해 아래와 같이 개인정보의 수집, 이용을 하고자 합니다.<br />내용을 자세히 읽으신 후 동의 여부를 결정하여 주십시오.</p>
      <p className="admission-center">개인정보 수집 및 이용내역 (필수사항)<br />* 항목 : 성명, 연락처, 성적 등 학습정보 * 수집, 이용 목적 : 강의 서비스 제공 * 보유기간 : 퇴원 後 6개월 이내 파기</p>
      <p>개인정보 제공 동의를 거부할 권리가 있으나, 동의를 거부할 경우 서비스 제공이 불가합니다.</p>
      <p className="admission-agree"><span>위와 같이 개인정보를 수집 및 이용하는 데 동의하십니까?</span><span>{mark(a.consent === '동의')} 동의</span><span>{mark(a.consent === '미동의')} 미동의</span></p>
      <p className="admission-date"><span>{year}</span> 년 <span>{month}</span> 월 <span>{day}</span> 일</p>
      <p className="admission-sign">성 명 <span>{a.signerName}</span> (서명 또는 인)</p>
    </div>
  </section>;
}
