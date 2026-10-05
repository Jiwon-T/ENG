// A panel accepts navigation by calling leave() after its existing close checks.
// Rejected clicks must not remain queued and run on an unrelated later close.
export function createStudentDialogNavigation(onClose: () => void) {
 let guard: null | (() => void) = null, pending: null | (() => void) = null;
 return {
  registerClose(close: () => void) { guard = close; return () => { if (guard === close) guard = null; }; },
  leave() { const action = pending; pending = null; if (action) action(); else onClose(); },
  attempt(action: () => void, blocked = false) { if (blocked) return; pending = action; try { if (guard) guard(); else this.leave(); } finally { pending = null; } },
 };
}
