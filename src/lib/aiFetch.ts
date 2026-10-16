import { auth } from './firebase';
/** Call the Gemini proxy as the signed-in account (it refuses calls without a login and counts a daily limit). */
export async function aiFetch(body: unknown) {
  const token = await auth.currentUser?.getIdToken();
  return fetch('/api/gemini', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) });
}

/**
 * The same call with the model's thinking streamed (NDJSON lines): `onThought` gets each thought summary as it comes.
 * Resolves with the answer text and the calls left this month (null = no limit); throws with a message to show.
 */
export async function aiStream(body: unknown, task: 'analyzer' | 'generator', onThought: (text: string) => void): Promise<{ text: string; left: number | null }> {
  const token = await auth.currentUser?.getIdToken();
  const res = await fetch(`/api/gemini?task=${task}&stream=1`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) });
  if (!res.ok || !res.body) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || (res.status === 503 ? '현재 AI 서비스 이용자가 많습니다. 잠시 후 다시 시도해주세요.' : 'AI 호출에 실패했어요. 잠시 후 다시 해 주세요.'));
  }
  const reader = res.body.getReader(), decoder = new TextDecoder();
  let buffer = '', done: { text: string; left: number | null } | null = null, error = '';
  const handle = (line: string) => {
    if (!line.trim()) return;
    let x: any; try { x = JSON.parse(line); } catch { return; }
    if (x.t === 'thought') onThought(String(x.text || ''));
    else if (x.t === 'done') done = { text: String(x.text || ''), left: typeof x.left === 'number' ? x.left : null };
    else if (x.t === 'error') error = x.code === 'AI_BUSY' ? '현재 AI 서비스 이용자가 많습니다. 잠시 후 다시 시도해주세요.' : 'AI가 답을 끝내지 못했어요. 잠시 후 다시 해 주세요.';
  };
  for (;;) {
    const { value, done: end } = await reader.read();
    if (value) { buffer += decoder.decode(value, { stream: true }); const lines = buffer.split('\n'); buffer = lines.pop() || ''; lines.forEach(handle); }
    if (end) break;
  }
  handle(buffer);
  if (error) throw new Error(error);
  if (!done) throw new Error('AI 응답이 중간에 끊겼어요. 다시 해 주세요.');
  return done;
}
