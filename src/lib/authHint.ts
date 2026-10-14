// Startup speed: whether this device was signed out the last time the app knew. When it was, the login screen is
// shown at once instead of waiting for Firebase to restore the session (a signed-in session still takes over as soon
// as Firebase reports it). Storage errors just mean "unknown" (wait as before).
const KEY = 'jt.auth.signedIn';
export function lastSignedOut(): boolean { try { return localStorage.getItem(KEY) === '0'; } catch { return false; } }
export function rememberSignedIn(signedIn: boolean) { try { localStorage.setItem(KEY, signedIn ? '1' : '0'); } catch { /* unknown next time */ } }
/** Start downloading the login screen right away (in parallel with the app), so it is ready when needed. */
export const loadLogin = () => import('../components/auth/Login');
