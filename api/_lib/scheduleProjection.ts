import { createHash } from 'node:crypto';
import { normalizeNotionPageId as uuid } from './notionPageId.js';
// Schedule report IDs: app schedules publish under the same deterministic IDs the old Make projection used.
export const scheduleSourceKey = (id: string) => createHash('sha256').update(uuid(id)).digest('hex');
export function generateScheduleDocId(id: string, student: string) { return createHash('sha256').update(`${uuid(id)}:${student}`).digest('hex').slice(0, 32); }
