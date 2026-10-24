// 학생 학습 알림: after a study is saved, tell the server (it alerts the teachers who turned it on). Fire and forget —
// the student never waits for it or sees it fail.
import { auth } from './firebase';
import { safeFetchJson } from './safeFetchJson';

/** Phone or tablet (an iPad reports a Mac, so a touch Mac counts too). */
export function studyDevice(nav: any = typeof navigator === 'undefined' ? null : navigator): 'mobile' | 'pc' {
  if (!nav) return 'pc';
  if (typeof nav.userAgentData?.mobile === 'boolean' && nav.userAgentData.mobile) return 'mobile';
  const ua = String(nav.userAgent || '');
  return /Android|iPhone|iPad|iPod|Mobile/i.test(ua) || (/Macintosh/.test(ua) && Number(nav.maxTouchPoints) > 1) ? 'mobile' : 'pc';
}
export async function pingStudyDone(id: string) {
  const user = auth.currentUser; if (!user) return;
  await safeFetchJson('/api/student/study-done', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await user.getIdToken()}` }, body: JSON.stringify({ id, device: studyDevice() }) });
}
