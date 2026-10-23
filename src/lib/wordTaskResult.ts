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
