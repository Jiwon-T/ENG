// 단어 과제 결과 (원정대 › 과제 판 끝): what the result screen says about the task.
export interface WordTaskProgress { title: string; total: number; mastered: number; completedAt: number | null }
export function wordTaskResult(task: WordTaskProgress | null | undefined) {
  const done = Boolean(task?.completedAt), total = task?.total || 0, mastered = Math.min(task?.mastered || 0, total);
  return {
    heading: done ? '🎉 단어 과제 완료!' : '과제 한 판 끝!',
    line: !task ? '' : done ? '선생님이 정한 단어를 모두 맞혔어요!' : `과제 ${mastered} / ${total} 맞힘 · ${total - mastered}개 남았어요`,
    percent: total ? Math.round(mastered / total * 100) : 0,
    /** another game only while words are left */ more: Boolean(task) && !done,
    done,
  };
}
/** 단어 테스트 과제 (the test opened from the home): passed at the 통과 점수, else how many points are still missing. */
export function testTaskResult(percentage: number, passScore: number) {
  const passed = percentage >= passScore;
  return { passed, heading: passed ? '📝 단어 테스트 과제 통과!' : `과제 통과까지 ${passScore - percentage}점 더`, line: passed ? `통과 ${passScore}점 · 선생님께 완료로 보여요` : `통과 ${passScore}점 · 다시 도전해요` };
}
export interface TaskForTag { id: string; kind?: 'expedition' | 'test'; wordbookId: string; startDay: number; endDay: number; createdAt: number; total: number; mastered: number; passScore?: number | null }
export interface SessionForTag { type: string; wordbookId?: string; dayStart?: number | null; dayEnd?: number | null; createdAt: string | null; score?: number | null; totalItems?: number | null; source?: string; taskId?: string }
/** 학습 리포트 › 온라인 학습: a record that was a 단어 과제 — a 단어 테스트 of the task's range taken after it was given
 *  (passed at its 통과 점수, or how many points short), or a game of a 원정대 과제. null: an ordinary record. */
export function sessionTaskTag(s: SessionForTag, tasks: TaskForTag[]): { kind: 'test' | 'expedition'; passed: boolean; label: string } | null {
  if (s.source === 'word-task') {
    const t = tasks.find(x => x.id === s.taskId);
    return { kind: 'expedition', passed: Boolean(t && t.mastered >= t.total), label: t ? `원정대 과제 · 지금 ${Math.min(t.mastered, t.total)}/${t.total} 맞힘` : '원정대 과제' };
  }
  if (s.type !== 'test' || !s.wordbookId || !Number(s.totalItems)) return null;
  const at = Date.parse(String(s.createdAt || ''));
  const t = tasks.find(x => x.kind === 'test' && x.wordbookId === s.wordbookId && x.startDay === s.dayStart && x.endDay === (s.dayEnd ?? s.dayStart) && at >= x.createdAt);
  if (!t) return null;
  const pct = Math.round((Number(s.score) || 0) / Number(s.totalItems) * 100), pass = t.passScore ?? 90;
  return pct >= pass ? { kind: 'test', passed: true, label: '과제 · 통과' } : { kind: 'test', passed: false, label: `과제 · ${pct}점, ${pass - pct}점 부족` };
}
