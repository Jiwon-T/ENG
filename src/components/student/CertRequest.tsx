import { useEffect, useRef, useState } from 'react';
import { BadgeCheck, Camera, X } from 'lucide-react';
import { auth } from '../../lib/firebase';
import { teacherAuthenticatedRequest } from '../../lib/teacherAuthenticatedRequest';
import { CERT_RULES, type CertKind, type CertView } from '../../lib/studyCert';

// 선생님 인증 (학생): ask the teacher to check this 워크북 / 지문 분석지 회독 / 직접 만든 변형 문제, with a photo or
// without; then its state (waiting, done +P, 다시 해 오기). 회독 shows the rounds (up to 3).
const URL_ = '/api/student/study-cert';
const NOTE: Record<CertKind, string> = { workbook: '프린트해서 풀었으면 선생님께 보여 주고 인증받아요', reading: '한 번 더 읽었으면 선생님께 인증받아요 · 하루 한 번', questions: '스스로 푼 문제도 선생님께 인정받으면 포인트를 받아요' };

/** A photo shrunk on the phone (longest side 1280px, JPEG) so it stays small; smaller again when still too big. */
export async function shrinkPhoto(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((ok, bad) => { const i = new Image(); i.onload = () => ok(i); i.onerror = bad; i.src = url; });
    for (const [side, quality] of [[1280, 0.72], [1024, 0.6], [800, 0.5]] as const) {
      const scale = Math.min(1, side / Math.max(img.width, img.height)), canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale); canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
      const data = canvas.toDataURL('image/jpeg', quality);
      if (data.length <= CERT_RULES.photoChars) return data;
    }
    throw Error('사진이 너무 커요. 다른 사진으로 해 주세요.');
  } finally { URL.revokeObjectURL(url); }
}

export default function CertRequest({ kind, refId }: { kind: CertKind; refId: string }) {
  const [who, setWho] = useState<{ linked: boolean; student: boolean }>({ linked: false, student: false }), [certs, setCerts] = useState<CertView[] | null>(null), [busy, setBusy] = useState(false), [message, setMessage] = useState(''), [photo, setPhoto] = useState('');
  const file = useRef<HTMLInputElement>(null);
  useEffect(() => {
    let live = true; setCerts(null);
    teacherAuthenticatedRequest<any>(auth, `${URL_}?kind=${kind}&ref=${encodeURIComponent(refId)}`).then(r => { if (!live) return; setWho({ linked: Boolean(r.data?.linked), student: Boolean(r.data?.student) }); setCerts(r.ok && r.data?.ok ? r.data.certs : []); }).catch(() => { if (live) setCerts([]); });
    return () => { live = false; };
  }, [kind, refId]);
  if (!certs || !who.student) return null; // teachers (their own sets and passages) do not ask
  if (!who.linked) return <p className="mt-3 rounded-xl bg-[#fffafb] px-3 py-2 text-xs text-slate-500">학원에 연결하면 이 학습지를 선생님께 인증받고 포인트를 받을 수 있어요.</p>;
  const reading = kind === 'reading', latest = reading ? [...certs].sort((a, b) => b.round - a.round)[0] : certs[0];
  const doneRounds = certs.filter(c => c.status === 'approved').length, finished = reading ? doneRounds >= CERT_RULES.reading.rounds : latest?.status === 'approved';
  const waiting = latest?.status === 'pending', earned = certs.reduce((sum, c) => sum + (c.status === 'approved' ? c.points : 0), 0);
  const ask = async () => {
    if (busy) return; setBusy(true); setMessage('');
    try {
      const r = await teacherAuthenticatedRequest<any>(auth, URL_, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind, ref: refId, photo: photo || null }) });
      if (!r.ok || !r.data?.ok) throw Error(r.data?.message || '요청하지 못했어요.');
      setCerts(list => [r.data.cert, ...(list || []).filter(c => c.id !== r.data.cert.id)]); setPhoto('');
    } catch (e: any) { setMessage(e?.message || '요청하지 못했어요.'); } finally { setBusy(false); }
  };
  const pick = async (f?: File) => { if (!f) return; setMessage(''); try { setPhoto(await shrinkPhoto(f)); } catch (e: any) { setMessage(e?.message || '사진을 넣지 못했어요.'); } };
  return <section aria-label="선생님 인증" className="mt-3 rounded-xl border border-[#f3d5da] bg-[#fffafb] px-3 py-2.5 text-xs">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <span className="inline-flex items-center gap-1 font-bold text-[#8b2f40]"><BadgeCheck size={14} aria-hidden="true" />선생님 인증{earned ? <span className="font-medium text-slate-500"> · 받은 포인트 +{earned}P</span> : null}</span>
      {reading && <span className="flex w-24 gap-1" aria-label={`${doneRounds}회독 인증`}>{Array.from({ length: CERT_RULES.reading.rounds }, (_, i) => <span key={i} className={`h-1.5 flex-1 rounded-full ${i < doneRounds ? 'bg-[#d4537e]' : 'bg-slate-200'}`} />)}</span>}
    </div>
    {finished ? <p className="mt-1 text-slate-600">{reading ? `${CERT_RULES.reading.rounds}회독 인증을 다 받았어요` : '인증을 받았어요'}</p>
      : waiting ? <p className="mt-1"><span className="rounded-full bg-[#faeeda] px-2 py-0.5 font-bold text-[#633806]">{reading ? `${latest!.round}회독 ` : ''}선생님 확인 기다리는 중</span></p>
      : <>
        <p className="mt-1 text-slate-500">{latest?.status === 'redo' ? `선생님이 ${kind === 'reading' ? '아직이래요' : '다시 해 오라고 했어요'}. 다시 하고 요청해 주세요.` : NOTE[kind]}</p>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <button type="button" disabled={busy} onClick={() => void ask()} className="rounded-lg bg-[#d26272] px-3 py-1.5 font-bold text-white disabled:opacity-50">{reading ? `${doneRounds + 1}회독 ` : ''}인증 요청</button>
          {photo ? <span className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-1.5 py-1"><img src={photo} alt="올릴 사진" className="h-6 w-6 rounded object-cover" /><button type="button" aria-label="사진 빼기" onClick={() => setPhoto('')}><X size={12} aria-hidden="true" /></button></span>
            : <button type="button" onClick={() => file.current?.click()} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1.5 font-bold text-slate-600"><Camera size={13} aria-hidden="true" />사진 (선택)</button>}
          <input ref={file} type="file" accept="image/*" className="hidden" onChange={e => { void pick(e.target.files?.[0]); e.target.value = ''; }} />
        </div>
      </>}
    {message && <p role="alert" className="mt-1.5 font-bold text-[#b04a5a]">{message}</p>}
  </section>;
}
