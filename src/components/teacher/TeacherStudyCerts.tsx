import { useEffect, useState } from 'react';
import { BadgeCheck, X } from 'lucide-react';
import { auth } from '../../lib/firebase';
import { teacherAuthenticatedRequest } from '../../lib/teacherAuthenticatedRequest';
import { CERT_GRADES, CERT_KIND_LABEL, CERT_RULES, type CertGrade, type CertView } from '../../lib/studyCert';

// 선생님 인증 (선생님): a student's own study waiting for a check (워크북, 지문 분석지 회독, 직접 만든 변형 문제), with the
// photo when there is one; a grade pays the points (outside the daily study cap, a few a day) or asks for it again.
// Shown in one student's 학습 리포트 (TeacherStudyCerts) and, for every student the teacher has, as 인증 요청 모아 보기
// (TeacherCertInbox: 담당 선생님, 원장, 관리자).
const when = (at: number) => new Date(at).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const API = '/api/teacher/workspace';
type Row = CertView & { studentKey?: string; studentName?: string };

/** The requests, each with its grade buttons (waiting) or its result (decided); `studentKey` when all are one student's. */
function CertItems({ certs, studentKey, onChange }: { certs: Row[]; studentKey?: string; onChange: (cert: Row) => void }) {
  const [busy, setBusy] = useState(''), [message, setMessage] = useState(''), [photos, setPhotos] = useState<Record<string, string>>({});
  const keyOf = (c: Row) => studentKey || c.studentKey || '';
  const decide = async (c: Row, grade: CertGrade) => {
    if (busy) return; setBusy(c.id); setMessage('');
    try {
      const r = await teacherAuthenticatedRequest<any>(auth, API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'study-cert-decide', studentKey: keyOf(c), id: c.id, grade }) });
      if (!r.ok || !r.data?.ok) throw Error(r.data?.message || '저장하지 못했어요.');
      onChange({ ...c, ...r.data.cert });
    } catch (e: any) { setMessage(e?.message || '저장하지 못했어요.'); } finally { setBusy(''); }
  };
  const showPhoto = async (c: Row) => {
    if (photos[c.id]) return setPhotos(p => { const { [c.id]: _, ...rest } = p; return rest; });
    const r = await teacherAuthenticatedRequest<any>(auth, `${API}?action=study-cert-photo&studentKey=${encodeURIComponent(keyOf(c))}&id=${c.id}`).catch(() => null);
    if (r?.ok && r.data?.ok) setPhotos(p => ({ ...p, [c.id]: r.data.photo })); else setMessage(r?.data?.message || '사진을 열지 못했어요.');
  };
  return <>
    {message && <p role="alert" className="report-caption text-rose-700">{message}</p>}
    {certs.map(c => <article key={c.id} className="report-assignment">
      <div className="flex flex-wrap items-center gap-2">
        {c.studentName && <b className="text-sm font-bold text-[#5e1e2a]">{c.studentName}</b>}
        <span className="rounded-full bg-[#fef2f3] px-2 py-0.5 text-[11px] font-bold text-[#8b2f40]">{CERT_KIND_LABEL[c.kind]}{c.kind === 'reading' ? ` · ${c.round}회독` : ''}</span>
        <span className="min-w-0 flex-1 truncate text-sm">{c.title}</span>
        <span className="text-xs text-slate-400">{when(c.requestedAt)}</span>
      </div>
      {c.status === 'pending' ? <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {CERT_GRADES[c.kind].map(g => <button key={g.grade} type="button" disabled={Boolean(busy)} onClick={() => void decide(c, g.grade)} className={`rounded-lg border px-2.5 py-1 text-xs font-bold disabled:opacity-50 ${g.grade === 'redo' ? 'border-slate-200 text-slate-500' : 'border-[#f3a5b4] text-[#8b2f40] hover:bg-[#fef2f3]'}`}>{g.label}</button>)}
        {c.photo && <button type="button" onClick={() => void showPhoto(c)} className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-bold text-slate-600">{photos[c.id] ? '사진 닫기' : '사진 보기'}</button>}
      </div>
        : <p className="mt-1 text-xs text-slate-500">{c.status === 'approved' ? `인증 완료${c.grade && c.grade !== 'ok' ? ` · ${c.grade}` : ''} · +${c.points}P` : '다시 해 오기로 돌려보냄'}{c.decidedAt ? ` · ${when(c.decidedAt)}` : ''}</p>}
      {photos[c.id] && <img src={photos[c.id]} alt={`${c.title} 사진`} className="mt-2 max-h-96 w-full rounded-lg border border-slate-100 object-contain" />}
    </article>)}
  </>;
}
const caption = <p className="report-caption">학생이 직접 한 학습지예요. 확인하면 포인트가 들어가요 (학생마다 하루 {CERT_RULES.dailyPaid}건까지, 공부 포인트 한도와 별도).</p>;

