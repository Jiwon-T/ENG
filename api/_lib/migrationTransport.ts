/** Opt-in batch size for a dedicated local migration transport. Normal server callers keep their defaults. */
const sizes = new WeakMap<Function, number>();
export function configureMigrationBatch<T extends Function>(notion: T, size: number): T {
 if (!Number.isInteger(size) || size < 1 || size > 100) throw Error('INVALID_BATCH_SIZE');
 sizes.set(notion, size); return notion;
}
export function migrationBatchSize(notion: Function, fallback: number) { return sizes.get(notion) ?? fallback; }
export function migrationReadOnlyTransport(base: (path: string, method?: string, body?: any) => Promise<any>, intervalMs = 350) {
 let tail: Promise<any> = Promise.resolve(); let last = 0;
 return (path: string, method = 'GET', body?: any): Promise<any> => {
  if (method !== 'GET' && !(method === 'POST' && /^databases\/[^/]+\/query$/.test(path))) return Promise.reject(Error('NOTION_WRITE_DISABLED'));
  const request = tail.then(async () => {
   const delay = Math.max(0, intervalMs - (Date.now() - last));
   if (delay) await new Promise(resolve => setTimeout(resolve, delay));
   last = Date.now(); return base(path, method, body);
  }); tail = request.catch(() => {}); return request;
 };
}
