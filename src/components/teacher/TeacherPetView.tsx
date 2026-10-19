import { useEffect, useState } from 'react';
import { PetCharacter } from '../pet/PetCharacters';
import { SCENE, STARS, SceneArt } from '../pet/PetScenes';
import { ACCESSORY_SLOTS, PET_JOB2, PET_JOBS, petJobLabel, PET_MAX_LEVEL, petItem, petStageLabel, petStage, wornAccessories, xpNeeded, type PetJob, type PetJob2, type PetGearView } from '../../lib/petCatalog';
import WorkspaceDialog from './WorkspaceDialog';

// 펫 보기 (선생님방 › 학생 관리): the student's pet screen as the student sees it — the room, the pet, level, energy,
// points, wardrobe and expedition — but read only. Own students for a teacher, the academy for a principal, all for the admin.
interface PetSlot { slot: number; character: string; name: string; level: number; xp: number; energy: number; maxEnergy: number; clothing: string | null; accessories?: Record<string, string>; job?: PetJob | null; job2?: PetJob2 | null; gear?: PetGearView | null }
interface PetView {
  points: number; inventory: string[]; background: string; currentPetSlot: number; pets: PetSlot[]; today: { studyPoints: number; studyCap: number };
  nickname: string; rewards: { attendance: number; assignment: number };
  expeditions: Record<string, { current: string; allCleared: boolean; currentNeedsLevel: number | null; totalStars: number; maxStars: number; chapters: { id: string; title: string }[] }>;
}
const won = (n: number) => n.toLocaleString('ko-KR');
const CATEGORY: Record<string, string> = { clothing: '옷', accessory: '소품', background: '배경' };