/** 학습 리포트 › 인증 요청: one student's, waiting ones first, then the latest decided. */
export default function TeacherStudyCerts({ studentKey }: { studentKey: string }) {
  const [certs, setCerts] = useState<Row[] | null>(null);
  useEffect(() => {
    let live = true; setCerts(null);
    teacherAuthenticatedRequest<any>(auth, `${API}?action=study-certs&studentKey=${encodeURIComponent(studentKey)}`).then(r => { if (live) setCerts(r.ok && r.data?.ok ? r.data.certs || [] : []); }).catch(() => { if (live) setCerts([]); });
    return () => { live = false; };
  }, [studentKey]);
  if (!certs || !certs.length) return null; // nothing asked yet: the section stays out of the way
  const waiting = certs.filter(c => c.status === 'pending').length;
  return <section className="report-online-assignments" aria-label="인증 요청"><h4>인증 요청{waiting ? ` · 기다리는 중 ${waiting}` : ''}</h4>{caption}
    <CertItems certs={certs} studentKey={studentKey} onChange={c => setCerts(list => (list || []).map(x => (x.id === c.id ? c : x)))} />
  </section>;
}

/** 인증 요청 모아 보기: a slim bar when any student of this teacher is waiting; it opens every waiting request, oldest
 *  first. Decided ones stay in the open list (with their result) until it is closed. */
export function TeacherCertInbox() {
  const [certs, setCerts] = useState<Row[]>([]), [open, setOpen] = useState(false), [next, setNext] = useState<string | null>(null);
  // From the start (or on from `after`, adding to the list). A read that finds none of this teacher's but has more goes on
  // by itself (a few times), so requests far down the list still show.
  const load = async (after?: string) => {
    let cursor = after, found: Row[] = [];
    for (let n = 0; n < 5; n++) {
      const r = await teacherAuthenticatedRequest<any>(auth, `${API}?action=study-cert-inbox${cursor ? `&after=${cursor}` : ''}`).catch(() => null);
      if (!r?.ok || !r.data?.ok) return;
      found = [...found, ...(r.data.certs || [])]; cursor = r.data.next || undefined;
      if (found.length || !cursor) break;
    }
    setCerts(list => (after ? [...list, ...found] : found)); setNext(cursor || null);
  };
  useEffect(() => { void load(); }, []);
  const waiting = certs.filter(c => c.status === 'pending').length;
  if (!waiting && !open && !next) return null;
  return <>
    {!open && <button type="button" onClick={() => setOpen(true)} className="mb-3 flex w-full items-center gap-2 rounded-xl border border-[#f3d5da] bg-[#fffafb] px-3 py-2 text-left text-sm text-[#8b2f40] hover:bg-[#fef2f3]">
      <BadgeCheck size={16} aria-hidden="true" /><b className="font-bold">학생 인증 요청 {waiting}{next ? '+' : ''}건</b><span className="text-xs text-slate-500">워크북 · 지문 분석지 회독 · 직접 만든 변형 문제</span><span className="ml-auto text-xs font-bold">확인하기 ›</span>
    </button>}
    {open && <section aria-label="인증 요청 모아 보기" className="review-section report-online mb-3 rounded-xl border border-[#f3d5da] bg-white p-3">
      <div className="flex items-center justify-between"><h3 className="text-sm font-bold text-[#5e1e2a]">인증 요청 모아 보기{waiting ? ` · 기다리는 중 ${waiting}` : ''}</h3><button type="button" aria-label="닫기" onClick={() => { setOpen(false); void load(); }} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"><X size={16} aria-hidden="true" /></button></div>
      {caption}
      {certs.length ? <CertItems certs={certs} onChange={c => setCerts(list => list.map(x => (x.id === c.id ? c : x)))} /> : <p className="report-caption">{next ? '아직 찾지 못했어요. 더 불러와 주세요.' : '기다리는 요청이 없어요.'}</p>}
      {next && <button type="button" onClick={() => void load(next)} className="mt-2 w-full rounded-lg border border-[#f3d5da] py-1.5 text-xs font-bold text-[#8b2f40] hover:bg-[#fef2f3]">요청 더 불러오기</button>}
    </section>}
  </>;
}
