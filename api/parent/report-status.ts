import type { IncomingMessage, ServerResponse } from 'http';
import { sendJson } from '../_lib/http.ts';
import { getFirebaseAdmin } from '../_lib/firebaseAdmin.ts';
import type { StoredReportSlug } from '../_lib/reportSchemas.ts';

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET');
      return sendJson(res, 405, { ok: false, error: 'METHOD_NOT_ALLOWED' });
    }

    const url = new URL(req.url || '', 'http://localhost');
    const reportSlug = url.searchParams.get('reportSlug')?.toLowerCase().trim();

    if (!reportSlug || !/^[a-z0-9]{3,30}$/.test(reportSlug)) {
      return sendJson(res, 400, { ok: false, active: false });
    }

    const { db } = getFirebaseAdmin();
    const docRef = db.collection('reportSlugs').doc(reportSlug);
    const snap = await docRef.get();

    if (!snap.exists) {
      return sendJson(res, 200, { ok: false, active: false });
    }

    const data = snap.data() as StoredReportSlug;
    if (!data.active) {
      return sendJson(res, 200, { ok: false, active: false });
    }

    // 민감 정보 일체 제외, 오직 활성 상태 여부만 반환
    return sendJson(res, 200, { ok: true, active: true });
  } catch (err) {
    return sendJson(res, 500, { ok: false, active: false, error: 'SERVER_ERROR' });
  }
}