export default function TeacherPetView({ studentKey, name, request, onClose }: { studentKey: string; name: string; request: (action?: string, body?: any) => Promise<any>; onClose: () => void }) {
  const [view, setView] = useState<PetView | null | undefined>(undefined), [error, setError] = useState(''), [slot, setSlot] = useState<number | null>(null);
  useEffect(() => { let live = true; request('read:student-pet', { studentKey }).then(r => { if (live) setView(r.pet || null); }).catch(e => { if (live) setError(e?.message || '펫 정보를 불러오지 못했어요.'); }); return () => { live = false; }; }, [studentKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const pet = view ? view.pets.find(p => p.slot === (slot ?? view.currentPetSlot)) || view.pets[0] : null;
  return <WorkspaceDialog open title={`${name} 학생의 펫`} onClose={onClose}>
    {error ? <p role="alert" className="text-sm text-[#b04a5a]">{error}</p>
      : view === undefined ? <p role="status" className="text-sm text-slate-500">펫 정보를 불러오는 중…</p>
      : !view || !pet ? <p className="rounded-2xl bg-[#fdf6f7] px-4 py-6 text-center text-sm text-slate-500">아직 펫을 키우지 않았거나, 앱 계정이 연결되지 않은 학생이에요.</p>
      : (() => {
        const stage = petStage(pet.level), atMax = pet.level >= PET_MAX_LEVEL, need = xpNeeded(pet.level), main = pet.slot === view.currentPetSlot;
        const exp = view.expeditions[pet.slot] || { current: '', allCleared: false, currentNeedsLevel: null, totalStars: 0, maxStars: 0, chapters: [] }, chapter = exp.chapters.find(c => exp.current.startsWith(c.id + '-')), step = Number(exp.current.split('-')[1]);
        const owned = view.inventory.map(id => petItem(id)).filter(Boolean) as NonNullable<ReturnType<typeof petItem>>[];
        const worn = new Set([pet.clothing, ...wornAccessories(pet), view.background].filter(Boolean) as string[]);
        return <div className="space-y-3 text-[#5e1e2a]">
          {view.pets.length > 1 && <div role="tablist" aria-label="펫" className="flex gap-2 overflow-x-auto">{view.pets.map(p => <button key={p.slot} type="button" role="tab" aria-selected={p.slot === pet.slot} onClick={() => setSlot(p.slot)} className={`flex flex-none flex-col items-center rounded-2xl border px-2 py-1 text-[11px] font-bold ${p.slot === pet.slot ? 'border-[#d26272] bg-[#fef2f3]' : 'border-[#f3e6e8] bg-white'}`}><span className="h-9 w-9 overflow-hidden"><PetCharacter character={p.character} stage={petStage(p.level)} accessory={wornAccessories(p)} gear={p.gear} portrait size={36} /></span>{p.name}</button>)}</div>}
          <section aria-label="펫" className="overflow-hidden rounded-3xl border border-[#f3e6e8]">
            <div className={`relative flex min-h-[210px] flex-col items-center justify-end px-4 pb-4 pt-5 ${SCENE[view.background] || SCENE.default}`}>
              <SceneArt id={view.background} />
              {view.background === 'star_room' && STARS.map((s, i) => <span key={i} aria-hidden="true" className="absolute rounded-full bg-white" style={{ top: `${s.top}%`, left: `${s.left}%`, width: s.size, height: s.size }} />)}
              <span className="absolute right-3 top-3 z-20 flex items-center gap-1 rounded-full border border-[#f3d5da] bg-white px-2.5 py-1 text-xs font-bold text-[#8b2f40]"><span className="h-2 w-2 rounded-full bg-[#e07a87]" aria-hidden="true" />{won(view.points)}P</span>
              <span className="relative z-10"><PetCharacter character={pet.character} stage={stage} clothing={pet.clothing} accessory={wornAccessories(pet)} gear={pet.gear} /></span>
            </div>
            <div className="border-t border-[#f3e6e8] bg-white px-4 py-3">
              <div className="flex flex-wrap items-center justify-center gap-2">
                <b className="text-base font-black">{pet.name}</b>
                <span className="rounded-full bg-[#8b2f40] px-2 py-0.5 text-[11px] font-bold text-white">Lv.{pet.level}</span>
                {pet.job && <span className="rounded-full bg-[#fef2f3] px-2 py-0.5 text-[11px] font-bold text-[#8b2f40]" title={pet.job2 ? PET_JOB2[pet.job2].title : undefined}>{pet.job2 ? PET_JOB2[pet.job2].icon : PET_JOBS[pet.job].icon} {petJobLabel(pet)}</span>}
                <span className="text-xs text-slate-500">{petStageLabel(pet.level)}{view.pets.length > 1 && main && ' · 대표 펫'}</span>
              </div>
              <div className="mt-3 space-y-2 text-xs text-slate-500">
                <div><div className="mb-1 flex justify-between"><span>경험치</span><span>{atMax ? '최고 레벨' : `${won(pet.xp)} / ${won(need)}`}</span></div><div className="h-2 overflow-hidden rounded-full bg-[#f6e3e6]"><div className="h-full rounded-full bg-[#e07a87]" style={{ width: `${atMax ? 100 : Math.min(100, (pet.xp / need) * 100)}%` }} /></div></div>
                <div><div className="mb-1 flex justify-between"><span>기운</span><span>{pet.energy} / {pet.maxEnergy}</span></div><div className="h-2 overflow-hidden rounded-full bg-[#f6e3e6]"><div className="h-full rounded-full bg-[#f5b36b]" style={{ width: `${Math.min(100, (pet.energy / pet.maxEnergy) * 100)}%` }} /></div></div>
              </div>
            </div>
          </section>
          <section aria-label="오늘의 포인트" className="rounded-2xl border border-[#f3e6e8] bg-white px-4 py-3">
            <div className="flex items-center justify-between"><b className="text-sm font-black">오늘의 포인트</b><span className="text-xs text-slate-500">{won(view.today.studyPoints)} / {won(view.today.studyCap)}P</span></div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#f6e3e6]"><div className="h-full rounded-full bg-[#f5a3a8]" style={{ width: `${Math.min(100, (view.today.studyPoints / Math.max(1, view.today.studyCap)) * 100)}%` }} /></div>
            <p className="mt-1.5 text-[11px] text-slate-400">받은 공부 보상 · 출석 {view.rewards.attendance}번 · 숙제 {view.rewards.assignment}번</p>
          </section>
          <section aria-label="원정대" className="flex items-center gap-3 rounded-2xl border border-[#f3e6e8] bg-white px-4 py-3">
            <span className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-[#eef6ea] text-lg" aria-hidden="true">🗺️</span>
            <span className="min-w-0 flex-1"><b className="block text-sm font-black">원정대{view.nickname && <span className="ml-1.5 text-xs font-medium text-slate-500">별칭 '{view.nickname}'</span>}</b><span className="block text-xs text-slate-500">{exp.allCleared ? '모든 장 완료!' : chapter ? (exp.currentNeedsLevel ? `${chapter.title} · Lv.${exp.currentNeedsLevel}부터` : `${chapter.title} ${step}단계`) : '아직 출발 전'} · ★ {exp.totalStars} / {exp.maxStars}</span></span>
          </section>
          <section aria-label="옷장" className="rounded-2xl border border-[#f3e6e8] bg-white px-4 py-3">
            <b className="text-sm font-black">옷장 <span className="text-xs font-medium text-slate-500">{owned.length}개</span></b>
            <div className="mt-2 grid grid-cols-4 gap-1.5 text-center text-[11px]">{ACCESSORY_SLOTS.map(s => { const id = pet.accessories?.[s.id]; return <div key={s.id} className="rounded-xl bg-[#fdf6f7] px-1 py-1.5"><span className="block text-slate-400">{s.label}</span><b className="block truncate font-bold">{id ? `${petItem(id)?.icon} ${petItem(id)?.name}` : '—'}</b></div>; })}</div>
            {owned.length ? <div className="mt-2 grid grid-cols-3 gap-1.5 sm:grid-cols-4">{owned.map(item => <div key={item.id} className={`flex flex-col items-center rounded-2xl border px-1 py-2 text-center ${worn.has(item.id) ? 'border-[#d26272] bg-[#fff7f8]' : 'border-[#f3e6e8] bg-white'}`}>
              {item.reward && <span className="-mb-0.5 rounded-full bg-[#eef6ea] px-1.5 text-[10px] font-bold text-[#4f7a43]">원정대</span>}
              <span className="text-xl" aria-hidden="true">{item.icon}</span><span className="text-[11px] font-bold">{item.name}</span><span className="text-[10px] text-slate-400">{worn.has(item.id) ? '입고 있어요' : CATEGORY[item.category] || ''}</span>
            </div>)}</div> : <p className="mt-2 text-xs text-slate-400">아직 가진 옷·소품이 없어요.</p>}
          </section>
          <p className="text-center text-[11px] text-slate-400">학생 화면 그대로 보여 주는 보기 전용이에요. 여기서는 아무것도 바뀌지 않아요.</p>
        </div>;
      })()}
  </WorkspaceDialog>;
}
