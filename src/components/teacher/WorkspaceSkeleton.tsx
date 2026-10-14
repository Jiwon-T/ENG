/** 선생님방 first load: the page outline (title, a toolbar, rows) while the server answers, instead of a line of text. */
export default function WorkspaceSkeleton() {
  const bar = 'rounded-lg bg-[#f6e9eb]';
  return <div className="panel animate-pulse motion-reduce:animate-none" role="status" aria-label="선생님방을 불러오는 중">
    <span className="sr-only">선생님방을 불러오는 중…</span>
    <div className="flex items-center justify-between gap-3"><div className={`${bar} h-5 w-32`} /><div className={`${bar} h-8 w-24`} /></div>
    <div className="mt-4 flex gap-2">{[0, 1, 2, 3].map(i => <div key={i} className={`${bar} h-7 w-16`} />)}</div>
    <div className="mt-4 space-y-2">{[0, 1, 2, 3, 4].map(i => <div key={i} className="flex items-center gap-3 rounded-xl border border-[#f3e6e8] p-3"><div className="h-8 w-8 flex-none rounded-full bg-[#f6e9eb]" /><div className="flex-1 space-y-1.5"><div className={`${bar} h-3.5 w-1/3`} /><div className={`${bar} h-3 w-1/2`} /></div></div>)}</div>
  </div>;
}
