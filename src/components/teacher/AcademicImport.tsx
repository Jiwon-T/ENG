import React, { useState } from 'react';
import { auth } from '../../lib/firebase';
import { safeFetchJson } from '../../lib/safeFetchJson';
export default function AcademicImport() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const run = async (academyOnly = false) => {
    if (!auth.currentUser || busy) return;
    setBusy(true); setMessage(academyOnly ? '학원 점수 누락을 확인하는 중입니다…' : '성적·수강을 가져오는 중입니다…');
    let total = 0, failed = 0;
    try {
      for (const kind of (academyOnly ? ['academy'] : ['grades', 'enrollments'])) {
        let cursor: string | null = null;
        do {
          const token = await auth.currentUser.getIdToken();
          const result = await safeFetchJson<{ imported: number; errors: unknown[]; nextCursor: string | null }>('/api/teacher/import-academic', {
            method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ kind, ...(cursor ? { cursor } : {}) }),
          });
          if (!result.ok || !result.data) throw new Error();
          total += result.data.imported; failed += result.data.errors.length; cursor = result.data.nextCursor;
          setMessage(`${total}건 반영${failed ? ` · 실패 ${failed}건` : ''}…`);
        } while (cursor);
      }
      setMessage(`${total}건 반영 완료${failed ? ` · 실패 ${failed}건: 학생 관계와 필수 값을 확인한 뒤 다시 실행하세요.` : ''}`);
    } catch { setMessage(`가져오기를 완료하지 못했습니다. ${total}건 반영, ${failed}건 실패. 다시 실행해도 중복 생성되지 않습니다.`); }
    finally { setBusy(false); }
  };
  return <div className="space-y-2"><button type="button" onClick={() => run(false)} disabled={busy} className="px-3 py-2 rounded-xl bg-indigo-50 text-indigo-700 text-xs font-bold disabled:opacity-50">기존 성적·수강 가져오기</button><button type="button" onClick={() => run(true)} disabled={busy} className="ml-2 px-3 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold disabled:opacity-50">학원 점수 누락만 보완</button>{message && <p role="status" className="text-xs text-slate-600">{message}</p>}</div>;
}
