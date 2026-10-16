import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { PetCharacter } from './PetCharacters';
import { SCENE, SceneArt } from './PetScenes';
import { MedalLayer } from './PetCoupon';
import AdventureNames, { type NamesView } from './AdventureNames';
import { PET_JOBS, petStage, type PetJob } from '../../lib/petCatalog';

// 순위: 모험가 (each pet) and 원정대 (each student), every academy together, by 원정대 이름·모험가 별칭 only. A row opens that
// pet's room (outfit, background, 금메달) to look at. Teachers can switch their own pets in ('선생님 포함').
type Send = (action: string, payload?: Record<string, unknown>) => Promise<any>;
interface Look { character: string; level: number; clothing: string | null; accessories: string[] }
interface RankRow { rank: number; id: number; label: string; sub: string; job: PetJob | null; value: number; stars: number; looks: Look[]; teacher: boolean; me: boolean }
interface Ranking { at: number; kind: 'pet' | 'guild'; teacherView: boolean; withTeachers: boolean; total: number; rows: RankRow[]; mine: RankRow[] }
interface Profile { label: string; guild: string; name: string; character: string; level: number; job: PetJob | null; clothing: string | null; accessories: string[]; background: string; decor: { id: string; x: number; y: number }[]; medals: number; best: number; stars: number; me: boolean }

const MEDAL = ['#ef9f27', '#b4b2a9', '#d85a30'];
const Portrait = ({ look, size = 30 }: { key?: number; look: Look; size?: number }) => <span className="inline-flex flex-none items-center justify-center overflow-hidden rounded-full border border-[#e4e0f5] bg-[#f7f6fd]" style={{ width: size, height: size }}><PetCharacter character={look.character} stage={petStage(look.level)} clothing={look.clothing} accessory={look.accessories} portrait size={size - 2} /></span>;

function Row({ r, onOpen }: { key?: string; r: RankRow; onOpen: () => void }) {
  return <button type="button" onClick={onOpen} className={`flex w-full items-center gap-2.5 border-t border-[#f1eff8] px-2 py-2 text-left first:border-t-0 ${r.me ? 'rounded-xl bg-[#fffaf0]' : ''}`}>
    <span className="w-6 flex-none text-center text-sm font-black" style={{ color: r.rank <= 3 ? MEDAL[r.rank - 1] : '#94a3b8' }}>{r.rank}</span>
    <span className="flex flex-none -space-x-2">{r.looks.map((l, i) => <Portrait key={i} look={l} />)}</span>
    <span className="min-w-0 flex-1"><b className="block truncate text-sm font-black text-[#26215c]">{r.label}{r.me && <span className="ml-1 rounded bg-[#ef9f27] px-1 text-[10px] font-bold text-white">나</span>}{r.teacher && <span className="ml-1 rounded bg-[#3c3489] px-1 text-[10px] font-bold text-white">선생님</span>}</b>
      <span className="block truncate text-[11px] text-slate-500">{r.sub}{r.job ? ` · ${PET_JOBS[r.job]?.label || ''}` : ''}</span></span>
    <span className="flex-none text-right"><b className="block text-sm font-black text-[#3c3489]">{r.value}층</b><span className="text-[10px] text-[#854f0b]">★ {r.stars}</span></span>
  </button>;
}

function Room({ p, onClose }: { p: Profile; onClose: () => void }) {
  return <div className="fixed inset-0 z-[88] flex items-center justify-center bg-slate-900/50 p-4" onClick={e => { e.stopPropagation(); onClose(); }}>
    <section role="dialog" aria-modal="true" aria-label={`${p.label}의 방`} className="w-full max-w-xs overflow-hidden rounded-3xl bg-white" onClick={e => e.stopPropagation()}>
      <div className={`relative flex h-48 items-end justify-center ${SCENE[p.background] || SCENE.default}`}>
        <SceneArt id={p.background} />
        <MedalLayer spots={p.decor} editing={false} onMove={() => undefined} />
        <div className="relative z-10 mb-2"><PetCharacter character={p.character} stage={petStage(p.level)} clothing={p.clothing} accessory={p.accessories} size={96} /></div>
        <button type="button" onClick={onClose} aria-label="닫기" className="absolute right-2 top-2 z-20 rounded-full bg-white/90 p-1 text-slate-500"><X size={16} aria-hidden="true" /></button>
      </div>
      <div className="px-4 pb-4 pt-3">
        <b className="block text-base font-black text-[#26215c]">{p.label}{p.me && <span className="ml-1 rounded bg-[#ef9f27] px-1 text-[10px] font-bold text-white">나</span>}</b>
        <span className="text-xs text-slate-500">{p.guild} · Lv.{p.level}{p.job ? ` · ${PET_JOBS[p.job]?.label || ''}` : ''}</span>
        <div className="mt-2 flex flex-wrap gap-1.5 text-[11px]">{[`탑 ${p.best}층`, `원정대 별 ${p.stars}`, `금메달 ${p.medals}`].map(t => <span key={t} className="rounded-lg border border-[#e4e0f5] px-2 py-0.5 text-[#3c3489]">{t}</span>)}</div>
      </div>
    </section>
  </div>;
}

