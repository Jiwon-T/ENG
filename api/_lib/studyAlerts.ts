// 학생 학습 알림 (선생님 › 내 메뉴): each teacher turns it on for their own account (모바일만 or 모든 기기). When a student
// finishes one study in the app (a studySessions record), the student's app pings the server (/api/student/study-done)
// and every teacher of that student who has it on gets an app alert on the devices they turned 알림 on. The record is
// marked once sent, so a ping sent twice alerts once. 원정대 과제 games are alerted by the server itself (each game and
// the task done); 탑·먹이·원정대 games only to teachers who also ticked 펫 게임 기록도 (off by default). A failed send never
// shows to the student.
import { z } from 'zod';
import { readStudentMapping } from './studentIdentity.js';
import { pushTokensOf } from './pushTokens.js';
import { sendToTokens } from './pushSend.js';

export const STUDY_ALERTS = 'teacherStudyAlerts';
export interface StudyAlertSetting { on: boolean; mobileOnly: boolean; games: boolean }
const DEFAULT: StudyAlertSetting = { on: false, mobileOnly: true, games: false };
const RECENT_MS = 15 * 60_000;

function teacherOf(actor: any) { if (!actor?.uid || !(actor.admin || actor.principal || actor.scopes)) throw Error('FORBIDDEN'); return actor.uid as string; }
export async function readStudyAlert(db: any, actor: any): Promise<StudyAlertSetting> {
  const d = (await db.collection(STUDY_ALERTS).doc(teacherOf(actor)).get()).data();
  return { on: d?.on === true, mobileOnly: d?.mobileOnly !== false, games: d?.games === true };
}
export async function saveStudyAlert(db: any, actor: any, raw: unknown, now = Date.now()): Promise<StudyAlertSetting> {
  const v = z.object({ on: z.boolean(), mobileOnly: z.boolean(), games: z.boolean().default(false) }).strict().parse(raw);
  await db.collection(STUDY_ALERTS).doc(teacherOf(actor)).set({ ...v, updatedAt: now });
  return v;
}

const TYPE: Record<string, string> = { quiz: '단어 퀴즈', flashcard: '단어 암기', match: '짝 맞추기', conjugation: '동사 변화', test: '단어 테스트' };
const CATEGORY: Record<string, string> = { grammar: '문법', exam: '시험 대비' };
const shortName = (name: string) => String(name || '').replace(/\s*\([^()]*\)\s*$/, '').trim() || '학생';
/** "📱 김연우 · 단어 테스트" / "수능 필수 2000 · Day 3–4 · 18/20 (90점) · 6분" */
export function studyAlertText(name: string, s: any, mobile: boolean) {
  const kind = [CATEGORY[s.category], TYPE[s.type] || '학습'].filter(Boolean).join(' ');
  const days = typeof s.dayStart === 'number' ? ` · Day ${s.dayStart}${typeof s.dayEnd === 'number' && s.dayEnd !== s.dayStart ? `–${s.dayEnd}` : ''}` : '';
  const total = Number(s.totalItems) || 0, score = total > 0 && s.type !== 'flashcard' ? ` · ${Number(s.score) || 0}/${total} (${Math.round((Number(s.score) || 0) / total * 100)}점)` : '';
  const minutes = Math.max(1, Math.round((Number(s.duration) || 0) / 60));
  return { title: `${mobile ? '📱' : '💻'} ${shortName(name)} · ${kind}`, body: `${String(s.wordbookTitle || '단어장').slice(0, 40)}${days}${score} · ${minutes}분` };
}

/** The teachers of a student: teacher access (not disabled) whose scopes name the student. */
async function teachersOf(db: any, studentKey: string): Promise<string[]> {
  const key = studentKey.toLowerCase();
  return (await db.collection('teacherWorkspaceAccess').get()).docs.filter((d: any) => {
    const p = d.data(); return !p.disabled && [...(p.scopes || []), ...(p.teachingScopes || [])].some((s: any) => String(s?.studentKey || '').toLowerCase() === key);
  }).map((d: any) => d.id);
}

