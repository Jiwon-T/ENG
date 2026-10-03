import { safeFetchJson } from './safeFetchJson';

// Memory only, partitioned by signed-in user; rejected requests are never cached.
export function createReportCache(now = Date.now, ttl = 30000) {
  const entries = new Map<string, { value?: any; expires: number; pending?: Promise<any> }>();
  return {
    read<T>(uid: string, resource: string, fetcher: () => Promise<T>): Promise<T> {
      const key = `${uid}:${resource}`, old = entries.get(key);
      if (old?.pending) return old.pending;
      if (old && old.expires > now()) return Promise.resolve(old.value);
      const entry: { value?: T; expires: number; pending?: Promise<T> } = { expires: 0 };
      entry.pending = fetcher().then(value => {
        if (entries.get(key) === entry) { entry.value = value; entry.expires = now() + ttl; entry.pending = undefined; }
        return value;
      }, error => { if (entries.get(key) === entry) entries.delete(key); throw error; });
      entries.set(key, entry);
      return entry.pending;
    },
    invalidate(uid?: string) { for (const key of entries.keys()) if (!uid || key.startsWith(`${uid}:`)) entries.delete(key); },
  };
}
export const studentReportCache = createReportCache();
export function loadStudentResource<T>(uid: string, resource: 'lesson-reports' | 'schedules', token: () => Promise<string>): Promise<T> {
  return studentReportCache.read(uid, resource, async () => {
    const result = await safeFetchJson<T>(`/api/student/${resource}`, { headers: { Authorization: `Bearer ${await token()}` } });
    if (!result.ok || !result.data) throw new Error('불러오지 못했습니다. 다시 시도해 주세요.');
    return result.data;
  });
}
