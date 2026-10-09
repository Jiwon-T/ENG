import { useState } from 'react';
export default function ScheduleTransitionPanel({ request, act, onChanged }: {
    request: (action: string, body?: any) => Promise<any>;
    act: (fn: () => Promise<any>) => Promise<void>;
    onChanged: () => Promise<any>;
}) { const [busy, setBusy] = useState(false), [audit, setAudit] = useState<any>(null), [message, setMessage] = useState(''); async function run(kind: string) { if (busy)
    return; if (kind !== 'audit' && !window.confirm(kind === 'prepare' ? '기존 앱 수정은 유지하면서 원본 일정과 장소 옵션을 앱에 준비할까요?' : '원본 편집을 중단하고 대조를 마쳤나요? 확인한 일정의 조회·저장·공개·취소를 앱 경로로 전환할까요?'))
    return; setBusy(true); try {
    await act(async () => { if (kind === 'audit') {
        const result = await request('read:schedule-transition-audit');
        setAudit(result);
        setMessage(result.ready ? `${result.count}건 대조 통과 · 전환 가능` : `${result.count}건 확인 · ${result.issues.length}건 검토 필요`);
    }
    else {
        const result = await request(kind === 'prepare' ? 'prepare-app-schedules' : 'activate-app-schedules', { confirmed: true });
        setAudit(null);
        setMessage(kind === 'prepare' ? `가져옴 ${result.imported}건 · 기존 보존 ${result.kept}건 · 장소 ${result.places}개` : '일정 앱 경로 전환 완료');
        await onChanged();
    } });
}
finally {
    setBusy(false);
} } return <details className="schedule-transition-panel"><summary>일정 앱 전환 · 관리자</summary><p className="text-xs my-2">준비·대조 완료 전에는 기존 일정 조회를 유지합니다. 이 도구는 누를 때만 원본을 확인합니다.</p><div className="flex flex-wrap gap-2"><button type="button" className="small-button" disabled={busy} onClick={() => void run('audit')}>대조 (저장 없음)</button><button type="button" className="small-button" disabled={busy} onClick={() => void run('prepare')}>원본·장소 준비</button><button type="button" className="small-button" disabled={busy || !audit?.ready} onClick={() => void run('activate')}>대조 후 앱 전환</button></div>{message && <p role="status" className="text-sm mt-2">{message}</p>}{audit?.issues?.length > 0 && <details><summary>검토 항목</summary><ul>{audit.issues.map((issue: string) => <li key={issue} className="text-xs">{issue}</li>)}</ul></details>}</details>; }