export type AlertDevice = 'mobile' | 'pc';
export const alertDevice = (v: unknown): AlertDevice => v === 'mobile' ? 'mobile' : 'pc';
/** To the student's teachers who turned it on (and, for a pet game, ticked 펫 게임 기록도). `text(name)`: the alert for the
 *  student's name. Returns how many devices got it. */
export async function alertTeachers(db: any, uid: string, text: (name: string) => { title: string; body: string }, opts: { device: AlertDevice; tag: string; game?: boolean; messaging?: any }): Promise<number> {
  const studentKey = String((await db.collection('users').doc(uid).get()).data()?.notionStudentKey || '');
  if (!studentKey) return 0;
  const teachers = await teachersOf(db, studentKey);
  if (!teachers.length) return 0;
  const mapping: any = await readStudentMapping(db, studentKey).catch(() => null), msg = text(shortName(mapping?.studentDisplayName || ''));
  let sent = 0;
  for (const t of teachers) {
    const setting = { ...DEFAULT, ...((await db.collection(STUDY_ALERTS).doc(t).get()).data() || {}) };
    if (setting.on !== true || (setting.mobileOnly !== false && opts.device !== 'mobile') || (opts.game && setting.games !== true)) continue;
    sent += await sendToTokens(db, await pushTokensOf(db, t), { ...msg, tag: opts.tag, link: `/?study=${encodeURIComponent(studentKey)}` }, opts.messaging).catch(() => 0);
  }
  return sent;
}
const icon = (device: AlertDevice) => device === 'mobile' ? '📱' : '💻';
const minutesOf = (ms: number) => `${Math.max(1, Math.round(ms / 60_000))}분`;
const dayText = (start: number, end: number) => `Day ${start}${end !== start ? `–${end}` : ''}`;
/** 원정대 과제: one game ended ("이번 판 5/6 · 과제 8/12 맞힘"), or the task done (every word right). */
export function taskAlertText(name: string, t: { bookTitle: string; startDay: number; endDay: number; total: number; mastered: number }, game: { right: number; asked: number; ms: number } | null, done: boolean, device: AlertDevice) {
  return done
    ? { title: `✅ ${name} · 원정대 단어 과제 완료`, body: `${String(t.bookTitle).slice(0, 40)} · ${dayText(t.startDay, t.endDay)} · ${t.total}단어 다 맞힘` }
    : { title: `${icon(device)} ${name} · 원정대 단어 과제`, body: `${String(t.bookTitle).slice(0, 40)} · ${dayText(t.startDay, t.endDay)}${game ? ` · 이번 판 ${game.right}/${game.asked}` : ''} · 과제 ${t.mastered}/${t.total} 맞힘${game ? ` · ${minutesOf(game.ms)}` : ''}` };
}
/** 펫 게임 (탑, 단어 먹이, 원정대 스테이지): what was played, how many right, how long. */
export function gameAlertText(name: string, game: { kind: string; detail?: string; right: number; asked: number; ms: number }, device: AlertDevice) {
  return { title: `${icon(device)} ${name} · ${game.kind}`, body: `${game.detail ? `${String(game.detail).slice(0, 40)} · ` : ''}${game.right}/${game.asked} · ${minutesOf(game.ms)}` };
}

const pingInput = z.object({ id: z.string().min(1).max(200), device: z.enum(['mobile', 'pc']) }).strict();
/** The student finished one study (`id`: their studySessions record). Returns how many devices got it. */
export async function studyDoneAlert(db: any, uid: string, raw: unknown, now = Date.now(), messaging?: any): Promise<{ sent: number }> {
  const v = pingInput.parse(raw), ref = db.collection('studySessions').doc(v.id);
  const session = await db.runTransaction(async (tx: any) => {
    const s = (await tx.get(ref)).data();
    const at = typeof s?.createdAt?.toMillis === 'function' ? s.createdAt.toMillis() : Number(s?.createdAt) || 0;
    if (!s || s.uid !== uid || s.teacherAlertedAt || now - at > RECENT_MS) return null;
    tx.set(ref, { ...s, teacherAlertedAt: now, device: v.device });
    return s;
  });
  if (!session) return { sent: 0 };
  return { sent: await alertTeachers(db, uid, name => studyAlertText(name, session, v.device === 'mobile'), { device: v.device, tag: `study-${v.id}`, messaging }) };
}
