export interface RecentLearning { wordbookId: string; title: string; category: 'word' | 'grammar' | 'exam'; chunk: number; unitSize: number; }
export function readRecentLearning(uid: string): RecentLearning | null {
  try {
    const value = JSON.parse(localStorage.getItem(`recent-learning:${uid}`) || 'null');
    if (!value || typeof value.wordbookId !== 'string' || !value.wordbookId || typeof value.title !== 'string' || !['word', 'grammar', 'exam'].includes(value.category) || !Number.isInteger(value.chunk) || value.chunk < 0 || ![10, 20, 30, 40, 50, 100].includes(value.unitSize)) return null;
    return value;
  } catch { return null; }
}
export function saveRecentLearning(uid: string, value: RecentLearning) {
  try { localStorage.setItem(`recent-learning:${uid}`, JSON.stringify(value)); } catch { /* Storage is optional. */ }
}
