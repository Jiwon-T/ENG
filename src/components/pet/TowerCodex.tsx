import { useState } from 'react';
import { X } from 'lucide-react';
import { TOWER_ZONES, petGearView, petStage, wornAccessories, type PetElement, type TowerMonsterKind } from '../../lib/petCatalog';
import type { PetState } from '../../lib/petService';
import { PetCharacter } from './PetCharacters';
import { TowerMonster } from './TowerMonster';
import { TowerBossFrostDragon, TowerBossGolem, TowerBossSphinx, TowerBossSpider, TowerDragon } from './TowerCharacters';

// 몬스터 도감: every monster the student's pets have met, in the order met, with the weakness once a crit revealed it.
// How many monsters there are stays a secret (a single "???" card stands for the rest); a boss's name too, until beaten.
export interface TowerCodexView { kind: TowerMonsterKind; name: string | null; /** a boss not beaten yet: its name stays ??? */ hidden?: boolean; boss: boolean; first: number | null; wins: number | null; weak: PetElement | null }
type Pet = PetState['pets'][number];

// Element colours: the skill badges, the crit flash and the 도감.
export const ELEMENT_COLOR: Record<PetElement, { bg: string; text: string; flash: string }> = {
  화: { bg: '#fcebeb', text: '#791f1f', flash: '#e24b4a' }, 수: { bg: '#e6f1fb', text: '#0c447c', flash: '#378add' }, 목: { bg: '#eaf3de', text: '#27500a', flash: '#639922' },
  금: { bg: '#f1efe8', text: '#444441', flash: '#888780' }, 토: { bg: '#faeeda', text: '#633806', flash: '#ba7517' }, 빛: { bg: '#fef9c3', text: '#854d0e', flash: '#ef9f27' }, 어둠: { bg: '#26215c', text: '#ffffff', flash: '#534ab7' },
};
export const ElementBadge = ({ e, label = '' }: { e: PetElement; label?: string }) => <span className="ml-1 rounded-md px-1 text-[10px] font-bold" style={{ background: ELEMENT_COLOR[e].bg, color: ELEMENT_COLOR[e].text }}>{label}{e}</span>;

/** A monster's picture: the big boss drawings, the dragon, the pet's own shadow, or the small monster art. `size` is the boss size. */
export function MonsterArt({ kind, boss, color, size, pet }: { kind: TowerMonsterKind; boss: boolean; color?: number | null; size: number; pet: Pet }) {
  const small = Math.round(size * 0.57);
  if (kind === 'shadow') return <span className="block" style={{ filter: 'brightness(0)', opacity: 0.8 }}><PetCharacter character={pet.character} stage={petStage(pet.level)} clothing={pet.clothing} accessory={wornAccessories(pet)} gear={petGearView(pet as any)} size={small} /></span>;
  if (kind === 'gatekeeper') return <TowerBossGolem size={size} />;
  if (kind === 'dragon') return <TowerDragon color={color ?? 0} asleep={false} size={size} />;
  if (kind === 'frost_dragon') return <TowerBossFrostDragon size={size} />;
  if (kind === 'crystal_queen') return <TowerBossSpider size={size} />;
  if (kind === 'sphinx') return <TowerBossSphinx size={size} />;
  return <TowerMonster kind={kind} boss={boss} size={small} />;
}

const OTHER_NAMES: Partial<Record<TowerMonsterKind, string>> = { shadow: '그림자', dragon: '깨어난 드래곤', fairy: '수상한 요정' };
const nameOf = (m: TowerCodexView) => m.hidden ? '???' : m.name || OTHER_NAMES[m.kind] || TOWER_ZONES.flatMap(z => [...z.monsters, z.boss]).find(x => x.kind === m.kind)?.name || '???';

export function TowerCodex({ codex, pet, onClose }: { codex: TowerCodexView[]; pet: Pet; onClose: () => void }) {
  const [open, setOpen] = useState<TowerMonsterKind | null>(null), sel = codex.find(m => m.kind === open) || null;
  return <div className="fixed inset-0 z-[90] flex items-end justify-center bg-slate-900/40 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="tower-codex-title" onClick={onClose}>
    <section className="max-h-[88vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-white px-4 pb-6 pt-3 sm:rounded-3xl" onClick={e => e.stopPropagation()}>
      <header className="flex items-center justify-between">
        <h2 id="tower-codex-title" className="text-base font-black text-[#26215c]">📖 몬스터 도감</h2>
        <span className="ml-auto mr-2 text-xs text-slate-500">발견 {codex.length} / ??</span>
        <button type="button" onClick={onClose} aria-label="닫기" className="rounded-full p-1 text-slate-400 hover:bg-slate-100"><X size={18} aria-hidden="true" /></button>
      </header>
      {sel && <div className="mt-2 flex items-center gap-3 rounded-2xl border border-[#cecbf6] bg-[#f7f6fd] px-3 py-2">
        <div className="flex h-16 w-20 shrink-0 items-center justify-center"><MonsterArt kind={sel.kind} boss={sel.boss} size={sel.boss || sel.kind === 'dragon' ? 80 : 110} pet={pet} /></div>
        <div className="min-w-0 text-xs text-[#26215c]">
          <b className="text-sm font-black">{nameOf(sel)}</b>{sel.boss && <span className="ml-1 rounded-md bg-[#26215c] px-1 text-[10px] font-bold text-white">보스</span>}
          <p className="mt-0.5 text-slate-600">{sel.first ? `처음 만남 ${sel.first}층` : '도감 전에 만났어요'}{sel.wins !== null && ` · 쓰러뜨림 ${sel.wins}번`}</p>
          <p className="mt-0.5">{sel.weak ? <>약점<ElementBadge e={sel.weak} /></> : <span className="text-slate-400">약점 ? · 크리티컬이 처음 터지면 기록돼요</span>}</p>
        </div>
      </div>}
      <div className="mt-3 grid grid-cols-3 gap-1.5 sm:grid-cols-4">
        {codex.map(m => <button key={m.kind} type="button" aria-pressed={open === m.kind} onClick={() => setOpen(open === m.kind ? null : m.kind)} className={`flex flex-col items-center rounded-xl border bg-white px-1 pb-1.5 pt-1 text-center text-[11px] text-[#26215c] ${open === m.kind ? 'border-[#534ab7] ring-1 ring-[#534ab7]' : m.boss ? 'border-[#7f77dd]' : 'border-[#e4e0f5]'}`}>
          <span className="flex h-14 items-center justify-center overflow-hidden"><MonsterArt kind={m.kind} boss={false} size={m.boss || m.kind === 'dragon' ? 76 : 98} pet={pet} /></span>
          <b className="w-full truncate font-bold">{nameOf(m)}</b>
          {m.weak ? <ElementBadge e={m.weak} label="약점 " /> : <span className="text-[10px] text-slate-400">약점 ?</span>}
        </button>)}
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[#e4e0f5] bg-[#f8fafc] py-3 text-[11px] text-slate-300"><span className="text-2xl font-black">?</span>???</div>
      </div>
      <p className="mt-3 text-center text-[11px] text-slate-400">처음 만난 몬스터가 기록돼요 · 약점은 처음 크리티컬이 터졌을 때 · 몇 마리가 있는지는 비밀!</p>
    </section>
  </div>;
}
