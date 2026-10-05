// Private process-local snapshots. Authentication and current access checks run
// before lookup; scopes are part of every key. Never shared through HTTP caches.
export function createReadCache(ttl = 60_000, capacity = 80) {
    const entries = new Map<string, { expires: number; value: Promise<any> }>();
    return {
        get<T>(key: string, load: () => Promise<T>, force = false): Promise<T> {
            const old = entries.get(key);
            if (!force && old && old.expires > Date.now()) return old.value;
            if (entries.size >= capacity) entries.delete(entries.keys().next().value!);
            const entry = { expires: Date.now() + ttl, value: Promise.resolve().then(load) };
            entries.set(key, entry);
            entry.value.catch(() => { if (entries.get(key) === entry) entries.delete(key); });
            return entry.value;
        },
        invalidate(resource:string) { for(const key of entries.keys())if(key.endsWith(','+JSON.stringify(resource)+']'))entries.delete(key); },
        clear() { entries.clear(); },
    };
}
export const teacherReadCache = createReadCache();
export function teacherReadKey(actor: any, resource: string) {
    return JSON.stringify([actor.uid, actor.admin, actor.principal, actor.academyId, actor.scopes, actor.teachingScopes, actor.readAccessKey, resource]);
}
export function pageRows<T>(rows: T[], page: number, size: number) {
    const pages = Math.max(1, Math.ceil(rows.length / size));
    const current = Math.min(Math.max(1, page), pages);
    return { records: rows.slice((current - 1) * size, current * size), total: rows.length, page: current, pages };
}
export function pageNumber(value: unknown) {
    const number = Number(value || 1);
    if (!Number.isSafeInteger(number) || number < 1 || number > 100000) throw new Error('INVALID_INPUT');
    return number;
}

export function invalidateTeacherMutation(action:string) {
    if(action==='save-draft'){teacherReadCache.invalidate('previous-lessons-local');teacherReadCache.invalidate('draft-summaries');teacherReadCache.invalidate('academy-local');return;}
    if(action==='save-academic'){teacherReadCache.invalidate('academic-local');return;}
    if(action==='save-schedule'){return;}
    teacherReadCache.clear();
}
