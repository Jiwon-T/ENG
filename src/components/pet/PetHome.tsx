import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronLeft, Heart, Pencil, Check, X, Gift, Plus } from 'lucide-react';
import confetti from 'canvas-confetti';
import { onAuthStateChanged, type User as FirebaseUser } from 'firebase/auth';
import { auth } from '../../lib/firebase';
import { PetService, type PetState } from '../../lib/petService';
import {
  PET_ACTIONS, PET_ASSIGNMENT_REWARD, PET_ATTENDANCE_REWARD, PET_CHARACTERS, PET_ITEMS, PET_MAX_LEVEL, PET_MAX_PETS, PET_STAGE_LABEL, PET_STUDY_RATES,
  cleanPetSpeech, petEmojiLimit, petIdleLine, petItem, petStage, xpNeeded, PET_EXPEDITION, PET_WORD_FEED, type PetItem,
} from '../../lib/petCatalog';
import { PetCharacter } from './PetCharacters';
import WordFeed, { type FeedRunView } from './WordFeed';
import ExpeditionMap, { type ExpeditionView } from './ExpeditionMap';
import { SceneArt } from './PetScenes';
import GuildHall from './GuildHall';

// 나만의 펫: white page, rose accents (the 선생님방 palette). Everything that changes the pet is decided by the server.
type Tab = 'snacks' | 'closet' | 'talk' | 'shop';
const TABS: { id: Tab; icon: string; label: string }[] = [{ id: 'snacks', icon: '🍪', label: '간식' }, { id: 'closet', icon: '👗', label: '옷장' }, { id: 'talk', icon: '💬', label: '말하기' }, { id: 'shop', icon: '🛍️', label: '상점' }];
const SHOP_GROUPS: { id: PetItem['category']; label: string }[] = [{ id: 'clothing', label: '옷' }, { id: 'accessory', label: '소품' }, { id: 'background', label: '배경' }];
// White pets (해미·말랑) need a faint fill to show; solid colours only.
const SCENE: Record<string, string> = { forest_cabin: 'bg-[#eef6ea]', coral_sea: 'bg-[#e8f3fb]', cloud_castle: 'bg-[#f3f0fb]', default: 'bg-[#fdf6f7]', pink_cushion: 'bg-[#fff5f7]', bed: 'bg-[#f2f7fd]', desk: 'bg-[#fffaf1]', star_room: 'bg-[#1e1b4b]' };
// Fixed star positions (not random on every render).
const STARS = Array.from({ length: 18 }, (_, i) => ({ top: (i * 37) % 100, left: (i * 61 + 13) % 100, size: 1 + (i % 3), delay: (i % 5) * 0.7 }));
const idleLine = (level: number, seed: number) => petIdleLine(level, seed);
const won = (n: number) => n.toLocaleString('ko-KR');
/** Where the other pets sit in the room (left, right, then further out). */
const SPOTS = [{ left: '4%' }, { right: '4%' }, { left: '-2%', bottom: 46 }, { right: '-2%', bottom: 46 }, { left: '18%', bottom: 2 }];

