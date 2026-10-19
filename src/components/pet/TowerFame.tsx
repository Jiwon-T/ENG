import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { PetService } from '../../lib/petService';
import { PET_JOBS, accessorySlot, petStage, towerGearFor, type PetGearView, type PetJob, type TowerGearSlot } from '../../lib/petCatalog';
import { PetCharacter } from './PetCharacters';
import { SCENE, SceneArt } from './PetScenes';
import { TowerGearIcon } from './TowerHall';

// 명예의 전당: every boss floor with the first clear and the win with the fewest attacks — all academies together. Each record
// shows the 원정대 nickname and the pet as it won: outfit, room background, tower gear (the weapon in its hand).
// A boss's name shows only to students who have beaten it ('???' before — the 도감 keeps monsters a mystery).
// Teachers can switch on '선생님 포함' to see the records with the teachers' wins too (students never see those).
interface HallPet { name: string; character: string; level: number; clothing: string | null; accessories: string[]; background: string; job: PetJob | null; gear: { slot: TowerGearSlot; id: string; level: number }[]; look?: PetGearView | null }
interface HallRecord { nickname: string; teacher?: boolean; pet: HallPet; attacks: number; at: number; me: boolean }
interface HallFloor { floor: number; /** null until the viewer has beaten this floor */ boss: string | null; first: HallRecord | null; fewest: HallRecord | null }
interface Hall { teacherView: boolean; withTeachers: boolean; floors: HallFloor[] }

const day = (at: number) => { const d = new Date(at + 9 * 3600_000); return `${d.getUTCMonth() + 1}/${d.getUTCDate()}`; }; // KST

function Record({ label, r }: { label: string; r: HallRecord | null }) {
  if (!r) return <div className="flex flex-col"><span className="text-[11px] font-bold text-slate-500">{label}</span><div className="mt-1 flex h-28 items-center justify-center rounded-xl border border-dashed border-[#e4e0f5] text-[11px] text-slate-400">아직 없어요</div></div>;
  const p = r.pet, weapon = p.gear.find(g => g.slot === 'weapon')?.id;
  const look = weapon ? [...p.accessories.filter(id => accessorySlot(id) !== 'hand'), weapon] : p.accessories;
  const job = p.job ? PET_JOBS[p.job]?.label : null;
  return <div className="flex min-w-0 flex-col">
    <span className="text-[11px] font-bold text-slate-500">{label}</span>
    <div className={`relative mt-1 flex h-28 items-end justify-center overflow-hidden rounded-xl ${SCENE[p.background] || SCENE.default} ${r.me ? 'ring-2 ring-[#ef9f27]' : ''}`}>
      <SceneArt id={p.background} />
      <div className="relative"><PetCharacter character={p.character} stage={petStage(p.level)} clothing={p.clothing} accessory={look} gear={p.look} size={74} /></div>
      {r.me && <span className="absolute left-1.5 top-1.5 rounded-md bg-[#ef9f27] px-1 text-[10px] font-black text-white">나</span>}
    </div>
    <b className="mt-1 truncate text-xs font-black text-[#26215c]">{r.teacher && r.nickname !== '선생님' && <span className="mr-1 rounded bg-[#3c3489] px-1 text-[10px] font-bold text-white">선생님</span>}{r.nickname}</b>
    <span className="truncate text-[11px] text-slate-600">{p.name} · Lv.{p.level}{job ? ` · ${job}` : ''}</span>
    <span className="text-[11px] text-[#633806]">공격 {r.attacks}번 · {day(r.at)}</span>
    {p.gear.length > 0 && <div className="mt-0.5 flex flex-wrap gap-0.5" aria-label="장비">{p.gear.map(g => { const gear = towerGearFor(g.id, p.job); return gear ? <span key={g.slot} title={`${gear.name}${g.level ? ` +${g.level}` : ''}`} className="flex items-center rounded-md bg-[#f7f6fd] px-0.5"><TowerGearIcon id={g.id} size={14} />{g.level > 0 && <span className="text-[9px] font-bold text-[#534ab7]">+{g.level}</span>}</span> : null; })}</div>}
  </div>;
}

export function TowerFame({ onClose }: { onClose: () => void }) {
  const [hall, setHall] = useState<Hall | null>(null), [error, setError] = useState(false), [teachers, setTeachers] = useState(false);
  useEffect(() => { setError(false); PetService.act('tower-hall', { teachers }).then((r: any) => setHall(r?.hall || null)).catch(() => setError(true)); }, [teachers]);
  return <div className="fixed inset-0 z-[90] flex items-end justify-center bg-slate-900/40 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="tower-fame-title" onClick={onClose}>
    <section className="max-h-[88vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-white px-4 pb-6 pt-3 sm:rounded-3xl" onClick={e => e.stopPropagation()}>
      <header className="flex items-center justify-between">
        <h2 id="tower-fame-title" className="text-base font-black text-[#633806]">🏆 명예의 전당</h2>
        <button type="button" onClick={onClose} aria-label="닫기" className="rounded-full p-1 text-slate-400 hover:bg-slate-100"><X size={18} aria-hidden="true" /></button>
      </header>
      <div className="mt-0.5 flex items-center justify-between gap-2"><p className="text-[11px] text-slate-500">모든 학원 학생이 함께 겨뤄요 · 원정대 이름·모험가 별칭과 펫으로 보여요</p>
        {hall?.teacherView && <button type="button" aria-pressed={teachers} onClick={() => setTeachers(!teachers)} className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-bold ${teachers ? 'border-[#3c3489] bg-[#3c3489] text-white' : 'border-[#cecbf6] text-[#3c3489]'}`}>선생님 포함</button>}</div>
      {hall?.withTeachers && <p className="mt-1 rounded-lg bg-[#eeedfe] px-2 py-1 text-[11px] text-[#3c3489]">선생님 기록까지 넣은 명예의 전당이에요. 학생들에게는 학생 기록만 보여요.</p>}
      {error ? <p role="alert" className="mt-6 text-center text-sm text-[#b04a5a]">명예의 전당을 불러오지 못했어요. 잠시 후 다시 열어 주세요.</p>
        : !hall ? <p role="status" className="mt-6 text-center text-sm text-slate-500">불러오는 중…</p>
        : <div className="mt-3 space-y-2.5">{hall.floors.map(f => <section key={f.floor} aria-label={`${f.floor}층`} className="rounded-2xl border border-[#e4e0f5] px-3 py-2.5">
          <b className="text-sm font-black text-[#3c3489]">{f.floor}층 <span className="font-bold text-slate-500">· {f.boss || '???'}</span></b>
          {f.first || f.fewest ? <div className="mt-1.5 grid grid-cols-2 gap-2.5"><Record label="🥇 처음 깬 모험가" r={f.first} /><Record label="⚡ 가장 적은 공격" r={f.fewest} /></div>
            : <p className="mt-0.5 text-[11px] text-slate-400">아직 아무도 깨지 못했어요 · 첫 번째 주인공이 되어 보세요!</p>}
        </section>)}</div>}
    </section>
  </div>;
}
