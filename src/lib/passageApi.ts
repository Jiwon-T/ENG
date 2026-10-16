// 지문 분석기 (browser): calls /api/gemini?task=passage. Shapes match api/_lib/passage.ts.
import { auth } from './firebase';

export interface Person { uid: string; name: string; role: string }
export interface ReadingPart { sentences: { chunks: { en: string; ko: string }[]; ko: string }[]; by?: Person; at?: number; editedBy?: Person; editedAt?: number }
export interface GrammarPart { sentences: { structure: string; points: string[] }[]; essay: { index: number; reason: string }; by?: Person; at?: number; editedBy?: Person; editedAt?: number }
export interface SummaryPart { title: string; englishTitle: string; topic: { ko: string; en: string }; mainIdea: { ko: string; en: string }; summary: { ko: string; en: string }; logic: string; by?: Person; at?: number; editedBy?: Person; editedAt?: number }
export interface WordsPart { known: { word: string; meaning: string; seen: string }[]; unknown: string[] }
export interface Passage {
  id: string; text: string; sentences: string[]; hints: string[][]; title: string; examInfo: string; public: boolean; updatedAt: number;
  parts: { reading?: ReadingPart; grammar?: GrammarPart; summary?: SummaryPart; words?: WordsPart };
  /** Teachers and the admin only. */
  createdBy?: Person & { at: number }; history?: (Person & { at: number; action: string })[];
}
export interface PassageRow { id: string; title: string; examInfo: string; first: string; public: boolean; parts: string[]; updatedAt: number; analysedAt?: number; createdBy?: Person & { at: number } | null; lastChange?: (Person & { at: number; action: string }) | null }
export type PassagePartName = 'reading' | 'grammar' | 'summary';

export async function passageCall<T = any>(action: string, body: Record<string, unknown> = {}): Promise<T> {
  const token = await auth.currentUser?.getIdToken();
  const r = await fetch('/api/gemini?task=passage', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ action, ...body }) });
  const data = await r.json().catch(() => ({}));
  if (!r.ok || !data?.ok) throw Error(data?.message || '잠시 후 다시 해 주세요.');
  return data;
}
export const isStaffView = (p: Passage) => Array.isArray(p.history);
export const shortDate = (at?: number) => at ? new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric' }).format(new Date(at)) : '';
export const roleName = (role?: string) => role === 'student' ? '학생' : role === 'teacher' ? '선생님' : role === 'principal' ? '원장' : role === 'admin' ? '관리자' : '';
