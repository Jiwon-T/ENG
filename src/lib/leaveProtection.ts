import {useEffect} from 'react';
// Closing or reloading the browser tab with unsaved input: the browser asks first (its own dialog; the text
// cannot be changed). Every screen with unsaved input calls useLeaveProtection(dirty); the listener stays
// while at least one of them is dirty.
let active = 0;
const onBeforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
export function protectLeave(): () => void {
 if (typeof window === 'undefined') return () => {};
 if (active++ === 0) window.addEventListener('beforeunload', onBeforeUnload);
 let released = false;
 return () => { if (released) return; released = true; if (--active === 0) window.removeEventListener('beforeunload', onBeforeUnload); };
}
export const leaveProtectionCount = () => active;
export function useLeaveProtection(dirty: boolean) {
 useEffect(() => dirty ? protectLeave() : undefined, [dirty]);
}
