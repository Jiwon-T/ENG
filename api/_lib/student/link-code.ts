import type { IncomingMessage, ServerResponse } from 'http';
import { verifyFirebaseSession } from '../firebaseSession.js';
import { parseJsonBody, sendJson } from '../http.js';
import { getFirebaseAdmin } from '../firebaseAdmin.js';
import { redeemLinkCode } from '../studentLinkCodes.js';
// POST /api/student/link-code {code}: a signed-in student links their account with a code from the academy.
const messages: Record<string, [number, string]> = {
    LINK_CODE_INVALID: [400, '코드를 다시 확인해 주세요. 학원에서 받은 8자리 코드를 입력해 주세요.'],
    LINK_CODE_EXPIRED: [400, '기간이 지난 코드입니다. 학원에 새 코드를 요청해 주세요.'],
    LINK_CODE_TOO_MANY: [429, '입력 횟수가 많습니다. 1시간 뒤에 다시 시도해 주세요.'],
    LINK_CODE_NOT_STUDENT: [400, '학생 계정에서만 입력할 수 있습니다.'],
    LINK_CODE_ALREADY_LINKED: [400, '이미 학원 학생으로 연결된 계정입니다.'],
    LINK_CODE_STUDENT_TAKEN: [409, '이 코드의 학생은 이미 다른 계정과 연결되어 있습니다. 학원에 문의해 주세요.'],
    USER_NOT_FOUND: [404, '계정 정보를 찾지 못했습니다. 다시 로그인해 주세요.'],
};
export default async function handler(req: IncomingMessage, res: ServerResponse) {
    if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return sendJson(res, 405, { ok: false, error: 'METHOD_NOT_ALLOWED' }); }
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) return sendJson(res, 401, { ok: false, error: 'UNAUTHORIZED' });
    let uid: string;
    try { const { auth } = getFirebaseAdmin(); uid = (await verifyFirebaseSession(auth, header.slice(7).trim())).uid; }
    catch { return sendJson(res, 401, { ok: false, error: 'UNAUTHORIZED' }); }
    try {
        const { db } = getFirebaseAdmin();
        const result = await redeemLinkCode(db, uid, await parseJsonBody(req));
        return sendJson(res, 200, { ok: true, ...result });
    } catch (e: any) {
        const known = messages[e?.message];
        if (known) return sendJson(res, known[0], { ok: false, error: e.message, message: known[1] });
        if (e?.name === 'ZodError') return sendJson(res, 400, { ok: false, error: 'LINK_CODE_INVALID', message: messages.LINK_CODE_INVALID[1] });
        return sendJson(res, 500, { ok: false, error: 'SERVER_ERROR', message: '연결하지 못했습니다. 잠시 후 다시 시도해 주세요.' });
    }
}
