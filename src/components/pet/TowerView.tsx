import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft } from 'lucide-react';
import { PetService, type PetState } from '../../lib/petService';
import { PET_TOWER, TOWER_GEAR_SLOTS, accessorySlot, petStage, towerGear, wornAccessories, type TowerGearSlot, type TowerMonsterKind } from '../../lib/petCatalog';
import { PetCharacter } from './PetCharacters';
import { TowerMonster } from './TowerMonster';
import { TowerChest, TowerDoors, TowerGate, TowerGearIcon } from './TowerHall';
import { TowerEventScreen, type TowerEventView } from './TowerEvents';
import { TowerBossGolem, TowerDragon } from './TowerCharacters';

// 채움의 탑: the gate, the lone chest on floor 1, three doors on every floor, then the turn-based battle — the monster above, the pet
// below (as in the old handheld RPGs), a message box and the word question. The server decides every result.
interface TowerQ { kind: 'attack' | 'defend'; prompt: string; choices: string[]; msLeft: number | null }
export interface TowerInfo {
  floor: number; best: number; top: number; gear: string[]; equip: Partial<Record<TowerGearSlot, string>>; levels: Record<string, number>; chests: number[]; potions: number; stones: number; event: TowerEventView | null; stats: { atk: number; def: number; hp: number; mp: number };
  run: null | { id: string; floor: number; monster: { kind: TowerMonsterKind; name: string; boss: boolean; hp: number; max: number; color?: number | null }; hp: number; maxHp: number; mp: number; maxMp: number; phase: 'act' | 'attack' | 'defend'; attacks: number; q: TowerQ | null };
}
const Bar = ({ value, max, color }: { value: number; max: number; color: string }) => <div className="h-2 flex-1 overflow-hidden rounded-full bg-[#ece9f7]"><div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${Math.max(0, Math.min(100, (value / Math.max(1, max)) * 100))}%` }} /></div>;

export default function TowerView({ state, onState, onClose }: { state: PetState; onState: (s: PetState) => void; onClose: () => void }) {
  const pet = state.pets.find(p => p.slot === state.currentPetSlot) || state.pets[0];
  const [tower, setTower] = useState<TowerInfo | null>(null), [busy, setBusy] = useState(false), [notice, setNotice] = useState('');
  const [message, setMessage] = useState(''), [feedback, setFeedback] = useState<{ q: TowerQ; picked: number; answer: number } | null>(null);
  const [ending, setEnding] = useState<any>(null), [fleeAsk, setFleeAsk] = useState(false), [loot, setLoot] = useState<any>(null), [entered, setEntered] = useState(false);
  const [left, setLeft] = useState<number | null>(null);
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
  const weapon = tower?.equip.weapon ? towerGear(tower.equip.weapon)?.name : null;
  // In battle the pet wears its outfit and holds its tower weapon (instead of a shop item in that hand).
  const battleLook = tower?.equip.weapon ? [...wornAccessories(pet).filter(id => accessorySlot(id) !== 'hand'), tower.equip.weapon] : wornAccessories(pet);
  // The monster's turn has a time limit: answer before it runs out (the server checks the time too).
  useEffect(() => {
    if (!run?.q || run.q.kind !== 'defend' || run.q.msLeft === null || feedback) { setLeft(null); return; }
    const end = Date.now() + run.q.msLeft; setLeft(run.q.msLeft);
    const id = window.setInterval(() => { const ms = Math.max(0, end - Date.now()); setLeft(ms); if (ms === 0) { window.clearInterval(id); void answer(-1); } }, 100);
    return () => window.clearInterval(id);
  }, [run?.id, run?.q?.prompt, run?.q?.kind, feedback]); // eslint-disable-line react-hooks/exhaustive-deps

  const answer = async (choice: number) => {
    if (!run?.q || busy || feedback) return;
    const shown = run.q, monster = run.monster.name, r = await send('tower-answer', { runId: run.id, choice });
    if (!r?.result) return;
    const x = r.result;
    if (x.won || x.lost) setFrozen({ ...run, q: null, monster: { ...run.monster, hp: x.won ? 0 : run.monster.hp }, hp: x.lost ? 0 : Math.max(0, run.hp - (x.taken || 0)) });
    setFeedback({ q: shown, picked: choice, answer: x.answer });
    setMessage(x.kind === 'attack' ? (x.correct ? `${pet.name}의 ${weapon || '몸통 박치기'}! ${monster}에게 ${x.damage} 피해!` : `빗나갔어요! 정답은 '${shown.choices[x.answer]}'`)
      : x.correct ? `막았어요! ${x.taken}만 다쳤어요.` : `${x.late ? '시간 초과! ' : ''}${monster}의 공격! ${x.taken} 피해 · 정답은 '${shown.choices[x.answer]}'`);
    window.clearTimeout(feedbackTimer.current);
    feedbackTimer.current = window.setTimeout(() => { setFeedback(null); setFrozen(null); if (x.won || x.lost) setEnding(x); else setMessage(''); }, 1400);
  };
  const act = async (move: string) => { setFleeAsk(false); const r = await send('tower-act', { move }); if (r?.result?.fled) setEnding(r.result); if (r?.result?.healed) setMessage(`물약을 마셨어요! 체력 +${r.result.healed}`); };
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
        <button type="button" onClick={onClose} className="flex items-center gap-0.5 text-sm font-bold text-[#8b2f40]"><ChevronLeft size={18} aria-hidden="true" />펫</button>
        <h1 className="text-center text-base font-black leading-tight text-[#5e1e2a]">{PET_TOWER.name}<span className="block text-[11px] font-bold text-slate-500">{pet.name}의 도전</span></h1>
        <span className="text-xs font-bold text-[#8b2f40]">기운 {pet.energy}</span>
      </header>
      {notice && <p role="alert" className="mt-3 rounded-xl bg-[#fef2f3] px-3 py-2 text-center text-xs font-bold text-[#b04a5a]">{notice}</p>}
      {!tower ? <p role="status" className="mt-8 text-center text-sm text-slate-500">탑 입구로 가는 중…</p>
        : ending ? <Ending ending={ending} tower={tower} onAgain={() => setEnding(null)} />
        : run ? <div className="mt-3 space-y-3"><section aria-label="전투" className="overflow-hidden rounded-3xl border border-[#e4e0f5]">
          <div className="flex items-center justify-between border-b border-[#e4e0f5] bg-white px-3 py-1.5 text-xs"><b className="font-black text-[#3c3489]">{run.floor}층{run.monster.boss && ' · 보스'}</b><span className="text-slate-500">공격 {run.attacks}회 · 물약 {tower.potions}</span></div>
          <div className="relative h-56 bg-[#eeedfe]">
            <div className="absolute left-2.5 top-2.5 w-[46%] rounded-xl border-2 border-[#3c3489] bg-white px-2.5 py-1.5"><div className="flex justify-between text-xs"><b className="font-black text-[#26215c]">{run.monster.name}</b></div><div className="mt-1 flex items-center gap-1.5"><span className="rounded bg-[#fac775] px-1 text-[10px] font-black text-[#633806]">HP</span><Bar value={run.monster.hp} max={run.monster.max} color={run.monster.hp / run.monster.max < 0.3 ? 'bg-[#e24b4a]' : 'bg-[#639922]'} /></div><p className="mt-0.5 text-right text-[10px] text-slate-500">{run.monster.hp.toLocaleString('ko-KR')}/{run.monster.max.toLocaleString('ko-KR')}</p></div>
            <div className="absolute right-4 top-3">{run.monster.kind === 'shadow' ? <span className="block" style={{ filter: 'brightness(0)', opacity: 0.8 }}><PetCharacter character={pet.character} stage={petStage(pet.level)} clothing={pet.clothing} accessory={wornAccessories(pet)} size={86} /></span> : run.monster.kind === 'gatekeeper' ? <TowerBossGolem size={150} /> : run.monster.kind === 'dragon' ? <TowerDragon color={run.monster.color ?? 0} asleep={false} size={150} /> : <TowerMonster kind={run.monster.kind} boss={run.monster.boss} size={86} />}</div>
            <div className="absolute bottom-1 left-4"><PetCharacter character={pet.character} stage={petStage(pet.level)} clothing={pet.clothing} accessory={battleLook} size={92} /></div>
            <div className="absolute bottom-2.5 right-2.5 w-[50%] rounded-xl border-2 border-[#3c3489] bg-white px-2.5 py-1.5"><div className="flex justify-between text-xs"><b className="font-black text-[#26215c]">{pet.name}</b><span className="text-slate-500">Lv.{pet.level}</span></div>
              <div className="mt-1 flex items-center gap-1.5"><span className="rounded bg-[#fac775] px-1 text-[10px] font-black text-[#633806]">HP</span><Bar value={run.hp} max={run.maxHp} color={run.hp / run.maxHp < 0.3 ? 'bg-[#e24b4a]' : 'bg-[#639922]'} /></div>
              <div className="mt-0.5 flex items-center gap-1.5"><span className="rounded bg-[#b5d4f4] px-1 text-[10px] font-black text-[#0c447c]">MP</span><Bar value={run.mp} max={run.maxMp} color="bg-[#378add]" /></div>
              <p className="mt-0.5 text-right text-[10px] text-slate-500">{run.hp}/{run.maxHp} · {run.mp}/{run.maxMp}</p></div>
          </div>
          <div className="space-y-2 bg-white p-3">
            <p role="status" aria-live="polite" className="min-h-[44px] rounded-xl border-2 border-[#26215c] px-3 py-2 text-sm font-medium text-[#26215c]">
              {message || (q ? (q.kind === 'attack' ? <>이 뜻의 영어 단어는? <b className="font-black">“{q.prompt}”</b></> : <>{run.monster.name}의 공격! 막으려면 뜻을 골라요 <b className="font-black">{q.prompt}</b></>) : '무엇을 할까요?')}
            </p>
            {q ? <>
              {q.kind === 'defend' && left !== null && !feedback && <div className="h-1.5 overflow-hidden rounded-full bg-[#fcebeb]" aria-label={`남은 시간 ${Math.ceil(left / 1000)}초`}><div className="h-full rounded-full bg-[#e24b4a]" style={{ width: `${(left / (PET_TOWER.defendSeconds * 1000)) * 100}%` }} /></div>}
              <div className="grid grid-cols-2 gap-2">{q.choices.map((c, i) => { const fb = feedback, isAnswer = fb && i === fb.answer, isWrong = fb && i === fb.picked && fb.picked !== fb.answer;
                return <button key={i} type="button" disabled={busy || Boolean(fb)} onClick={() => void answer(i)} className={`min-h-[44px] rounded-xl border px-2 py-2 text-sm font-bold transition-colors ${isAnswer ? 'border-[#639922] bg-[#eaf3de] text-[#27500a]' : isWrong ? 'border-[#e24b4a] bg-[#fcebeb] text-[#791f1f]' : 'border-[#d6d2ee] bg-white text-[#26215c] hover:bg-[#f5f4fd]'}`}>{c}</button>; })}</div>
            </> : fleeAsk ? <div className="flex items-center gap-2 rounded-xl bg-[#fcebeb] px-3 py-2 text-xs text-[#791f1f]"><span className="flex-1">도망치면 기운을 모두 써서 탈진해요. 이 층은 다음에 다시 도전할 수 있어요.</span><button type="button" onClick={() => setFleeAsk(false)} className="rounded-lg border border-[#f7c1c1] bg-white px-2.5 py-1 font-bold">취소</button><button type="button" disabled={busy} onClick={() => void act('flee')} className="rounded-lg bg-[#e24b4a] px-2.5 py-1 font-bold text-white">도망</button></div>
            : <div className="grid grid-cols-4 gap-1.5 text-xs font-bold">
              <button type="button" disabled={busy} onClick={() => void act('attack')} className="rounded-xl bg-[#fac775] px-1 py-2.5 text-[#633806]">{weapon ? `${weapon.replace('견습 ', '')} 치기` : '박치기'}</button>
              <button type="button" disabled={busy} onClick={() => void act('skill')} className="rounded-xl bg-[#f1efe8] px-1 py-2.5 text-[#888780]">스킬 (전직 후)</button>
              <button type="button" disabled={busy || tower.potions <= 0} onClick={() => void act('potion')} className="rounded-xl bg-[#e1f5ee] px-1 py-2.5 text-[#085041] disabled:opacity-50">물약 {tower.potions}</button>
              <button type="button" disabled={busy} onClick={() => setFleeAsk(true)} className="rounded-xl bg-[#f1efe8] px-1 py-2.5 text-[#5f5e5a]">도망</button>
            </div>}
            <p className="text-[11px] text-slate-400">기술을 고른 뒤 단어를 맞히면 공격, 몬스터 차례엔 {PET_TOWER.defendSeconds}초 안에 뜻을 맞히면 막아요 · 틀린 단어는 오답 복습으로</p>
          </div>
        </section><StatsGear tower={tower} busy={busy} /></div>
        : tower.event ? <div className="mt-3"><TowerEventScreen event={tower.event} busy={busy} points={state.points} stones={tower.stones} potions={tower.potions} gear={tower.gear} levels={tower.levels} pet={pet} send={eventSend} /></div>
        : !entered ? <div className="mt-3"><TowerGate floor={tower.floor} onOpen={() => setEntered(true)} /></div>
        : !tower.chests.includes(1) || loot ? <div className="mt-3"><TowerChest busy={busy} loot={loot} onOpen={() => void openChest()} onNext={() => setLoot(null)} /></div>
        : <div className="mt-3 space-y-3">
          {tower.floor > tower.top ? <p className="rounded-3xl bg-[#232220] px-4 py-10 text-center text-sm font-bold text-[#fac775]">꼭대기 도착! 더 높은 층은 곧 열려요.</p>
            : <TowerDoors floor={tower.floor} boss={tower.floor % PET_TOWER.bossEvery === 0} busy={busy} onPick={start} />}
          <Entrance tower={tower} busy={busy} energy={pet.energy} onEquip={id => void send('tower-equip', { gearId: id })} />
        </div>}
    </div>
  </div>;
}

/** 능력치 and 장비: at the entrance (gear can be changed) and under the battle (to look at only). */
function StatsGear({ tower, busy, onEquip }: { tower: TowerInfo; busy: boolean; onEquip?: (id: string) => void }) {
  return <>
    <section aria-label="능력치" className="rounded-2xl border border-[#e4e0f5] bg-white px-4 py-3">
      <b className="text-sm font-black text-[#26215c]">능력치</b>
      <div className="mt-2 grid grid-cols-4 gap-1.5 text-center text-xs">{([['공격', tower.stats.atk], ['방어', tower.stats.def], ['체력', tower.stats.hp], ['마력', tower.stats.mp]] as const).map(([k, v]) => <div key={k} className="rounded-xl bg-[#f7f6fd] py-1.5"><span className="block text-slate-500">{k}</span><b className="font-black text-[#26215c]">{v}</b></div>)}</div>
      <p className="mt-1.5 text-[11px] text-slate-400">레벨이 오르고 장비를 끼거나 강화하면 강해져요 · 물약 {tower.potions}개 · 강화석 {tower.stones}개</p>
      <b className="mt-3 block text-sm font-black text-[#26215c]">장비</b>
      <div className="mt-1.5 grid grid-cols-3 gap-1.5 text-center text-[11px]">{TOWER_GEAR_SLOTS.map(s => { const id = tower.equip[s.id], g = id ? towerGear(id) : null; return <div key={s.id} className={`rounded-xl border px-1 py-1.5 ${g ? 'border-[#d6d2ee] bg-white' : 'border-dashed border-[#e4e0f5] text-slate-300'}`}><span className="block text-slate-400">{s.label}</span><b className="flex items-center justify-center gap-0.5 truncate font-bold text-[#26215c]">{g ? <><TowerGearIcon id={g.id} size={16} />{g.short}{tower.levels[g.id] ? ` +${tower.levels[g.id]}` : ''}</> : '—'}</b></div>; })}</div>
      {onEquip && tower.gear.length > 0 && <div className="mt-2 flex flex-wrap gap-1.5">{tower.gear.map(id => { const g = towerGear(id); if (!g) return null; const on = tower.equip[g.slot] === id; return <button key={id} type="button" disabled={busy || !onEquip} aria-pressed={on} onClick={() => onEquip?.(id)} className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${on ? 'border-[#7f77dd] bg-[#eeedfe] text-[#3c3489]' : 'border-[#e4e0f5] text-slate-500'}`}><span className="inline-flex items-center gap-1"><TowerGearIcon id={g.id} size={14} />{g.name} {on ? '· 끼는 중' : '· 끼기'}</span></button>; })}</div>}
    </section>
    {!onEquip && <p className="-mt-1 text-center text-[11px] text-slate-400">전투 중에는 장비를 바꿀 수 없어요</p>}
  </>;
}

