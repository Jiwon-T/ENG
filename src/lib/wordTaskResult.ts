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
