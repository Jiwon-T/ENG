// 과제·보강 알림 2단계: the 반영 확인 창's '학생에게 알림 보내기'. Shown only when the lesson has a 과제; on by default for a
// first 반영 or a 과제 that changed since the last 반영 (draft.publishedAssignment), off when it is the same. The teacher's
// choice is sent with the 반영 and the server sends it at once (no quiet hours).
export type LessonPushKind = 'new' | 'changed' | 'again';
export const LESSON_PUSH_TITLE: Record<LessonPushKind, string> = { new: '새 과제가 있어요', changed: '과제가 바뀌었어요', again: '과제를 다시 확인해 주세요' };
export const isLessonPushKind = (v: unknown): v is LessonPushKind => v === 'new' || v === 'changed' || v === 'again';

/** What the checkbox says and whether it starts on; null when there is no 과제 (no checkbox). */
export function lessonPushChoice(data: any, record?: any): { kind: LessonPushKind; on: boolean; hint: string } | null {
  const now = String(data?.assignment || '').trim();
  if (!now) return null;
  const published = Boolean(record && (record.stage === 'published' || record.appPublishedRevision != null || typeof record.publishedAssignment === 'string'));
  if (!published) return { kind: 'new', on: true, hint: `"${LESSON_PUSH_TITLE.new}"` };
  // Published before the 과제 was kept with it: unknown whether it changed, so off until the teacher says.
  if (typeof record.publishedAssignment !== 'string') return { kind: 'changed', on: false, hint: `"${LESSON_PUSH_TITLE.changed}" · 과제를 바꿨다면 켜세요` };
  return record.publishedAssignment.trim() === now ? { kind: 'again', on: false, hint: '과제가 그대로라 꺼 두었어요' }
    : { kind: 'changed', on: true, hint: `"${LESSON_PUSH_TITLE.changed}" · 오타만 고쳤다면 끄세요` };
}
/** "영어 10/21 수업 · 눌러서 확인": no 과제 text on the lock screen. */
export function lessonPushBody(data: any) {
  const date = String(data?.date || ''), day = /^\d{4}-\d{2}-\d{2}$/.test(date) ? `${Number(date.slice(5, 7))}/${Number(date.slice(8))} ` : '';
  return `${data?.subject ? data.subject + ' ' : ''}${day}수업 · 눌러서 확인`;
}
