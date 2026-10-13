// A panel accepts navigation by calling leave() after its existing close checks.
// Rejected clicks must not remain queued and run on an unrelated later close.
// A close check may answer later (the app's confirm modal): the requested move is kept until that close
// settles, then dropped if it was not taken (cancelled, failed). While such a check is waiting, new moves are
// ignored: leave() cannot tell whose approval it is, so a late 'yes' must only ever belong to its own move.
export type PanelClose = () => void | Promise<unknown>;
export function createStudentDialogNavigation(onClose: () => void) {
 let guard: null | PanelClose = null, pending: null | { action: () => void } = null, checking: null | { action: () => void } = null;
 return {
  registerClose(close: PanelClose) { guard = close; return () => { if (guard === close) guard = null; }; },
  leave() { const entry = pending; pending = null; if (entry) entry.action(); else onClose(); },
  attempt(action: () => void, blocked = false): void | Promise<void> {
   if (blocked || checking) return;
   const entry = { action };
   pending = entry;
   const settle = () => { if (pending === entry) pending = null; if (checking === entry) checking = null; };
   let result: unknown;
   try { result = guard ? guard() : this.leave(); } catch (error) { settle(); throw error; }
   if (result && typeof (result as Promise<unknown>).then === 'function') { if (pending === entry) checking = entry; return Promise.resolve(result).then(settle, settle); }
   settle();
  },
 };
}
