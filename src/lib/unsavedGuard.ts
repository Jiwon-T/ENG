// Asks before a move would drop unsaved input. Cancel keeps the input and the current selection; confirm runs the
// move. The unsaved state is cleared only by the input itself (saved, emptied back, or gone from the screen), never
// by the question: a move that turns out to change nothing leaves the input and its protection in place.
// Used by the 학습 리포트 screen for the 학습 성취도 평가 box.
export function createUnsavedGuard(ask: (message: string) => boolean, message: string, onChange?: (dirty: boolean) => void) {
 let dirty = false;
 const guard = {
  get dirty() { return dirty; },
  mark(next: boolean) { if (next === dirty) return; dirty = next; onChange?.(next); },
  proceed(action: () => void) { if (dirty && !ask(message)) return false; action(); return true; },
 };
 return guard;
}
