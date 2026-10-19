import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft } from 'lucide-react';
import { PetService, type PetState } from '../../lib/petService';
import { PET_JOB_GUIDE, PET_TOWER, TOWER_GEAR_SLOTS, towerZone, type PetElement, accessorySlot, petStage, towerGearFor, wornAccessories, type TowerGearSlot, type TowerMonsterKind, PET_JOB2, PET_JOB3, PET_JOB3_RULE, TOWER_SKILLS, job3For, petAura, petItem, type PetJob2, type PetJob3, towerDecor, petGearView, GEAR_SET_SHORT, GEAR_SET_BONUS, gearSetBonus, towerGear } from '../../lib/petCatalog';
import { PetCharacter } from './PetCharacters';
import { TowerChest, TowerDoors, TowerGate, TowerGearIcon } from './TowerHall';
import { TowerEventScreen, type TowerEventView } from './TowerEvents';
import { TowerFame } from './TowerFame';
import { ELEMENT_COLOR, ElementBadge, MonsterArt, TowerCodex, type TowerCodexView } from './TowerCodex';

// 채움의 탑: the gate, the lone chest on floor 1, three doors on every floor, then the turn-based battle — the monster above, the pet
// below (as in the old handheld RPGs), a message box and the word question. The server decides every result.
interface TowerQ { kind: 'attack' | 'defend'; prompt: string; choices: string[]; msLeft: number | null; /** a skill's 문장 배열: the pieces, shuffled */ order?: string[] | null }
/** A skill as the server shows it: `level` 0 = not learned yet (learned at `learnAt`); `crit` = 크리티컬 확률 % on a weakness. */
export interface TowerSkillView { id: string; name: string; kind: 'attack' | 'block' | 'heal'; element: PetElement | null; mp: number; power: number | null; learnAt: number; level: number; crit: number; text?: string | null }
export interface TowerInfo {
  skills?: TowerSkillView[]; passive?: { name: string; text: string } | null; job?: string | null; job3?: PetJob3 | null; /** 「별의 시험」 passed: the 3차 전직 may be taken */ job3Ready?: boolean;
  floor: number; best: number; top: number; gear: string[]; equip: Partial<Record<TowerGearSlot, string>>; levels: Record<string, number>; chests: number[]; potions: number; stones: number; event: TowerEventView | null; stats: { atk: number; def: number; hp: number; mp: number };
  codex?: TowerCodexView[];
  run: null | { id: string; floor: number; monster: { kind: TowerMonsterKind; name: string; boss: boolean; hp: number; max: number; color?: number | null }; hp: number; maxHp: number; mp: number; maxMp: number; phase: 'act' | 'attack' | 'defend'; attacks: number; q: TowerQ | null; skill?: string | null; shield?: boolean; weak?: PetElement | null };
}
/** One battle effect (restarted by `key`): what the last answer did. */
type Fx = { key: number; kind: 'hit' | 'glance' | 'miss' | 'crit' | 'block' | 'hurt'; amount?: number; element?: PetElement | null; found?: { name: string; element: PetElement } | null };
const Bar = ({ value, max, color }: { value: number; max: number; color: string }) => <div className="h-2 flex-1 overflow-hidden rounded-full bg-[#ece9f7]"><div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${Math.max(0, Math.min(100, (value / Math.max(1, max)) * 100))}%` }} /></div>;

export default function TowerView({ state, onState, onClose }: { state: PetState; onState: (s: PetState) => void; onClose: () => void }) {
  const pet = state.pets.find(p => p.slot === state.currentPetSlot) || state.pets[0];
  const [tower, setTower] = useState<TowerInfo | null>(null), [busy, setBusy] = useState(false), [notice, setNotice] = useState('');
  const [message, setMessage] = useState(''), [feedback, setFeedback] = useState<{ q: TowerQ; picked: number; answer: number } | null>(null), [placed, setPlaced] = useState<number[]>([]);
  const [ending, setEnding] = useState<any>(null), [fleeAsk, setFleeAsk] = useState(false), [loot, setLoot] = useState<any>(null), [entered, setEntered] = useState(false);
  const [skillsOpen, setSkillsOpen] = useState(false), [fx, setFx] = useState<Fx | null>(null);
  // The last battle picture stays up while the final answer's feedback shows (the server has already ended the battle).
  const [frozen, setFrozen] = useState<TowerInfo['run']>(null);
  const feedbackTimer = useRef<number>();
  const send = useCallback(async (action: string, payload: Record<string, unknown> = {}) => {
    setBusy(true); setNotice('');
    try { const r: any = await PetService.act(action, payload); if (r.state) onState(r.state); if (r.tower) setTower(r.tower); return r; }
    catch (e: any) { setNotice(e?.message || '잠시 후 다시 해 주세요.'); return null; }
    finally { setBusy(false); }
  }, [onState]);
  useEffect(() => { void send('tower-state'); return () => window.clearTimeout(feedbackTimer.current); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const run = tower?.run || (feedback ? frozen : null), q = feedback ? feedback.q : run?.q || null;
  // In battle the pet wears its outfit and holds its tower weapon (instead of a shop item in that hand).
  const battleLook = tower?.equip.weapon ? [...wornAccessories(pet).filter(id => accessorySlot(id) !== 'hand'), tower.equip.weapon] : wornAccessories(pet);
  // The monster's turn has a time limit: answer before it runs out (the server checks the time too). One timer for the
  // answer; the bar drains with a CSS animation, so the battle isn't redrawn ten times a second.
  const defendMs = run?.q?.kind === 'defend' && run.q.msLeft !== null && !feedback ? run.q.msLeft : null;
  useEffect(() => {
    if (defendMs === null) return;
    const id = window.setTimeout(() => void answer(-1), defendMs);
    return () => window.clearTimeout(id);
  }, [run?.id, run?.q?.prompt, run?.q?.kind, feedback]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { setPlaced([]); }, [run?.id, run?.q?.prompt]);
  const answer = async (choice: number | string) => {
    if (!run?.q || busy || feedback) return;
    const shown = run.q, monster = run.monster.name, r = await send('tower-answer', { runId: run.id, choice });
    if (!r?.result) return;
    const x = r.result, right = x.sentence || shown.choices[x.answer];
    if (x.won || x.lost) setFrozen({ ...run, q: null, monster: { ...run.monster, hp: x.won ? 0 : run.monster.hp }, hp: x.lost ? 0 : Math.max(0, run.hp - (x.taken || 0)) });
    setFeedback({ q: shown, picked: typeof choice === 'number' ? choice : -1, answer: x.answer });
    const skillName = x.skill ? tower?.skills?.find(k => k.id === x.skill)?.name : null, drained = `${x.drained ? ` (체력 +${x.drained})` : ''}${x.hits === 2 ? ' 두 번 베었어요!' : ''}${x.shieldUp ? ' 다음 공격도 막아요!' : ''}${x.weakened ? ' 적의 공격이 약해졌어요!' : ''}`;
    setMessage(x.kind === 'attack'
      ? (x.crit ? `크리티컬! ${pet.name}의 ${skillName}! ${monster}에게 ${x.damage} 피해!${drained}`
        : x.correct ? `${pet.name}의 ${skillName || '때리기'}! ${monster}에게 ${x.damage} 피해!${drained}`
        : x.glancing ? `${skillName}이(가) 스쳤어요! ${x.damage} 피해 · 정답은 '${right}'`
        : `빗나갔어요! 정답은 '${right}'`)
      : x.shield ? `방패로 막았어요! ${x.taken}만 다쳤어요.${x.correct ? '' : ` · 정답은 '${shown.choices[x.answer]}'`}`
      : x.correct ? `막았어요! ${x.taken}만 다쳤어요.` : `${x.late ? '시간 초과! ' : ''}${monster}의 공격! ${x.taken} 피해 · 정답은 '${shown.choices[x.answer]}'`);
    setFx({ key: Date.now(), amount: x.kind === 'attack' ? x.damage : x.taken, element: x.element || null, found: x.weakFound ? { name: x.weakFound.name, element: x.weakFound.element } : null,
      kind: x.kind === 'attack' ? (x.crit ? 'crit' : x.correct ? 'hit' : x.glancing ? 'glance' : 'miss') : x.blocked ? 'block' : 'hurt' });
    window.clearTimeout(feedbackTimer.current);
    feedbackTimer.current = window.setTimeout(() => { setFeedback(null); setFrozen(null); setFx(null); if (x.won || x.lost) setEnding(x); else setMessage(''); }, x.weakFound ? 2200 : 1400);
  };
  // Leaving in the middle of a battle counts as running away (기운 0), so the 도망 button keeps its meaning. A closed app or
  // a lost connection only pauses: coming back continues the same fight with the same HP (no advantage, no penalty).
  const [leaveAsk, setLeaveAsk] = useState(false), [codexOpen, setCodexOpen] = useState(false), [fameOpen, setFameOpen] = useState(false);
  const leave = () => { if (tower?.run && !ending) setLeaveAsk(true); else onClose(); };
  const fleeAndLeave = async () => { const r = await send('tower-act', { move: 'flee' }); setLeaveAsk(false); if (r) onClose(); };
  const act = async (move: string, skill?: TowerSkillView) => {
    setFleeAsk(false); setSkillsOpen(false);
    const r = await send('tower-act', { move, ...(skill ? { skill: skill.id } : {}) });
    if (r?.result?.fled) setEnding(r.result);
    if (r?.result?.healed) setMessage(skill ? `${pet.name}의 치유! 체력 +${r.result.healed}` : `물약을 마셨어요! 체력 +${r.result.healed}`);
    if (r?.result?.shield) setMessage(`${pet.name}이(가) 방패를 들었어요! 다음 공격을 막아요.`);
  };
  const skills = tower?.skills || [];
  const start = async (door: number) => {
    setEnding(null); setMessage(''); const requestId = `d${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`, r = await send('tower-start', { door, requestId }); if (!r) return false; // one id per door: a resent request isn't a second door
    if (r.result?.cleared) setEnding(r.result); // a treasure behind the door: the floor is passed at once
    if (r.result?.opened === 'mirror') setMessage('거울 속에서 내 펫의 그림자가 걸어 나왔어요!');
    return true;
  };
  // An event behind a door: its end passes the floor, or a battle begins (a trap, a woken monster, the fairy fought).
  const eventSend = async (move: string, input: Record<string, unknown> = {}) => {
    const r = await send('tower-event', { move, ...input }), x = r?.result; if (!x) return r;
    if (x.cleared) window.setTimeout(() => setEnding(x), x.correct !== undefined ? 900 : 0);
    else if (x.trapped) setMessage(`${x.late ? '시간 초과! ' : ''}함정에 빠졌어요! 다친 채로 몬스터와 싸워요. (정답: ${x.meaning})`);
    else if (x.woke) setMessage('몬스터가 깼어요! 싸워야 해요.');
    else if (x.fight) setMessage('수상한 요정이 정체를 드러냈어요!');
    return r;
  };
  const openChest = async () => { const r = await send('tower-chest'); if (r?.result?.chest) setLoot(r.result.chest); };

  return <div role="dialog" aria-modal="true" aria-label={PET_TOWER.name} className="fixed inset-0 z-[80] overflow-y-auto bg-white">
    <div className="mx-auto max-w-md px-4 pb-10 pt-3">
      <header className="flex items-center justify-between">
        <button type="button" onClick={leave} className="flex items-center gap-0.5 text-sm font-bold text-[#8b2f40]"><ChevronLeft size={18} aria-hidden="true" />펫</button>
        <h1 className="text-center text-base font-black leading-tight text-[#5e1e2a]">{PET_TOWER.name}<span className="block text-[11px] font-bold text-slate-500">{pet.name}의 도전</span></h1>
        <span className="text-xs font-bold text-[#8b2f40]">기운 {pet.energy}</span>
      </header>
      {notice && <p role="alert" className="mt-3 rounded-xl bg-[#fef2f3] px-3 py-2 text-center text-xs font-bold text-[#b04a5a]">{notice}</p>}
      {!tower ? <p role="status" className="mt-8 text-center text-sm text-slate-500">탑 입구로 가는 중…</p>
        : ending ? <Ending ending={ending} tower={tower} onAgain={() => setEnding(null)} />
        : run ? <div className="mt-3 space-y-3"><section aria-label="전투" className="overflow-hidden rounded-3xl border border-[#e4e0f5]">
          <div className="flex items-center justify-between border-b border-[#e4e0f5] bg-white px-3 py-1.5 text-xs"><b className="font-black text-[#3c3489]">{towerZone(run.floor).name} · {run.floor}층{run.monster.boss && ' · 보스'}</b><span className="text-slate-500">공격 {run.attacks}회 · 물약 {tower.potions}</span></div>
          <div key={fx?.kind === 'crit' ? fx.key : 'area'} className={`relative h-56 bg-[#eeedfe] ${fx?.kind === 'crit' ? 'tw-crit' : ''}`} style={fx?.kind === 'crit' && fx.element ? { ['--tw-crit' as any]: ELEMENT_COLOR[fx.element].flash } : undefined}>
            <div className="absolute left-2.5 top-2.5 w-[46%] rounded-xl border-2 border-[#3c3489] bg-white px-2.5 py-1.5"><div className="flex justify-between text-xs"><b className="font-black text-[#26215c]">{run.monster.name}</b></div><div className="mt-1 flex items-center gap-1.5"><span className="rounded bg-[#fac775] px-1 text-[10px] font-black text-[#633806]">HP</span><Bar value={run.monster.hp} max={run.monster.max} color={run.monster.hp / run.monster.max < 0.3 ? 'bg-[#e24b4a]' : 'bg-[#639922]'} /></div><p className="mt-0.5 text-right text-[10px] text-slate-500">{run.monster.hp.toLocaleString('ko-KR')}/{run.monster.max.toLocaleString('ko-KR')}</p></div>
            {fx && (fx.kind === 'hit' || fx.kind === 'glance' || fx.kind === 'crit') && <div key={`m${fx.key}`} className="pointer-events-none absolute right-10 top-12 z-20 flex flex-col items-center">
              <span className="tw-spark absolute text-3xl" style={{ color: fx.kind === 'crit' && fx.element ? ELEMENT_COLOR[fx.element].flash : '#ef9f27' }} aria-hidden="true">✦</span>
              <span className="tw-pop text-center font-black drop-shadow-sm" style={{ color: fx.kind === 'crit' ? '#a32d2d' : fx.kind === 'glance' ? '#888780' : '#ba7517', fontSize: fx.kind === 'crit' ? 20 : 17 }}>{fx.kind === 'crit' && <span className="block text-[13px] tracking-wide">CRITICAL!</span>}-{fx.amount}</span></div>}
            {fx?.kind === 'miss' && <span key={`s${fx.key}`} className="tw-swoosh pointer-events-none absolute right-12 top-14 z-10 text-sm font-black text-slate-400">빗나감! 〰</span>}
            {fx?.found && <div key={`t${fx.key}`} className="tw-toast pointer-events-none absolute left-1/2 top-[38%] z-30 whitespace-nowrap rounded-xl border border-[#cecbf6] bg-white px-3 py-1.5 text-center text-xs text-[#3c3489] shadow-sm">📖 도감 · {fx.found.name}<b className="block font-black">약점: {fx.found.element} 속성 발견!</b></div>}
            <div key={fx && (fx.kind === 'block' || fx.kind === 'hurt') ? `l${fx.key}` : 'monster'} className={`absolute right-4 top-3 ${fx && (fx.kind === 'block' || fx.kind === 'hurt') ? 'tw-lunge' : ''}`}>{<MonsterArt kind={run.monster.kind} boss={run.monster.boss} color={run.monster.color} size={150} pet={pet} />}</div>
            {fx && (fx.kind === 'block' || fx.kind === 'hurt') && <div key={`p${fx.key}`} className="pointer-events-none absolute bottom-10 left-6 z-10 flex w-24 flex-col items-center">
              {fx.kind === 'block' && <span className="tw-shield absolute -top-4 h-24 w-24 rounded-full border-4 border-[#1d9e75] bg-[#e1f5ee]/60" aria-hidden="true" />}
              <span className="tw-pop font-black" style={{ color: fx.kind === 'block' ? '#0f6e56' : '#a32d2d', fontSize: 15 }}>{fx.kind === 'block' ? '막았다! ' : ''}-{fx.amount}</span></div>}
            <div key={fx?.kind === 'hurt' ? `h${fx.key}` : 'pet'} className={`absolute bottom-1 left-4 ${fx?.kind === 'hurt' ? 'tw-hurt' : ''}`}><PetCharacter character={pet.character} stage={petStage(pet.level)} clothing={pet.clothing} accessory={battleLook} size={92} aura={petAura(pet)} gear={petGearView(pet as any)} /></div>
            <div className="absolute bottom-2.5 right-2.5 w-[50%] rounded-xl border-2 border-[#3c3489] bg-white px-2.5 py-1.5"><div className="flex justify-between text-xs"><b className="font-black text-[#26215c]">{pet.name}</b><span className="text-slate-500">Lv.{pet.level}</span></div>
              <div className="mt-1 flex items-center gap-1.5"><span className="rounded bg-[#fac775] px-1 text-[10px] font-black text-[#633806]">HP</span><Bar value={run.hp} max={run.maxHp} color={run.hp / run.maxHp < 0.3 ? 'bg-[#e24b4a]' : 'bg-[#639922]'} /></div>
              <div className="mt-0.5 flex items-center gap-1.5"><span className="rounded bg-[#b5d4f4] px-1 text-[10px] font-black text-[#0c447c]">MP</span><Bar value={run.mp} max={run.maxMp} color="bg-[#378add]" /></div>
              <p className="mt-0.5 text-right text-[10px] text-slate-500">{run.hp}/{run.maxHp} · {run.mp}/{run.maxMp}</p></div>
          </div>
          <div className="space-y-2 bg-white p-3">
            <p role="status" aria-live="polite" className="min-h-[44px] rounded-xl border-2 border-[#26215c] px-3 py-2 text-sm font-medium text-[#26215c]">
              {message || (q ? (q.order ? <>이 뜻이 되게 문장을 맞춰요 <b className="font-black">“{q.prompt}”</b></> : q.kind === 'attack' ? <>이 뜻의 영어 단어는? <b className="font-black">“{q.prompt}”</b></> : <>{run.monster.name}의 공격! 막으려면 뜻을 골라요 <b className="font-black">{q.prompt}</b></>) : '무엇을 할까요?')}
            </p>
            {q ? <>
              {q.kind === 'defend' && defendMs !== null && <div key={`${run.id}:${q.prompt}`} className="h-1.5 overflow-hidden rounded-full bg-[#fcebeb]" aria-label={`남은 시간 ${Math.ceil(defendMs / 1000)}초`}><div className="h-full rounded-full bg-[#e24b4a]" style={{ width: `${(defendMs / (PET_TOWER.defendSeconds * 1000)) * 100}%`, animation: `tw-drain ${defendMs}ms linear forwards` }} /></div>}
              {q.order ? <div className="space-y-2">
                <p className="min-h-[40px] rounded-xl border border-dashed border-[#d6d2ee] bg-[#f5f4fd] px-3 py-2 text-sm font-bold text-[#26215c]" aria-label="맞춘 문장">{placed.length ? placed.map(i => q.order![i]).join(' ') : <span className="font-medium text-slate-400">조각을 순서대로 눌러요</span>}</p>
                <div className="flex flex-wrap gap-1.5">{q.order.map((piece, i) => <button key={i} type="button" disabled={busy || Boolean(feedback) || placed.includes(i)} onClick={() => setPlaced(list => [...list, i])} className="rounded-lg border border-[#d6d2ee] bg-white px-2.5 py-1.5 text-sm font-bold text-[#26215c] disabled:opacity-30">{piece}</button>)}</div>
                <div className="flex justify-end gap-1.5"><button type="button" disabled={busy || Boolean(feedback) || !placed.length} onClick={() => setPlaced(list => list.slice(0, -1))} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-500 disabled:opacity-40">하나 빼기</button><button type="button" disabled={busy || Boolean(feedback) || placed.length !== q.order.length} onClick={() => void answer(placed.map(i => q.order![i]).join(' '))} className="rounded-lg bg-[#534ab7] px-3 py-1.5 text-xs font-bold text-white disabled:opacity-40">공격!</button></div>
              </div>
              : <div className="grid grid-cols-2 gap-2">{q.choices.map((c, i) => { const fb = feedback, isAnswer = fb && i === fb.answer, isWrong = fb && i === fb.picked && fb.picked !== fb.answer;
                return <button key={i} type="button" disabled={busy || Boolean(fb)} onClick={() => void answer(i)} className={`min-h-[44px] rounded-xl border px-2 py-2 text-sm font-bold transition-colors ${isAnswer ? 'border-[#639922] bg-[#eaf3de] text-[#27500a]' : isWrong ? 'border-[#e24b4a] bg-[#fcebeb] text-[#791f1f]' : 'border-[#d6d2ee] bg-white text-[#26215c] hover:bg-[#f5f4fd]'}`}>{c}</button>; })}</div>}
            </> : fleeAsk ? <div className="flex items-center gap-2 rounded-xl bg-[#fcebeb] px-3 py-2 text-xs text-[#791f1f]"><span className="flex-1">도망치면 기운을 모두 써서 탈진해요. 이 층은 다음에 다시 도전할 수 있어요.</span><button type="button" onClick={() => setFleeAsk(false)} className="rounded-lg border border-[#f7c1c1] bg-white px-2.5 py-1 font-bold">취소</button><button type="button" disabled={busy} onClick={() => void act('flee')} className="rounded-lg bg-[#e24b4a] px-2.5 py-1 font-bold text-white">도망</button></div>
            : skillsOpen ? <div className="rounded-xl border border-[#e4e0f5] p-2">
              <div className="mb-1.5 flex items-center justify-between text-xs"><b className="font-black text-[#26215c]">스킬{tower.passive ? ` · ${tower.passive.name}(${tower.passive.text})` : ''}</b><button type="button" onClick={() => setSkillsOpen(false)} className="px-1 text-slate-400">닫기</button></div>
              <div className="grid grid-cols-2 gap-1.5">{skills.map(k => { const learned = k.level > 0, enough = run.mp >= k.mp, weak = Boolean(k.element && run.weak === k.element);
                return <button key={k.id} type="button" disabled={busy || !learned || !enough} onClick={() => void act('skill', k)} className={`rounded-lg border px-2 py-1.5 text-left text-xs ${!learned ? 'border-dashed border-[#d3d1c7] text-[#b4b2a9]' : weak ? 'border-[#534ab7] bg-[#eeedfe] text-[#26215c]' : 'border-[#e4e0f5] bg-white text-[#26215c]'} disabled:cursor-not-allowed`}>
                  <span className="font-bold">{k.name}</span>{k.element && <ElementBadge e={k.element} />}{weak && <span className="ml-1 text-[10px] font-bold text-[#a32d2d]">약점!</span>}
                  <span className="block text-[10px] text-slate-500">{!learned ? `Lv.${k.learnAt}에 배워요` : `MP ${k.mp} · ${k.kind === 'attack' ? `×${k.power}` : k.kind === 'block' ? '다음 공격 막기' : '체력 회복'} · Lv.${k.level}${!enough ? ' · MP 부족' : ''}`}</span>{learned && k.text && <span className="block text-[10px] text-[#534ab7]">{k.text}</span>}</button>; })}</div>
              <p className="mt-1.5 text-[10px] text-slate-400">스킬을 고른 뒤 단어를 맞히면 발동해요. 틀리면 약하게 스치고 MP는 절반만 써요. 약점은 크리티컬이 한 번 터진 몬스터에만 보여요.</p>
            </div>
            : <div className="grid grid-cols-4 gap-1.5 text-xs font-bold">
              <button type="button" disabled={busy} onClick={() => void act('attack')} className="rounded-xl bg-[#fac775] px-1 py-2.5 text-[#633806]">때리기</button>
              {skills.length ? <button type="button" disabled={busy} onClick={() => setSkillsOpen(true)} className="rounded-xl bg-[#cecbf6] px-1 py-2.5 text-[#26215c]">스킬 ✨</button>
                : <button type="button" disabled={busy} onClick={() => setMessage(`스킬은 전직 후에 쓸 수 있어요. ${PET_JOB_GUIDE.replace('스킬은 전직 후 · ', '')}`)} className="rounded-xl bg-[#f1efe8] px-1 py-2.5 text-[#888780]">스킬 (전직 후)</button>}
              <button type="button" disabled={busy || tower.potions <= 0} onClick={() => void act('potion')} className="rounded-xl bg-[#e1f5ee] px-1 py-2.5 text-[#085041] disabled:opacity-50">물약 {tower.potions}</button>
              <button type="button" disabled={busy} onClick={() => setFleeAsk(true)} className="rounded-xl bg-[#f1efe8] px-1 py-2.5 text-[#5f5e5a]">도망</button>
            </div>}
            <p className="text-[11px] text-slate-400">기술을 고른 뒤 단어를 맞히면 공격, 몬스터 차례엔 {PET_TOWER.defendSeconds}초 안에 뜻을 맞히면 막아요 · 틀린 단어는 오답 복습으로</p>
            <p className="text-[11px] font-bold text-[#534ab7]">✨ {PET_JOB_GUIDE}</p>
          </div>
        </section><StatsGear tower={tower} busy={busy} /></div>
        : tower.event ? <div className="mt-3"><TowerEventScreen job={pet.job} event={tower.event} busy={busy} points={state.points} stones={tower.stones} potions={tower.potions} gear={tower.gear} levels={tower.levels} pet={pet} send={eventSend} /></div>
        : !entered ? <div className="mt-3"><TowerGate floor={tower.floor} onOpen={() => setEntered(true)} /></div>
        : !tower.chests.includes(1) || loot ? <div className="mt-3"><TowerChest busy={busy} loot={loot} job={pet.job} onOpen={() => void openChest()} onNext={() => setLoot(null)} /></div>
        : <div className="mt-3 space-y-3">
          {tower.floor > tower.top ? <p className="rounded-3xl bg-[#232220] px-4 py-10 text-center text-sm font-bold text-[#fac775]">꼭대기 도착! 더 높은 층은 곧 열려요.</p>
            : <TowerDoors floor={tower.floor} boss={tower.floor % PET_TOWER.bossEvery === 0} busy={busy} onPick={start} />}
          {tower.job3Ready && pet.job2 && <Job3Banner job2={pet.job2} busy={busy} onTake={() => void send('tower-job3').then(r => { if (r?.result?.job3) setNotice(`${PET_JOB3[r.result.job3 as PetJob3].label}(으)로 3차 전직했어요! ${PET_JOB3[r.result.job3 as PetJob3].title} 칭호와 ${petItem(r.result.weapon)?.name || '새 무기'}를 받았어요.`); })} />}
          <Entrance tower={tower} busy={busy} energy={pet.energy} onEquip={id => void send('tower-equip', { gearId: id })} onCodex={() => setCodexOpen(true)} onFame={() => setFameOpen(true)} />
        </div>}
    </div>
    {fameOpen && <TowerFame onClose={() => setFameOpen(false)} />}
    {codexOpen && tower && <TowerCodex codex={tower.codex || []} pet={pet} onClose={() => setCodexOpen(false)} />}
    {leaveAsk && <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-900/50 p-4" role="alertdialog" aria-modal="true" aria-labelledby="tower-leave-title">
      <div className="w-full max-w-xs rounded-3xl bg-white p-5 text-center">
        <p className="text-3xl" aria-hidden="true">💨</p>
        <h2 id="tower-leave-title" className="mt-1 text-base font-black text-[#5e1e2a]">전투 중이에요!</h2>
        <p className="mt-1 text-xs text-slate-600">지금 나가면 <b>도망으로 처리</b>돼요. 기운이 모두 사라져 탈진하고, 이 층은 다음에 다시 도전해요.</p>
        <button type="button" onClick={() => setLeaveAsk(false)} className="mt-4 w-full rounded-xl bg-[#534ab7] py-2.5 text-sm font-bold text-white">계속 싸우기</button>
        <button type="button" disabled={busy} onClick={() => void fleeAndLeave()} className="mt-2 w-full rounded-xl border border-[#f7c1c1] py-2 text-xs font-bold text-[#a32d2d]">도망치고 나가기</button>
      </div>
    </div>}
  </div>;
}

/** 「별의 시험」 passed (Lv.150, floor 50): the 3차 전직 of the pet's branch, with what it brings. */
function Job3Banner({ job2, busy, onTake }: { job2: PetJob2; busy: boolean; onTake: () => void }) {
  const job3 = job3For(job2); if (!job3) return null;
  const j = PET_JOB3[job3], skill = TOWER_SKILLS.find(k => k.job3 === job3);
  return <section aria-label="3차 전직" className="rounded-2xl border-2 border-[#fac775] bg-[#fffbeb] px-4 py-3 text-center">
    <p className="text-2xl" aria-hidden="true">🌟</p>
    <b className="block text-sm font-black text-[#633806]">{PET_JOB3_RULE.name} 통과! 3차 전직할 수 있어요</b>
    <p className="mt-1 text-xs text-[#854f0b]">{PET_JOB2[job2].label} → <b>{j.label}</b> · 칭호 「{j.title}」 · {petItem(j.weapon)?.name}{skill ? ` · 스킬 ${skill.name}` : ''} · 은은한 오라</p>
    <button type="button" disabled={busy} onClick={onTake} className="mt-2 rounded-xl bg-[#ba7517] px-4 py-2 text-xs font-bold text-white disabled:opacity-50">{j.icon} {j.label}(으)로 전직하기</button>
  </section>;
}

/** 능력치 and 장비: at the entrance (gear can be changed) and under the battle (to look at only). */
/** 장비 세트 모으기: 6 places a set; 3 worn +5%, all 6 +12% and a glow. */
export function GearSets({ tower }: { tower: TowerInfo }) {
  const worn = Object.values(tower.equip).map(id => towerGear(String(id))), bonus = gearSetBonus(worn);
  return <div className="mt-3">
    <div className="flex items-baseline justify-between"><b className="text-sm font-black text-[#26215c]">장비 세트</b><span className="text-[11px] text-slate-400">{bonus > 0 ? `세트 효과 능력치 +${Math.round(bonus * 100)}%` : `3부위 +${GEAR_SET_BONUS.three * 100}% · 6부위 +${GEAR_SET_BONUS.six * 100}%`}</span></div>
    <div className="mt-1.5 grid grid-cols-6 gap-1 text-center">{GEAR_SET_SHORT.map((name, t) => {
      const have = tower.gear.filter(id => towerGear(id)?.set === t).length, on = worn.filter(g => g?.set === t).length;
      return <div key={t} className={`rounded-lg border border-[#e4e0f5] px-0.5 py-1 ${have ? '' : 'opacity-50'}`} title={`${name} 세트 ${have}/6 (끼는 중 ${on})`}><span className="block text-[10px] font-bold text-[#26215c]">{name}</span>
        <span className="mt-0.5 flex gap-px" aria-hidden="true">{Array.from({ length: 6 }, (_, k) => <span key={k} className={`h-1 flex-1 rounded-full ${k < on ? 'bg-[#7f77dd]' : k < have ? 'bg-[#c9c5f0]' : 'bg-[#efedf9]'}`} />)}</span>
        <span className="block text-[9px] text-slate-400">{have}/6</span></div>;
    })}</div>
    <p className="mt-1 text-[10px] text-slate-400">처음 깨는 층 15% · 보스 층은 꼭 하나 · 원정대 ★3 처음 · 겹치면 강화석</p>
  </div>;
}
function StatsGear({ tower, busy, onEquip }: { tower: TowerInfo; busy: boolean; onEquip?: (id: string) => void }) {
  return <>
    <section aria-label="능력치" className="rounded-2xl border border-[#e4e0f5] bg-white px-4 py-3">
      <b className="text-sm font-black text-[#26215c]">능력치</b> <span className="text-[11px] text-[#7f77dd]">{PET_JOB_GUIDE}</span>
      <div className="mt-2 grid grid-cols-4 gap-1.5 text-center text-xs">{([['공격', tower.stats.atk], ['방어', tower.stats.def], ['체력', tower.stats.hp], ['마력', tower.stats.mp]] as const).map(([k, v]) => <div key={k} className="rounded-xl bg-[#f7f6fd] py-1.5"><span className="block text-slate-500">{k}</span><b className="font-black text-[#26215c]">{v}</b></div>)}</div>
      <p className="mt-1.5 text-[11px] text-slate-400">레벨이 오르고 장비를 끼거나 강화하면 강해져요 · 물약 {tower.potions}개 · 강화석 {tower.stones}개</p>
      <b className="mt-3 block text-sm font-black text-[#26215c]">장비</b>
      <div className="mt-1.5 grid grid-cols-3 gap-1.5 text-center text-[11px]">{TOWER_GEAR_SLOTS.map(s => { const id = tower.equip[s.id], g = id ? towerGearFor(id, tower.job as any) : null; return <div key={s.id} className={`rounded-xl border px-1 py-1.5 ${g ? 'border-[#d6d2ee] bg-white' : 'border-dashed border-[#e4e0f5] text-slate-300'}`}><span className="block text-slate-400">{s.label}</span><b className="flex items-center justify-center gap-0.5 truncate font-bold text-[#26215c]">{g ? <><TowerGearIcon id={g.id} size={16} job={tower.job as any} />{g.short}{tower.levels[g.id] ? ` +${tower.levels[g.id]}` : ''}</> : '—'}</b></div>; })}</div>
      {onEquip && tower.gear.length > 0 && <div className="mt-2 flex flex-wrap gap-1.5">{tower.gear.map(id => { const g = towerGearFor(id, tower.job as any); if (!g) return null; const on = tower.equip[g.slot] === id; return <button key={id} type="button" disabled={busy || !onEquip} aria-pressed={on} onClick={() => onEquip?.(id)} className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${on ? 'border-[#7f77dd] bg-[#eeedfe] text-[#3c3489]' : 'border-[#e4e0f5] text-slate-500'}`}><span className="inline-flex items-center gap-1"><TowerGearIcon id={g.id} size={14} job={tower.job as any} />{g.name} {on ? '· 끼는 중' : '· 끼기'}</span></button>; })}</div>}
      <GearSets tower={tower} />
    </section>
    {!onEquip && <p className="-mt-1 text-center text-[11px] text-slate-400">전투 중에는 장비를 바꿀 수 없어요</p>}
  </>;
}

function Entrance({ tower, busy, energy, onEquip, onCodex, onFame }: { tower: TowerInfo; busy: boolean; energy: number; onEquip: (id: string) => void; onCodex: () => void; onFame: () => void }) {
  const atTop = tower.floor > tower.top, boss = tower.floor % PET_TOWER.bossEvery === 0;
  return <div className="space-y-3">
    <section aria-label="진행" className="rounded-2xl border border-[#e4e0f5] bg-[#f7f6fd] px-4 py-3">
      <div className="flex items-center justify-between"><b className="text-sm font-black text-[#3c3489]">{atTop ? '꼭대기 도착!' : `${towerZone(tower.floor).name} · ${tower.floor}층 도전${boss ? ' · 보스' : ''}`}</b>{!atTop && <span className="ml-1 text-[11px] text-slate-400">추천 Lv.{towerZone(tower.floor).level}+</span>}<span className="text-xs text-slate-500">최고 {tower.best}층 / {tower.top}층</span></div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#e4e0f5]"><div className="h-full rounded-full bg-[#7f77dd]" style={{ width: `${(tower.best / tower.top) * 100}%` }} /></div>
      <p className="mt-1.5 text-[11px] text-slate-500">{atTop ? '더 높은 층은 곧 열려요. 지금은 여기가 꼭대기예요.' : `층을 깰 때마다 저장돼요 · ${PET_TOWER.bossEvery}층마다 보스가 보물상자를 지켜요`}</p>
      <div className="mt-2 flex gap-1.5"><button type="button" onClick={onCodex} className="rounded-lg border border-[#cecbf6] bg-white px-2.5 py-1 text-xs font-bold text-[#3c3489]">📖 몬스터 도감 · {(tower.codex || []).length}</button>
        <button type="button" onClick={onFame} className="rounded-lg border border-[#fac775] bg-white px-2.5 py-1 text-xs font-bold text-[#633806]">🏆 명예의 전당</button></div>
    </section>
    <StatsGear tower={tower} busy={busy} onEquip={onEquip} />
    {!atTop && <p className="text-center text-[11px] text-slate-400">문을 열면 기운 {PET_TOWER.energy}을 써요{energy <= 0 ? ' · 지금은 탈진 상태예요 (간식 탭의 몬스터)' : ''}</p>}
  </div>;
}

function Ending({ ending, tower, onAgain }: { ending: any; tower: TowerInfo; onAgain: () => void }) {
  return <section aria-label="결과" className="mt-6 rounded-3xl border border-[#e4e0f5] bg-[#f7f6fd] px-5 py-6 text-center">
    {ending.won || ending.cleared ? <>
      <p className="text-3xl" aria-hidden="true">{ending.won ? '🏆' : ending.loot ? '🎁' : ending.saved ? '🧚' : ending.left ? '🧙' : ending.sneaked ? '💤' : ending.correct === false ? '🗿' : '✨'}</p>
      <h2 className="mt-1 text-lg font-black text-[#3c3489]">{ending.floor}층 {ending.won ? '돌파!' : '통과!'}</h2>
      <p className="mt-1 text-sm text-slate-600">{ending.won ? `공격 ${ending.attacks}회 만에 이겼어요` : ending.loot ? `보물상자에서 ${[ending.loot.stones && `강화석 ${ending.loot.stones}개`, ending.loot.potions && `물약 ${ending.loot.potions}개`, ending.loot.points && `${ending.loot.points}P`].filter(Boolean).join(' · ') || '먼지만'} 나왔어요`
        : ending.saved ? '요정을 구했어요! 고맙다며 물약을 줬어요' : ending.left ? '상인과 인사하고 헤어졌어요' : ending.sneaked ? '몬스터 몰래 살금살금 지나갔어요' : ending.correct === false ? `석상이 정답을 알려 주고 길을 열어 줬어요: ${ending.word}` : ending.correct ? '정답! 길이 열렸어요' : '길이 열렸어요'} · 다음엔 {tower.floor > tower.top ? '꼭대기' : `${tower.floor}층`}</p>
      {(ending.stone > 0 || ending.potions > 0) && <p className="mt-2 text-sm font-bold text-[#3c3489]">{[ending.stone > 0 && `💎 강화석 +${ending.stone}`, ending.potions > 0 && `🧪 물약 +${ending.potions}`].filter(Boolean).join(' · ')}</p>}
      {ending.hall && <p className="mt-2 rounded-xl bg-[#fef9c3] px-3 py-2 text-sm font-black text-[#854d0e]">🏆 명예의 전당에 올랐어요! {[ending.hall.first && '처음 깬 모험가', ending.hall.fewest && '가장 적은 공격'].filter(Boolean).join(' · ')}</p>}
      {ending.first && <p className="mt-2 text-sm font-bold text-[#633806]">처음 돌파 보상 +{ending.points}P · 경험치 +{ending.xp}</p>}
      {ending.chest && <p className="mt-2 rounded-xl bg-[#fffaf0] px-3 py-2 text-sm font-bold text-[#633806]">🎁 보스의 보물상자: {ending.chest.gear.map((id: string) => towerGearFor(id, tower.job as any)?.name).join(', ')}{ending.chest.potions ? ` · 물약 ${ending.chest.potions}개` : ''}</p>}
      {ending.drop && <p className="mt-2 rounded-xl bg-[#f7f6fd] px-3 py-2 text-sm font-bold text-[#3c3489]">{ending.drop.stone ? `🪨 ${towerGearFor(ending.drop.id, tower.job as any)?.name}이(가) 또 나와서 강화석 1개로 바꿨어요` : `🎁 장비 「${towerGearFor(ending.drop.id, tower.job as any)?.name}」을(를) 얻었어요!`}</p>}
      {ending.decor && <p className="mt-2 rounded-xl bg-[#fdf2f8] px-3 py-2 text-sm font-bold text-[#72243e]">🪴 탑 장식 「{towerDecor(ending.decor)?.name}」을(를) 받았어요! 펫 방의 꾸미기에서 놓아 보세요.</p>}
    </> : ending.lost ? <>
      <p className="text-3xl" aria-hidden="true">💫</p><h2 className="mt-1 text-lg font-black text-[#5e1e2a]">쓰러졌어요…</h2><p className="mt-1 text-sm text-slate-600">{ending.floor}층에서 다시 도전할 수 있어요. 레벨을 올리거나 장비를 바꿔 보세요.</p>
    </> : <>
      <p className="text-3xl" aria-hidden="true">💨</p><h2 className="mt-1 text-lg font-black text-[#5e1e2a]">도망쳤어요</h2><p className="mt-1 text-sm text-slate-600">기운을 다 써서 탈진했어요. 간식 탭의 몬스터로 깨울 수 있어요.</p>
    </>}
    <button type="button" onClick={onAgain} className="mt-4 rounded-xl bg-[#534ab7] px-5 py-2.5 text-sm font-bold text-white">탑 입구로</button>
  </section>;
}
