import { useEffect, useState } from 'react';
import { auth } from '../../lib/firebase';
import { teacherAuthenticatedRequest } from '../../lib/teacherAuthenticatedRequest';
import { CERT_GRADES, CERT_KIND_LABEL, CERT_RULES, type CertGrade, type CertView } from '../../lib/studyCert';

// 학습 리포트 › 인증 요청 (선생님): the student's own study waiting for a check (워크북, 지문 분석지 회독, 직접 만든 변형
// 문제), with the photo when there is one; a grade pays the points (outside the daily study cap, a few a day) or asks
// for it again. Decided ones stay below, newest first.
const when = (at: number) => new Date(at).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const API = '/api/teacher/workspace';

export default function TeacherStudyCerts({ studentKey }: { studentKey: string }) {
  const [certs, setCerts] = useState<CertView[] | null>(null), [busy, setBusy] = useState(''), [message, setMessage] = useState(''), [photos, setPhotos] = useState<Record<string, string>>({});
  useEffect(() => {
    let live = true; setCerts(null); setMessage(''); setPhotos({});
    teacherAuthenticatedRequest<any>(auth, `${API}?action=study-certs&studentKey=${encodeURIComponent(studentKey)}`).then(r => { if (live) setCerts(r.ok && r.data?.ok ? r.data.certs || [] : []); }).catch(() => { if (live) setCerts([]); });
    return () => { live = false; };
  }, [studentKey]);
  if (!certs || !certs.length) return null; // nothing asked yet: the section stays out of the way
  const decide = async (c: CertView, grade: CertGrade) => {
    if (busy) return; setBusy(c.id); setMessage('');
    try {
      const r = await teacherAuthenticatedRequest<any>(auth, API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'study-cert-decide', studentKey, id: c.id, grade }) });
      if (!r.ok || !r.data?.ok) throw Error(r.data?.message || '저장하지 못했어요.');
      setCerts(list => (list || []).map(x => (x.id === c.id ? r.data.cert : x)));
    } catch (e: any) { setMessage(e?.message || '저장하지 못했어요.'); } finally { setBusy(''); }
  };
  const showPhoto = async (c: CertView) => {
    if (photos[c.id]) return setPhotos(p => { const { [c.id]: _, ...rest } = p; return rest; });
    const r = await teacherAuthenticatedRequest<any>(auth, `${API}?action=study-cert-photo&studentKey=${encodeURIComponent(studentKey)}&id=${c.id}`).catch(() => null);
    if (r?.ok && r.data?.ok) setPhotos(p => ({ ...p, [c.id]: r.data.photo })); else setMessage(r?.data?.message || '사진을 열지 못했어요.');
  };
  const waiting = certs.filter(c => c.status === 'pending').length;
  return <section className="report-online-assignments" aria-label="인증 요청"><h4>인증 요청{waiting ? ` · 기다리는 중 ${waiting}` : ''}</h4>
    <p className="report-caption">학생이 직접 한 학습지예요. 확인하면 포인트가 들어가요 (하루 {CERT_RULES.dailyPaid}건까지, 공부 포인트 한도와 별도).</p>
    {message && <p role="alert" className="report-caption text-rose-700">{message}</p>}
    {certs.map(c => <article key={c.id} className="report-assignment">
      <div className="flex flex-wrap items-center gap-2">
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
  </section>;
}
