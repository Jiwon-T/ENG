// Memory only: never persist student records in browser storage.
const entries = new Map<string, { at: number; value: any }>();
let account = '';
let generation=0;
export const teacherReadGeneration=()=>generation;
export function teacherCachedRead(uid: string, key: string) {
    if (account !== uid) { entries.clear(); account = uid;generation++; }
    const entry=entries.get(key);
    if(entry&&Date.now()-entry.at>300_000){entries.delete(key);return undefined;}
    return entry?.value;
}
export function teacherCacheRead(uid: string, key: string, value: any, expectedGeneration?:number) {
    if(expectedGeneration!==undefined&&expectedGeneration!==generation)return;
    teacherCachedRead(uid, key);
    if (entries.size >= 80) entries.delete(entries.keys().next().value!);
    entries.set(key, { at: Date.now(), value });
}
export function clearTeacherReads() { entries.clear(); account = '';generation++; }

export function invalidateTeacherReads(action:string) {
    const resources=action==='save-draft'||action==='publish'?['drafts-page:','academy-lessons:','["report"']:
        action==='save-academic'||action==='publish-academic'?['academic-records:','["report"']:
        action.includes('schedule')?['workspace:schedule','["report"']:null;
    if(!resources){clearTeacherReads();return;}
    generation++;for(const key of entries.keys())if(resources.some(prefix=>key.startsWith(prefix)))entries.delete(key);
}
