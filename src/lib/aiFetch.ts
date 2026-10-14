import { auth } from './firebase';
/** Call the Gemini proxy as the signed-in account (it refuses calls without a login and counts a daily limit). */
export async function aiFetch(body: unknown) {
  const token = await auth.currentUser?.getIdToken();
  return fetch('/api/gemini', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) });
}