export default function PetHome({ onBack }: { onBack: () => void }) {
  const [user, setUser] = useState<FirebaseUser | null>(auth.currentUser);
  const [state, setState] = useState<PetState | null>(null);
  const [pending, setPending] = useState(0);
  const [loadError, setLoadError] = useState('');
  const [tab, setTab] = useState<Tab>('snacks');
  const [shopGroup, setShopGroup] = useState<PetItem['category']>('clothing');
  const [trial, setTrial] = useState<string | null>(null); // 상점에서 입어 보는 물건 (서버에는 아무것도 안 바뀜)
  const [talkMode, setTalkMode] = useState<'teach' | 'chat'>('teach');
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState('');
  const [speech, setSpeech] = useState('');
  const [hearts, setHearts] = useState<number[]>([]);
  const [editing, setEditing] = useState(false);
  const [newName, setNewName] = useState('');
  const [text, setText] = useState('');
  const [chat, setChat] = useState<{ role: 'user' | 'model'; text: string }[]>([]);
  const [adopting, setAdopting] = useState(false); // 새 친구 고르기
  const [pick, setPick] = useState<string | null>(null);
  const [celebrate, setCelebrate] = useState(false); // Lv.100 축하
  const [feedRun, setFeedRun] = useState<FeedRunView | null>(null); // 단어 먹이 주기 (서버에 저장된 판)
  const [feedOpen, setFeedOpen] = useState(false);
  const [expedition, setExpedition] = useState<ExpeditionView | null>(null);
  const [mapOpen, setMapOpen] = useState(false);
  const [guildOpen, setGuildOpen] = useState(false);
  const toastTimer = useRef<number>();
  const evolved = useRef(new Set<string>());

  useEffect(() => onAuthStateChanged(auth, setUser), []);
  const say = (message: string) => { setToast(message); window.clearTimeout(toastTimer.current); toastTimer.current = window.setTimeout(() => setToast(''), 2800); };
  const load = useCallback(async () => {
    if (!user) return;
    try { const r = await PetService.load(user.uid); setState(r.state); setPending(r.pendingRewards || 0); if ('run' in r) setFeedRun(r.run || null); if (r.expedition) setExpedition(r.expedition); setLoadError(''); }
    catch (e: any) { setLoadError(e?.message || '펫을 불러오지 못했어요.'); }
  }, [user]);
  useEffect(() => { void load(); }, [load]);
  // A game left unfinished (here or on another device) comes with the load above and shows as 이어 하기.
  // A new day (energy refill) or rewards that arrived while away: refresh when the screen comes back.
  useEffect(() => { const back = () => { if (document.visibilityState === 'visible') void load(); }; document.addEventListener('visibilitychange', back); return () => document.removeEventListener('visibilitychange', back); }, [load]);

  const pet = state?.pets.find(p => p.slot === state.currentPetSlot);
  useEffect(() => { if (pet && !speech) setSpeech(idleLine(pet.level, Date.now())); }, [pet?.level]); // eslint-disable-line react-hooks/exhaustive-deps

  /** One server action; level-ups get confetti, refusals a short message. */
  const act = async (action: string, payload: Record<string, unknown> = {}) => {
    if (busy || !pet) return null;
    setBusy(true);
    try {
      // Compare the same pet before and after: switching to (or adopting) another pet is not a level-up.
      const slot = pet.slot, before = pet.level, r = await PetService.act(action, payload);
      setState(r.state);
      const after = r.state.pets.find(p => p.slot === slot)?.level ?? before;
      if (after > before) { confetti({ particleCount: after >= PET_MAX_LEVEL ? 220 : 120, spread: after >= PET_MAX_LEVEL ? 100 : 70, origin: { y: 0.6 }, colors: ['#f5a3a8', '#e07a87', '#fde3e6', '#ffd68a'] }); say(`레벨 업! Lv.${after}`); }
      if (after >= PET_MAX_LEVEL && before < PET_MAX_LEVEL && r.state.pets.length < r.state.unlockedSlots) setCelebrate(true);
      return r;
    } catch (e: any) { say(e?.message || '잠시 후 다시 해 주세요.'); return null; }
    finally { setBusy(false); }
  };

  // Idle lines: sometimes a phrase the pet learned (grown to its level; asked once per phrase per visit).
  useEffect(() => {
    if (!pet || !pet.learnedPhrases.length) return;
    const timer = window.setInterval(async () => {
      if (busy) return;
      const phrase = pet.learnedPhrases[Math.floor(Math.random() * pet.learnedPhrases.length)], key = String(Math.floor(pet.level / 10) * 10);
      let line = phrase.evolvedVersions[key];
      if (!line && !evolved.current.has(phrase.original)) { evolved.current.add(phrase.original); const r = await PetService.act('evolve', { text: phrase.original }).catch(() => null); if (r) { setState(r.state); line = r.result?.reply; } }
      if (line) { setSpeech(line); window.setTimeout(() => setSpeech(idleLine(pet.level, Date.now())), 6000); }
    }, 40000);
    return () => window.clearInterval(timer);
  }, [pet?.learnedPhrases.length, pet?.level, busy]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loadError) return <div className="min-h-screen bg-white px-4 py-10 text-center"><p className="text-sm text-slate-500">{loadError}</p><button type="button" onClick={() => void load()} className="mt-3 rounded-xl border border-[#f3d5da] px-4 py-2 text-sm font-bold text-[#8b2f40]">다시 불러오기</button><button type="button" onClick={onBack} className="mt-3 block w-full text-sm text-slate-400">홈으로</button></div>;
  if (!state || !pet) return <div className="min-h-screen bg-white" aria-busy="true" />;

  const stage = petStage(pet.level), atMax = pet.level >= PET_MAX_LEVEL, need = xpNeeded(pet.level);
  const owned = (id: string) => id === 'default' || state.inventory.includes(id);
  const worn = (item: PetItem) => item.category === 'clothing' ? state.clothing === item.id : item.category === 'accessory' ? state.accessory === item.id : state.background === item.id;
  const tried = trial ? petItem(trial) : undefined;
  const look = { clothing: tried?.category === 'clothing' ? tried.id : state.clothing, accessory: tried?.category === 'accessory' ? tried.id : state.accessory, background: tried?.category === 'background' ? tried.id : state.background };
  const buyTried = async () => { if (!tried) return; const r = await act('buy', { itemId: tried.id, wear: true }); if (r) { setTrial(null); say(`${tried.name} 구매 완료! 바로 입혀 줬어요`); } };
  const wearTried = async () => { if (!tried) return; if (!worn(tried)) await act('equip', { itemId: tried.id }); setTrial(null); };
  const petIt = async () => { const r = await act('pet'); if (r) { const id = Date.now(); setHearts(h => [...h, id]); window.setTimeout(() => setHearts(h => h.filter(x => x !== id)), 900); } };
  const rename = async () => { const name = newName.trim(); setEditing(false); if (!name || name === pet.name) return; const r = await act('rename', { name }); if (r) setSpeech(stage === 'baby' ? '좋아!' : `${name}! 마음에 들어!`); };
  const teach = async (e: React.FormEvent) => { e.preventDefault(); const t = text.trim(); if (!t) return; const r = await act('teach', { text: t }); if (r) { setText(''); setSpeech(r.result?.reply || ''); say('말을 배웠어요!'); } };
  const talk = async (e: React.FormEvent) => { e.preventDefault(); const t = text.trim(); if (!t) return; const history = chat.slice(-6); setChat(c => [...c, { role: 'user', text: t }]); setText(''); const r = await act('chat', { text: t, history }); const reply = r?.result?.reply; setChat(c => [...c, { role: 'model', text: reply || '대화가 잠깐 끊겼어요…' }]); if (reply) setSpeech(reply); };
  const canAdopt = state.pets.length < Math.min(state.unlockedSlots, PET_MAX_PETS), many = state.pets.length > 1;
  const others = state.pets.filter(p => p.slot !== pet.slot);
  const switchTo = async (slot: number) => { if (slot === pet.slot) return; const r = await act('switch', { slot }); if (r) { const next = r.state.pets.find(p => p.slot === slot); setTrial(null); setChat([]); setEditing(false); if (next) setSpeech(idleLine(next.level, Date.now())); } };
  const openAdopt = () => { setCelebrate(false); setPick(null); setAdopting(true); };
  const confirmPick = async () => { if (!pick) return; const r = await act(pet.chosen ? 'adopt' : 'choose', { character: pick }); if (r) { setAdopting(false); setPick(null); setTrial(null); setChat([]); setSpeech(idleLine(1, Date.now())); if (pet.chosen) say('새 친구가 왔어요!'); } };
  const feedSend = async (action: string, payload: Record<string, unknown> = {}) => { const r: any = await PetService.act(action, payload); if (r.state) setState(r.state); if ('run' in r) setFeedRun(r.run || null); if (r.expedition) setExpedition(r.expedition); return r; };
  const openFeed = async () => {
    if (busy) return; setBusy(true);
    try { const r = await feedSend('feed-start', feedRun && !feedRun.finished && feedRun.stage ? { stage: feedRun.stage } : {}); if (r.run) setFeedOpen(true); }
    catch (e: any) { say(e?.message || '잠시 후 다시 해 주세요.'); }
    finally { setBusy(false); }
  };
  const feedResume = feedRun && !feedRun.finished;
  const claim = async () => { const r = await act('claim-study'); if (r) { setPending(0); say(`공부 보상 +${won(r.result?.points || 0)}P!`); } };

  const itemCard = (item: PetItem, mode: 'buy' | 'wear' | 'try') => {
    const wearable = item.category !== 'consumable', has = owned(item.id), on = worn(item), poor = state.points < item.price, energyUsed = Boolean(item.energy) && !(state.today.energyItemsLeft > 0);
    const effect = item.xp ? `경험치 +${item.xp}` : item.energy ? `기운 +${item.energy}` : '';
    const label = mode === 'try' ? (has ? (on ? '입는 중' : '가짐') : item.reward ? '원정대 전용' : `${won(item.price)}P`) : mode === 'wear' ? (on ? '입는 중' : '입기') : wearable && has ? (on ? '입는 중' : '가짐') : energyUsed ? '오늘 다 먹음' : `${won(item.price)}P`;
    const blocked = mode === 'buy' && (wearable ? has || poor : energyUsed || poor);
    const disabled = busy || blocked, dim = blocked && !(wearable && has);
    const picked = mode === 'try' && trial === item.id;
    const onClick = () => mode === 'try' ? setTrial(picked ? null : item.id) : mode === 'wear' ? void act('equip', { itemId: item.id }) : void act('buy', { itemId: item.id }).then(r => { if (r?.result?.message) say(r.result.message); });
    return <button key={item.id} type="button" disabled={disabled} aria-pressed={mode === 'try' ? picked : undefined} onClick={onClick} className={`flex flex-col items-center gap-0.5 rounded-2xl border bg-white px-1.5 py-2.5 text-center transition-colors ${picked ? 'border-2 border-[#d26272]' : on ? 'border-[#d26272]' : 'border-[#f3e6e8] hover:border-[#f5a3a8]'} ${dim ? 'opacity-50' : ''}`}>
      {item.reward && <span className="-mb-1 rounded-full bg-[#eef6ea] px-1.5 text-[10px] font-bold text-[#4f7a43]">원정대</span>}
      <span className="text-2xl" aria-hidden="true">{item.icon}</span>
      <span className="text-xs font-bold text-[#5e1e2a]">{item.name}</span>
      {effect && <span className="text-[11px] text-slate-500">{effect}</span>}
      <span className={`mt-1 w-full rounded-full py-0.5 text-[11px] font-bold ${on ? 'border border-[#d26272] text-[#8b2f40]' : item.reward && !has ? 'bg-[#eef6ea] text-[#4f7a43]' : mode !== 'wear' && !has && !energyUsed ? 'bg-[#f5a3a8] text-[#5e1e2a]' : 'bg-[#f8f1f2] text-[#8b2f40]'}`}>{label}</span>
    </button>;
  };

  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto max-w-md px-4 pb-10">
        <header className="flex items-center justify-between py-3">
          <button type="button" onClick={onBack} className="flex items-center gap-0.5 text-sm font-bold text-[#8b2f40]"><ChevronLeft size={18} aria-hidden="true" />홈</button>
          <h1 className="text-base font-black text-[#5e1e2a]">나만의 펫</h1>
          <span className="flex items-center gap-1 rounded-full border border-[#f3d5da] px-2.5 py-1 text-xs font-bold text-[#8b2f40]"><span className="h-2 w-2 rounded-full bg-[#e07a87]" aria-hidden="true" />{won(state.points)}P</span>
        </header>

        {(many || canAdopt) && <div role="tablist" aria-label="내 펫" className="-mx-1 mb-2 flex gap-2 overflow-x-auto px-1 pb-1">
          {state.pets.map(p => <button key={p.slot} type="button" role="tab" aria-selected={p.slot === pet.slot} disabled={busy} onClick={() => void switchTo(p.slot)} className="flex w-14 flex-none flex-col items-center text-[11px] font-bold text-[#8b2f40]">
            <span className={`flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-[#fdf6f7] ${p.slot === pet.slot ? 'border-2 border-[#d26272]' : 'border border-[#f3e6e8]'}`}><PetCharacter character={p.character} stage={petStage(p.level)} accessory={p.accessory} portrait size={44} /></span>
            <span className="mt-0.5 max-w-full truncate">{p.name}</span><span className="font-medium text-slate-500">Lv.{p.level}</span>
          </button>)}
          {canAdopt && <button type="button" onClick={openAdopt} className="relative flex w-14 flex-none flex-col items-center text-[11px] font-bold text-[#d26272]">
            <span className="flex h-12 w-12 items-center justify-center rounded-full border-[1.5px] border-dashed border-[#e6a3b0] bg-white"><Plus size={20} aria-hidden="true" /></span>
            <span className="mt-0.5">새 친구</span><span className="absolute right-1 top-0 h-2.5 w-2.5 rounded-full border-[1.5px] border-white bg-[#e0507a]" aria-label="데려올 수 있어요" />
          </button>}
        </div>}

        <section aria-label="펫" className="overflow-hidden rounded-3xl border border-[#f3e6e8]">
          <div className={`relative flex min-h-[230px] flex-col items-center justify-end px-4 pb-4 pt-5 ${SCENE[look.background] || SCENE.default}`}>
            <SceneArt id={look.background} />
            {tried && <span className="absolute left-3 top-3 z-20 rounded-full border border-[#f3d5da] bg-white px-2 py-0.5 text-[11px] font-bold text-[#b04a5a]">입어 보는 중</span>}
            {look.background === 'star_room' && STARS.map((s, i) => <span key={i} aria-hidden="true" className="absolute animate-pulse rounded-full bg-white" style={{ top: `${s.top}%`, left: `${s.left}%`, width: s.size, height: s.size, animationDelay: `${s.delay}s` }} />)}
            <p className="relative z-10 mb-2 max-w-[85%] rounded-2xl border border-[#f3d5da] bg-white px-3 py-1.5 text-center text-xs font-medium text-[#5e1e2a]">{cleanPetSpeech(speech, petEmojiLimit(pet.level)) || '…'}</p>
            {others.slice(0, SPOTS.length).map((p, i) => <button key={p.slot} type="button" disabled={busy} onClick={() => void switchTo(p.slot)} aria-label={`${p.name}(으)로 바꾸기`} className="absolute bottom-3 z-[5]" style={SPOTS[i]}>
              <PetCharacter character={p.character} stage={petStage(p.level)} clothing={p.clothing} accessory={p.accessory} size={58} />
            </button>)}
            <motion.button type="button" whileTap={{ scale: 0.95 }} onClick={() => void petIt()} aria-label={`${pet.name} 쓰다듬기 (기운 -${PET_ACTIONS.pet.energy})`} className="relative z-10">
              <PetCharacter character={pet.character} stage={stage} clothing={look.clothing} accessory={look.accessory} background={look.background} />
              <AnimatePresence>{hearts.map(id => <motion.span key={id} initial={{ opacity: 1, y: 0 }} animate={{ opacity: 0, y: -60 }} exit={{ opacity: 0 }} className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2"><Heart size={22} className="fill-[#e07a87] text-[#e07a87]" aria-hidden="true" /></motion.span>)}</AnimatePresence>
            </motion.button>
          </div>
          <div className="border-t border-[#f3e6e8] bg-white px-4 py-3">
            <div className="flex items-center justify-center gap-2">
              {editing ? <span className="flex items-center gap-1"><input value={newName} maxLength={12} autoFocus onChange={e => setNewName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') void rename(); if (e.key === 'Escape') setEditing(false); }} aria-label="펫 이름" className="w-28 rounded-lg border border-[#f3d5da] px-2 py-1 text-sm" /><button type="button" onClick={() => void rename()} aria-label="이름 저장" className="text-[#8b2f40]"><Check size={16} /></button><button type="button" onClick={() => setEditing(false)} aria-label="취소" className="text-slate-400"><X size={16} /></button></span>
                : <><b className="text-base font-black text-[#5e1e2a]">{pet.name}</b><button type="button" onClick={() => { setNewName(pet.name); setEditing(true); }} aria-label="이름 바꾸기" className="text-slate-300 hover:text-[#8b2f40]"><Pencil size={13} /></button></>}
              <span className="rounded-full bg-[#8b2f40] px-2 py-0.5 text-[11px] font-bold text-white">Lv.{pet.level}</span>
              <span className="text-xs text-slate-500">{PET_STAGE_LABEL[stage]}{many && ' · 대표 펫'}</span>
            </div>
            <div className="mt-3 space-y-2 text-xs text-slate-500">
              <div><div className="mb-1 flex justify-between"><span>경험치</span><span>{atMax ? '최고 레벨' : `${won(pet.xp)} / ${won(need)}`}</span></div><div className="h-2 overflow-hidden rounded-full bg-[#f6e3e6]"><div className="h-full rounded-full bg-[#e07a87] transition-all" style={{ width: `${atMax ? 100 : Math.min(100, (pet.xp / need) * 100)}%` }} /></div></div>
              <div><div className="mb-1 flex justify-between"><span>기운</span><span>{pet.energy} / {pet.maxEnergy}</span></div><div className="h-2 overflow-hidden rounded-full bg-[#f6e3e6]"><div className="h-full rounded-full bg-[#f5b36b] transition-all" style={{ width: `${Math.min(100, (pet.energy / pet.maxEnergy) * 100)}%` }} /></div></div>
            </div>
            {atMax && <p className="mt-2 text-center text-[11px] text-slate-500">{canAdopt ? <>최고 레벨이에요! <button type="button" onClick={openAdopt} className="font-bold text-[#d26272] underline">새 친구 데려오기</button></> : many ? '최고 레벨이에요. 다른 친구를 대표 펫으로 바꾸면 경험치를 받아요.' : '최고 레벨이에요!'}</p>}
            {many && !atMax && <p className="mt-2 text-center text-[11px] text-slate-400">공부 경험치는 대표 펫이 받아요 · 포인트와 옷장은 함께 써요</p>}
            <p role="status" aria-live="polite" className="mt-2 min-h-[18px] text-center text-xs font-bold text-[#b04a5a]">{toast}</p>
          </div>
        </section>

        <section aria-label="오늘의 포인트" className="mt-3 rounded-2xl border border-[#f3e6e8] bg-white px-4 py-3">
          <div className="flex items-center justify-between"><b className="text-sm font-black text-[#5e1e2a]">오늘의 포인트</b><span className="text-xs text-slate-500">{won(state.today.studyPoints)} / {won(state.today.studyCap)}P</span></div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#f6e3e6]"><div className="h-full rounded-full bg-[#f5a3a8]" style={{ width: `${Math.min(100, (state.today.studyPoints / Math.max(1, state.today.studyCap)) * 100)}%` }} /></div>
          {pending > 0 ? <div className="mt-3 flex items-center gap-2 rounded-xl bg-[#fef2f3] px-3 py-2"><Gift size={16} className="flex-none text-[#d26272]" aria-hidden="true" /><span className="flex-1 text-xs text-[#5e1e2a]"><b className="font-bold">공부 보상 {pending}개 도착</b><span className="block text-slate-500">출석 +{PET_ATTENDANCE_REWARD.points}P · 과제 완료 +{PET_ASSIGNMENT_REWARD.points}P</span></span><button type="button" disabled={busy} onClick={() => void claim()} className="rounded-lg bg-[#d26272] px-3 py-1.5 text-xs font-bold text-white disabled:opacity-60">받기</button></div>
            : <p className="mt-2 text-xs text-slate-400">수업에 출석하거나 과제를 완료하면 보상이 와요.</p>}
        </section>

        {expedition && (() => { const c = expedition.chapters.find(x => expedition.current.startsWith(x.id + '-'))!, n = Number(expedition.current.split('-')[1]); return <section aria-label="원정대" className="mt-3 flex items-center gap-3 rounded-2xl border border-[#f3e6e8] bg-white px-4 py-3">
          <span className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-[#eef6ea] text-lg" aria-hidden="true">🗺️</span>
          <span className="min-w-0 flex-1"><b className="block text-sm font-black text-[#5e1e2a]">원정대</b><span className="block text-xs text-slate-500">{expedition.allCleared ? '모든 장 완료!' : expedition.currentNeedsLevel ? `${c.title} · 대표 펫 Lv.${expedition.currentNeedsLevel}부터` : `${c.title} ${n}단계`} · ★ {expedition.totalStars} / {expedition.maxStars}</span></span>
          <span className="flex flex-none gap-1.5"><button type="button" onClick={() => setGuildOpen(true)} className="rounded-xl border border-[#f3d5da] px-3 py-2 text-xs font-bold text-[#8b2f40]">길드</button><button type="button" onClick={() => setMapOpen(true)} className="rounded-xl bg-[#e0587a] px-3.5 py-2 text-xs font-bold text-white">지도</button></span>
        </section>; })()}

        <section aria-label="단어 먹이 주기" className="mt-3 flex items-center gap-3 rounded-2xl border border-[#f3e6e8] bg-white px-4 py-3">
          <span className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-[#fef2f3] text-lg" aria-hidden="true">🍪</span>
          <span className="min-w-0 flex-1"><b className="block text-sm font-black text-[#5e1e2a]">단어 먹이 주기</b><span className="block text-xs text-slate-500">{feedResume ? `하던 곳이 저장돼 있어요 · ${feedRun!.index + 1}번째 문제부터` : `최근 공부한 단어장으로 ${PET_WORD_FEED.questions}문제 · 기운 ${PET_WORD_FEED.energy}`}</span></span>
          <button type="button" disabled={busy} onClick={() => void openFeed()} className="flex-none rounded-xl bg-[#e0587a] px-3.5 py-2 text-xs font-bold text-white disabled:opacity-60">{feedResume ? '이어 하기' : '시작'}</button>
        </section>

        <div role="tablist" aria-label="펫 메뉴" className="mt-3 grid grid-cols-4 gap-1 rounded-2xl border border-[#f3e6e8] bg-white p-1">
          {TABS.map(t => <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => { setTab(t.id); setText(''); setTrial(null); }} className={`rounded-xl py-2 text-xs font-bold transition-colors ${tab === t.id ? 'bg-[#fef2f3] text-[#8b2f40]' : 'text-slate-400 hover:text-slate-600'}`}><span className="block text-base" aria-hidden="true">{t.icon}</span>{t.label}</button>)}
        </div>

        <section className="mt-3" role="tabpanel">
          {tab === 'snacks' && <div className="grid grid-cols-3 gap-2">{PET_ITEMS.filter(i => i.category === 'consumable').map(i => itemCard(i, 'buy'))}</div>}
          {tab === 'closet' && (() => { const mine = PET_ITEMS.filter(i => i.category !== 'consumable' && owned(i.id)); return mine.length > 1 ? <div className="grid grid-cols-3 gap-2">{mine.map(i => itemCard(i, 'wear'))}</div> : <p className="rounded-2xl border border-dashed border-[#f3d5da] px-4 py-6 text-center text-sm text-slate-500">아직 옷이 없어요. 상점에서 골라 보세요!</p>; })()}
          {tab === 'shop' && <>
            <div className="mb-2 flex gap-1">{SHOP_GROUPS.map(g => <button key={g.id} type="button" aria-pressed={shopGroup === g.id} onClick={() => { setShopGroup(g.id); setTrial(null); }} className={`flex-1 rounded-xl py-1.5 text-xs font-bold ${shopGroup === g.id ? 'bg-[#fef2f3] text-[#8b2f40]' : 'text-slate-400'}`}>{g.label}</button>)}</div>
            <div className="grid grid-cols-3 gap-2">{PET_ITEMS.filter(i => i.category === shopGroup && i.id !== 'default').map(i => itemCard(i, 'try'))}</div>
            {tried?.reward && !owned(tried.id) ? (() => { const c = PET_EXPEDITION.chapters.find(x => x.reward === tried.id); return <div className="sticky bottom-2 mt-3 flex items-center gap-2 rounded-2xl border border-[#d9e8d2] bg-white px-3 py-2.5">
              <div className="min-w-0 flex-1 text-xs text-[#5e1e2a]"><b className="font-bold">{tried.icon} {tried.name}</b><span className="block text-[#4f7a43]">원정대에서만 얻어요 · {c?.title} 완료 보상</span></div>
              <button type="button" onClick={() => setTrial(null)} className="rounded-xl border border-[#f3d5da] px-3 py-1.5 text-xs font-bold text-[#8b2f40]">원래대로</button>
              <button type="button" onClick={() => { setTrial(null); setMapOpen(true); }} className="rounded-xl bg-[#e0587a] px-3.5 py-1.5 text-xs font-bold text-white">원정대 가기</button>
            </div>; })() : tried ? (() => { const has = owned(tried.id), short = tried.price - state.points; return <div className="sticky bottom-2 mt-3 flex items-center gap-2 rounded-2xl border border-[#f3e6e8] bg-white px-3 py-2.5">
              <div className="min-w-0 flex-1 text-xs text-[#5e1e2a]"><b className="font-bold">{tried.name} · {won(tried.price)}P</b>
                <span className={`block ${!has && short > 0 ? 'text-[#b04a5a]' : 'text-slate-500'}`}>{has ? (worn(tried) ? '지금 입고 있어요' : '이미 가지고 있어요') : short > 0 ? `${won(short)}P 더 모으면 살 수 있어요` : '사면 바로 입혀 줘요'}</span></div>
              <button type="button" onClick={() => setTrial(null)} className="rounded-xl border border-[#f3d5da] px-3 py-1.5 text-xs font-bold text-[#8b2f40]">원래대로</button>
              {has ? <button type="button" disabled={busy} onClick={() => void wearTried()} className="rounded-xl bg-[#d26272] px-3.5 py-1.5 text-xs font-bold text-white disabled:opacity-60">{worn(tried) ? '확인' : '입기'}</button>
                : <button type="button" disabled={busy || short > 0} onClick={() => void buyTried()} className="rounded-xl bg-[#d26272] px-3.5 py-1.5 text-xs font-bold text-white disabled:bg-[#f8f1f2] disabled:text-[#b9a0a5]">사기</button>}
            </div>; })() : <p className="mt-2 text-center text-xs text-slate-400">누르면 먼저 입어 볼 수 있어요. 포인트가 모자라도 괜찮아요.</p>}
          </>}
          {tab === 'talk' && <div className="rounded-2xl border border-[#f3e6e8] bg-white p-3">
            <div className="mb-3 flex gap-1 rounded-xl bg-[#f8f1f2] p-1">{(['teach', 'chat'] as const).map(m => <button key={m} type="button" aria-pressed={talkMode === m} onClick={() => setTalkMode(m)} className={`flex-1 rounded-lg py-1.5 text-xs font-bold ${talkMode === m ? 'bg-white text-[#8b2f40] shadow-sm' : 'text-slate-500'}`}>{m === 'teach' ? `말 가르치기 · 기운 ${PET_ACTIONS.teach.energy}` : `대화하기 · 기운 ${PET_ACTIONS.chat.energy}`}</button>)}</div>
            {talkMode === 'chat' && <div className="mb-2 max-h-56 space-y-1.5 overflow-y-auto">{chat.length ? chat.map((m, i) => <p key={i} className={`max-w-[85%] rounded-2xl px-3 py-1.5 text-xs ${m.role === 'user' ? 'ml-auto bg-[#fef2f3] text-[#5e1e2a]' : 'bg-[#f8fafc] text-slate-700'}`}>{m.role === 'model' ? cleanPetSpeech(m.text, petEmojiLimit(pet.level)) : m.text}</p>) : <p className="text-center text-xs text-slate-400">{pet.name}에게 말을 걸어 보세요.</p>}</div>}
            {talkMode === 'teach' && <p className="mb-2 text-xs text-slate-500">가르친 말은 펫이 기억했다가 가끔 혼잣말로 해요. 레벨이 오르면 더 똑똑하게 말해요.</p>}
            <form onSubmit={talkMode === 'teach' ? teach : talk} className="flex gap-2">
              <input value={text} maxLength={talkMode === 'teach' ? 100 : 200} onChange={e => setText(e.target.value)} placeholder={talkMode === 'teach' ? '예: 오늘도 화이팅!' : '오늘 뭐 했어?'} aria-label={talkMode === 'teach' ? '가르칠 말' : '펫에게 할 말'} className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-[#eaa0a9] focus:bg-white" />
              <button type="submit" disabled={busy || !text.trim()} className="rounded-xl bg-[#d26272] px-4 text-sm font-bold text-white disabled:opacity-50">{talkMode === 'teach' ? '가르치기' : '보내기'}</button>
            </form>
          </div>}
        </section>

        <details className="mt-4 rounded-2xl border border-[#f3e6e8] bg-white px-4 py-3 text-xs text-slate-500">
          <summary className="cursor-pointer font-bold text-[#8b2f40]">포인트 받는 법</summary>
          <ul className="mt-2 space-y-1">
            <li>단어 테스트 1문제 맞힐 때마다 {PET_STUDY_RATES['vocab-test'].points}P · 단어장 퀴즈 1문제 {PET_STUDY_RATES['wordbook-quiz'].points}P · 오답 복습 {PET_STUDY_RATES['review-confirm'].points}P</li>
            <li>공부로 받는 포인트는 하루 최대 {won(state.today.studyCap)}P</li>
            <li>수업 출석 +{PET_ATTENDANCE_REWARD.points}P · 과제 완료 +{PET_ASSIGNMENT_REWARD.points}P (하루 한도와 별도)</li>
            <li>기운은 매일 다시 가득 차요. 기운 회복 간식은 하루에 두 번까지</li>
          </ul>
        </details>
      </div>

      <AnimatePresence>{(!pet.chosen || adopting) && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 p-4">
        <div role="dialog" aria-modal="true" aria-labelledby="pet-pick-title" className="w-full max-w-md rounded-3xl bg-white p-5 text-center">
          <h2 id="pet-pick-title" className="text-lg font-black text-[#5e1e2a]">{pet.chosen ? '함께 살 새 친구를 골라 주세요' : '함께 공부할 친구를 골라 주세요'}</h2>
          <p className="mt-1 text-xs text-slate-500">{pet.chosen ? 'Lv.1부터 새로 키워요. 데려오면 대표 펫이 돼요.' : '한 번 고르면 바꿀 수 없어요. 이름은 나중에 바꿀 수 있어요.'}</p>
          <div className="mt-4 grid grid-cols-3 gap-2">{PET_CHARACTERS.map(c => { const home = pet.chosen && state.pets.some(p => p.character === c.id); return <button key={c.id} type="button" disabled={busy || home} aria-pressed={pick === c.id} onClick={() => setPick(c.id)} className={`flex flex-col items-center rounded-2xl border bg-[#fdf6f7] p-2 ${pick === c.id ? 'border-2 border-[#d26272]' : 'border-[#f3e6e8] hover:border-[#f5a3a8]'} ${home ? 'opacity-45' : ''}`}><span className="flex h-24 items-end justify-center overflow-hidden"><PetCharacter character={c.id} stage="baby" /></span><b className="text-sm font-bold text-[#5e1e2a]">{c.name}</b>{home && <span className="text-[11px] text-slate-500">함께 사는 중</span>}</button>; })}</div>
          <button type="button" disabled={busy || !pick} onClick={() => void confirmPick()} className="mt-4 w-full rounded-xl bg-[#d26272] py-2.5 text-sm font-bold text-white disabled:bg-[#f8f1f2] disabled:text-[#b9a0a5]">{!pick ? '친구를 골라 주세요' : pet.chosen ? `${PET_CHARACTERS.find(c => c.id === pick)?.name} 데려오기` : '이 친구와 시작하기'}</button>
          {pet.chosen && <button type="button" onClick={() => setAdopting(false)} className="mt-2 text-xs text-slate-400">나중에 할게요</button>}
        </div>
      </motion.div>}</AnimatePresence>

      {mapOpen && <ExpeditionMap state={state} send={feedSend} onClose={() => setMapOpen(false)} onGuild={() => { setMapOpen(false); setGuildOpen(true); }} />}
      {guildOpen && <GuildHall send={feedSend} onClose={() => setGuildOpen(false)} />}
      {feedOpen && feedRun && <WordFeed run={feedRun} state={state} send={feedSend} onClose={() => setFeedOpen(false)} />}

      <AnimatePresence>{celebrate && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 p-4">
        <div role="dialog" aria-modal="true" aria-labelledby="pet-max-title" className="w-full max-w-xs rounded-3xl bg-white p-5 text-center">
          <div className="flex items-end justify-center gap-2"><PetCharacter character={pet.character} stage={stage} clothing={pet.clothing} accessory={pet.accessory} size={84} /><span className="mb-8 text-xl font-black text-[#d26272]">+</span><span className="mb-2 flex h-20 w-16 items-center justify-center rounded-2xl border-[1.5px] border-dashed border-[#e6a3b0] text-2xl font-black text-[#d26272]">?</span></div>
          <h2 id="pet-max-title" className="mt-2 text-base font-black text-[#5e1e2a]">{pet.name}이(가) Lv.{PET_MAX_LEVEL}이 됐어요!</h2>
          <p className="mt-1 text-xs text-[#8b2f40]">새 친구를 한 마리 더 데려올 수 있어요</p>
          <button type="button" onClick={openAdopt} className="mt-4 w-full rounded-xl bg-[#d26272] py-2.5 text-sm font-bold text-white">새 친구 고르기</button>
          <button type="button" onClick={() => setCelebrate(false)} className="mt-2 text-xs text-slate-400">나중에 할게요</button>
        </div>
      </motion.div>}</AnimatePresence>
    </div>
  );
}