function Entrance({ tower, busy, energy, onEquip }: { tower: TowerInfo; busy: boolean; energy: number; onEquip: (id: string) => void }) {
  const atTop = tower.floor > tower.top, boss = tower.floor % PET_TOWER.bossEvery === 0;
  return <div className="space-y-3">
    <section aria-label="진행" className="rounded-2xl border border-[#e4e0f5] bg-[#f7f6fd] px-4 py-3">
      <div className="flex items-center justify-between"><b className="text-sm font-black text-[#3c3489]">{atTop ? '꼭대기 도착!' : `${tower.floor}층 도전${boss ? ' · 보스' : ''}`}</b><span className="text-xs text-slate-500">최고 {tower.best}층 / {tower.top}층</span></div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#e4e0f5]"><div className="h-full rounded-full bg-[#7f77dd]" style={{ width: `${(tower.best / tower.top) * 100}%` }} /></div>
      <p className="mt-1.5 text-[11px] text-slate-500">{atTop ? '더 높은 층은 곧 열려요. 지금은 여기가 꼭대기예요.' : `층을 깰 때마다 저장돼요 · ${PET_TOWER.bossEvery}층마다 보스가 보물상자를 지켜요`}</p>
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
      {ending.first && <p className="mt-2 text-sm font-bold text-[#633806]">처음 돌파 보상 +{ending.points}P · 경험치 +{ending.xp}</p>}
      {ending.chest && <p className="mt-2 rounded-xl bg-[#fffaf0] px-3 py-2 text-sm font-bold text-[#633806]">🎁 보스의 보물상자: {ending.chest.gear.map((id: string) => towerGear(id)?.name).join(', ')}{ending.chest.potions ? ` · 물약 ${ending.chest.potions}개` : ''}</p>}
    </> : ending.lost ? <>
      <p className="text-3xl" aria-hidden="true">💫</p><h2 className="mt-1 text-lg font-black text-[#5e1e2a]">쓰러졌어요…</h2><p className="mt-1 text-sm text-slate-600">{ending.floor}층에서 다시 도전할 수 있어요. 레벨을 올리거나 장비를 바꿔 보세요.</p>
    </> : <>
      <p className="text-3xl" aria-hidden="true">💨</p><h2 className="mt-1 text-lg font-black text-[#5e1e2a]">도망쳤어요</h2><p className="mt-1 text-sm text-slate-600">기운을 다 써서 탈진했어요. 간식 탭의 몬스터로 깨울 수 있어요.</p>
    </>}
    <button type="button" onClick={onAgain} className="mt-4 rounded-xl bg-[#534ab7] px-5 py-2.5 text-sm font-bold text-white">탑 입구로</button>
  </section>;
}