export default function PetRanking({ send, onClose }: { send: Send; onClose: () => void }) {
  const [kind, setKind] = useState<'pet' | 'guild'>('pet'), [teachers, setTeachers] = useState(false);
  const [ranking, setRanking] = useState<Ranking | null>(null), [notice, setNotice] = useState(''), [profile, setProfile] = useState<Profile | null>(null), [names, setNames] = useState<NamesView | null>(null);
  const load = () => { setNotice(''); send('rank-board', { kind, teachers }).then(r => setRanking(r.ranking)).catch(e => setNotice(e?.message || '순위를 불러오지 못했어요.')); };
  useEffect(load, [kind, teachers]); // eslint-disable-line react-hooks/exhaustive-deps
  const open = (r: RankRow) => send('rank-profile', { at: ranking?.at, id: r.id, kind, teachers }).then(x => setProfile(x.profile)).catch(e => { setNotice(e?.message || '잠시 후 다시 해 주세요.'); if (e?.code === 'RANK_STALE') load(); });
  const openNames = () => send('guild-state').then(r => setNames(r.guild?.names || null)).catch(e => setNotice(e?.message || '잠시 후 다시 해 주세요.'));
  return <div className="fixed inset-0 z-[85] flex items-end justify-center bg-slate-900/40 sm:items-center sm:p-4" onClick={onClose}>
    <section role="dialog" aria-modal="true" aria-labelledby="pet-ranking-title" className="flex max-h-[90vh] w-full max-w-md flex-col rounded-t-3xl bg-white sm:rounded-3xl" onClick={e => e.stopPropagation()}>
      <header className="flex items-center gap-2 px-4 pt-3">
        <h2 id="pet-ranking-title" className="text-base font-black text-[#26215c]">🏅 순위</h2>
        <button type="button" onClick={() => void openNames()} className="ml-auto rounded-lg border border-[#e4e0f5] px-2 py-1 text-[11px] font-bold text-[#3c3489]">내 이름 정하기</button>
        <button type="button" onClick={onClose} aria-label="닫기" className="rounded-full p-1 text-slate-400 hover:bg-slate-100"><X size={18} aria-hidden="true" /></button>
      </header>
      <div className="flex items-center gap-1.5 px-4 pt-2">
        <div role="tablist" aria-label="순위 종류" className="flex gap-1 rounded-full bg-[#f4f2fc] p-0.5">{([['pet', '모험가'], ['guild', '원정대']] as const).map(([id, label]) => <button key={id} type="button" role="tab" aria-selected={kind === id} onClick={() => setKind(id)} className={`rounded-full px-3 py-1 text-xs font-bold ${kind === id ? 'bg-white text-[#3c3489] shadow-sm' : 'text-slate-500'}`}>{label}</button>)}</div>
        {ranking?.teacherView && <button type="button" aria-pressed={teachers} onClick={() => setTeachers(!teachers)} className={`ml-auto rounded-full border px-2.5 py-1 text-[11px] font-bold ${teachers ? 'border-[#3c3489] bg-[#3c3489] text-white' : 'border-[#cecbf6] text-[#3c3489]'}`}>선생님 포함</button>}
      </div>
      <p className="px-4 pt-1.5 text-[11px] text-slate-500">{kind === 'pet' ? '펫마다 · 탑 최고 층 → 원정대 별 → 레벨' : '학생마다 · 펫들의 탑 최고 층을 모두 더해요'} · 모든 학원 함께 · 10분마다 새로 계산해요</p>
      {notice && <p role="alert" className="px-4 pt-1 text-xs font-bold text-[#b04a5a]">{notice}</p>}
      <div className="mt-2 min-h-0 flex-1 overflow-y-auto px-3 pb-4">
        {!ranking ? <p role="status" className="py-8 text-center text-sm text-slate-500">순위를 불러오는 중…</p>
          : !ranking.rows.length ? <p className="py-8 text-center text-sm text-slate-500">아직 순위에 오른 모험가가 없어요</p>
          : <>{ranking.rows.map(r => <Row key={`${r.rank}-${r.id}`} r={r} onOpen={() => void open(r)} />)}
            {ranking.mine.length > 0 && <><p className="py-1 text-center text-xs text-slate-300" aria-hidden="true">⋯</p>{ranking.mine.map(r => <Row key={`m${r.id}`} r={r} onOpen={() => void open(r)} />)}</>}
            <p className="pt-2 text-center text-[10px] text-slate-400">모두 {ranking.total}{kind === 'pet' ? '마리' : '팀'} · 줄을 누르면 그 펫의 방을 볼 수 있어요</p></>}
      </div>
    </section>
    {profile && <Room p={profile} onClose={() => setProfile(null)} />}
    {names && <AdventureNames names={names} send={send} onSaved={r => { if (r.guild?.names) setNames(r.guild.names); }} onClose={() => { setNames(null); load(); }} />}
  </div>;
}
