// AI 해석 shared by 워크북 만들기 and 문장 세트 (one monthly limit for both: /api/gemini?task=workbook).
import { auth } from '../../lib/firebase';

/** AI 해석 from /api/gemini?task=workbook (teachers have a monthly limit; `left` = calls left, null for the admin). */
export async function workbookTranslate(sentences: string[]): Promise<{ translations: string[]; left?: number | null }> {
  const token = await auth.currentUser?.getIdToken();
  const r = await fetch('/api/gemini?task=workbook', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ sentences }) });
  const data = await r.json().catch(() => ({}));
  if (!r.ok || !data?.ok) throw Error(data?.message || 'AI 해석을 받지 못했어요. 잠시 후 다시 해 주세요.');
  return data;
}
/** While the AI translates: a little robot at work beside the button (typing, a blinking light, dots), so the wait feels shorter. */
export function AiWorking() {
  return <span role="status" aria-label="AI가 해석하는 중" className="flex items-center gap-1 text-[11px] font-bold text-[#b04a5a]">
    <svg viewBox="0 0 40 36" width="34" height="30" aria-hidden="true" className="wb-robot">
      <line x1="20" y1="3" x2="20" y2="8" stroke="#8b2f40" strokeWidth="1.6" /><circle cx="20" cy="3" r="2.2" className="wb-robot-light" />
      <rect x="9" y="8" width="22" height="15" rx="5" fill="#fde3e6" stroke="#8b2f40" strokeWidth="1.6" />
      <circle cx="16" cy="15.5" r="2" fill="#8b2f40" className="wb-robot-eye" /><circle cx="24" cy="15.5" r="2" fill="#8b2f40" className="wb-robot-eye" />
      <rect x="6" y="25" width="28" height="8" rx="2" fill="#fff" stroke="#8b2f40" strokeWidth="1.4" />
      <path d="M9 28 h4 M15 28 h4 M21 28 h4 M27 28 h4 M11 31 h18" stroke="#e0587a" strokeWidth="1.2" />
      <rect x="10" y="22" width="4" height="5" rx="1.5" fill="#8b2f40" className="wb-robot-hand" /><rect x="26" y="22" width="4" height="5" rx="1.5" fill="#8b2f40" className="wb-robot-hand is-right" />
    </svg>
    <span className="wb-dots">해석 중</span>
  </span>;
}
