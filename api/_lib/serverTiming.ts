import type { ServerResponse } from 'http';
// Per-request stage timings sent as a standard Server-Timing header (names and milliseconds only, no data).
// The browser exposes them to the page for same-origin requests; 관리자 설정 › 속도 점검 shows them.
let warm = false;
export function startServerTiming(res: ServerResponse) {
    const start = performance.now(), cold = !warm; warm = true;
    const marks: [string, number][] = []; let last = start;
    const header = () => [cold ? 'cold;desc="서버 깨어남"' : '', ...marks.map(([name, ms]) => `${name};dur=${ms.toFixed(1)}`), `total;dur=${(performance.now() - start).toFixed(1)}`].filter(Boolean).join(', ');
    const end = res.end;
    (res as any).end = function (...args: any[]) { try { if (!res.headersSent && typeof res.setHeader === 'function') res.setHeader('Server-Timing', header()); } catch { /* timing is best-effort */ } return (end as any).apply(this, args); };
    return {
        /** Time since the previous mark, under this stage name. */
        mark(name: string) { const now = performance.now(); marks.push([name, now - last]); last = now; },
        /** Stages measured elsewhere (e.g. inside sign-in checks), added as they are. */
        add(name: string, ms: number) { if (Number.isFinite(ms)) marks.push([name, ms]); },
    };
}
