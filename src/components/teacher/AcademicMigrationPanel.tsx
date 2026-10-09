import AutomaticImportControl from './AutomaticImportControl';
import GradeCutoverPanel from './GradeCutoverPanel';
import { useState } from 'react';
export default function AcademicMigrationPanel({ request, act, onImported }: {
    request: (action: string, body?: any) => Promise<any>;
    act: (f: () => Promise<any>) => Promise<void>;
    onImported: () => Promise<any>;
}) { const [preview, setPreview] = useState<any>(null), [busy, setBusy] = useState(false), [message, setMessage] = useState(''), [appOnly, setAppOnly] = useState(false); async function run(importing: boolean) { if (busy)
    return; if (importing && !window.confirm('확인한 과거 성적을 앱으로 가져올까요? 앱에서 수정한 최신 성적은 덮어쓰지 않습니다.'))
    return; setBusy(true); try {
    await act(async () => { if (importing) {
        const result = await request('academic-migration-next', { confirmed: true, reviewToken: preview.reviewToken });
        setPreview(null);
        setMessage(`${result.total}건 확인 · ${result.imported}건 이전 · ${result.skipped}건 보존${result.done ? ' · 이번 순회 완료' : ''}`);
        await onImported();
    }
    else {
        const result = await request('read:academic-migration-preview');
        setPreview(result);
        setMessage(result.done ? '이번 순회가 끝났습니다. 최종 대조는 새 순회로 확인하세요.' : `다음 ${result.count}건 · 앱 기록 보존 ${result.appOwned}건 · 작성자 연결 확인 ${result.unknownAuthors}건`);
    } });
}
finally {
    setBusy(false);
} } return <details className="academic-migration-panel"><summary>과거 Notion 성적 이전 · 관리자</summary><GradeCutoverPanel request={request} act={act} busy={busy} onChanged={onImported} onStatus={setAppOnly}/>{appOnly ? <p className="text-xs my-2">성적이 앱 전용이라 Notion 성적 이전 도구는 쓰지 않습니다.</p> : <><p className="text-xs my-2">일반 성적 조회는 앱 자료만 사용합니다. 이 도구는 누를 때만 Notion 원본을 확인하며, 10건씩 저장한 진행 위치에서 이어집니다.</p><AutomaticImportControl kind="academic" request={request} act={act} busy={busy} onComplete={onImported} onRunningChange={setBusy}/><div className="flex flex-wrap gap-2"><button type="button" className="small-button" disabled={busy} onClick={() => void run(false)}>이전 내용 확인 (저장 없음)</button><button type="button" className="small-button" disabled={busy || !preview?.reviewToken || preview.done} onClick={() => void run(true)}>확인한 다음 10건 가져오기</button><button type="button" className="small-button" disabled={busy} onClick={() => { if (!window.confirm('내용은 유지하고 원본 대조를 처음부터 다시 시작할까요?'))
    return; setBusy(true); void act(async () => { await request('academic-migration-reset', { confirmed: true }); setPreview(null); setMessage('새 대조 순회를 준비했습니다.'); }).finally(() => setBusy(false)); }}>새 대조 순회</button></div></>}{message && <p role="status" className="text-sm mt-2">{message}</p>}</details>; }


