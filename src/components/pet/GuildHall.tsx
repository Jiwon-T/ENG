import React, { useEffect, useState } from 'react';
import { ChevronLeft } from 'lucide-react';
import { PetCharacter } from './PetCharacters';
import { askConfirm } from '../teacher/ConfirmDialog';
import { PET_PARTY, petStage } from '../../lib/petCatalog';

// 모험가 길드: the board of team notes (fixed phrases only), my team this week, and the team ranking. Students only see
// nicknames and pets here — never real names, even from the same academy.
interface Look { character: string; name: string; level: number; clothing: string | null; accessory: string | null }
interface MemberView { index: number; rank: number; nickname: string; pet: Look; count: number; status: string; me: boolean; idleDays: number; votes: number; votedByMe: boolean; needVotes: number; canVote: boolean }
interface PartyView { id: string; endDay: string; name: string; boss: string; size: number; phrases: string[]; hp: number; hpMax: number; progress: number; members: MemberView[] }
interface GuildView { nickname: string; shown: string; warned: boolean; joinedThisWeek: boolean; lastResult: { week: string; party: string; progress: number; reward: number; counted: boolean } | null }
type Send = (action: string, payload?: Record<string, unknown>) => Promise<any>;

const boss = (id: string) => PET_PARTY.bosses.find(b => b.id === id) || PET_PARTY.bosses[0];
const Pet: React.FC<{ pet: Look; size?: number }> = ({ pet, size = 22 }) => <span className="inline-flex items-center justify-center overflow-hidden rounded-full border border-[#f3d5da] bg-[#fdecef]" style={{ width: size, height: size }}><PetCharacter character={pet.character} stage={petStage(pet.level)} accessory={pet.accessory} portrait size={size - 2} /></span>;
const dDay = (end: string) => { const days = Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(new Date().toISOString().slice(0, 10) + 'T00:00:00Z')) / 86_400_000); return days <= 0 ? '오늘 마감' : `D-${days}`; };
const Chip: React.FC<{ on: boolean; children: React.ReactNode; onClick: () => void }> = ({ on, children, onClick }) => <button type="button" aria-pressed={on} onClick={onClick} className={`rounded-full border px-3 py-1 text-xs font-bold ${on ? 'border-[#e0587a] bg-[#e0587a] text-white' : 'border-[#eadcc2] bg-[#fffdf6] text-[#6b5a40]'}`}>{children}</button>;

export default function GuildHall({ send, onClose }: { send: Send; onClose: () => void }) {
  const [tab, setTab] = useState<'board' | 'team' | 'rank'>('board');
  const [guild, setGuild] = useState<GuildView | null>(null);
  const [party, setParty] = useState<PartyView | null>(null);
  const [notes, setNotes] = useState<any[]>([]);
  const [rows, setRows] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [nick, setNick] = useState('');
  const [making, setMaking] = useState(false);
  const [form, setForm] = useState({ nameA: PET_PARTY.nameA[0] as string, nameB: PET_PARTY.nameB[0] as string, boss: 'forest', size: 4, phrases: [PET_PARTY.phrases[0]] as string[] });

  const apply = (r: any) => { if (r.guild) setGuild(r.guild); if ('party' in r) setParty(r.party); return r; };
  const run = async (fn: () => Promise<any>) => { setBusy(true); setNotice(''); try { return await fn(); } catch (e: any) { setNotice(e?.message || '잠시 후 다시 해 주세요.'); return null; } finally { setBusy(false); } };
  const loadBoard = () => send('guild-board').then(r => setNotes(r.notes || []));
  const loadRank = () => send('guild-ranking').then(r => setRows(r.rows || []));
  useEffect(() => { void run(async () => { const r = apply(await send('guild-state')); if (r.party) setTab('team'); await loadBoard(); }); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (tab === 'rank') void loadRank().catch(() => undefined); if (tab === 'board') void loadBoard().catch(() => undefined); }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!guild) return <div className="fixed inset-0 z-[80] bg-white" aria-busy="true">{notice && <p className="p-6 text-center text-sm text-slate-500">{notice}</p>}</div>;
  const needNick = !guild.nickname || guild.warned;

  return (
    <div role="dialog" aria-modal="true" aria-label="모험가 길드" className="fixed inset-0 z-[80] overflow-y-auto bg-white">
      <div className="mx-auto max-w-md px-4 pb-8 pt-3">
        <header className="flex items-center justify-between">
          <button type="button" onClick={onClose} className="flex items-center gap-0.5 text-sm font-bold text-[#8b2f40]"><ChevronLeft size={18} aria-hidden="true" />뒤로</button>
          <h1 className="text-base font-black text-[#5e1e2a]">모험가 길드</h1>
          <span className="max-w-[90px] truncate text-xs font-bold text-[#8b2f40]">{guild.shown}</span>
        </header>
        {guild.lastResult && <p className="mt-3 rounded-2xl bg-[#fef2f3] px-4 py-2 text-xs text-[#5e1e2a]">지난 주 <b className="font-bold">{guild.lastResult.party}</b> {guild.lastResult.progress}% · {guild.lastResult.reward > 0 ? <b className="font-bold">+{guild.lastResult.reward}P 받았어요</b> : guild.lastResult.counted ? '30%를 넘지 못해 보상이 없어요' : '10문제를 채우지 못해 보상이 없어요'}</p>}
        <div role="tablist" aria-label="길드 메뉴" className="mt-3 grid grid-cols-3 gap-1 rounded-2xl bg-[#f8f1f2] p-1">
          {([['board', '게시판'], ['team', '우리 팀'], ['rank', '순위표']] as const).map(([id, label]) => <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className={`rounded-xl py-1.5 text-xs font-bold ${tab === id ? 'bg-white text-[#8b2f40] shadow-sm' : 'text-slate-500'}`}>{label}</button>)}
        </div>
        {notice && <p role="alert" className="mt-3 text-center text-xs font-bold text-[#b04a5a]">{notice}</p>}

        {tab === 'board' && <>
          <div className="mt-3 rounded-2xl border-2 border-[#d9bf96] bg-[#f7efe2] p-3">
            {notes.length ? notes.map(n => { const b = boss(n.boss); return <div key={n.id} className="relative mb-2 rounded-xl border border-[#eadcc2] bg-[#fffdf6] px-3 pb-3 pt-3 shadow-[0_1px_0_#e6d6b8] last:mb-0">
              <span className="absolute left-1/2 top-[-4px] h-2 w-2 -translate-x-1/2 rounded-full bg-[#e0587a]" aria-hidden="true" />
              <b className="text-sm font-black text-[#5e1e2a]">{n.name}</b> <span className="rounded-full bg-[#eef6ea] px-1.5 text-[10px] font-bold text-[#4f7a43]">{b.icon} {b.name}</span>
              <p className="mt-0.5 text-xs text-[#7a6a70]">{n.phrases.map((p: string) => `"${p}"`).join(' · ')}</p>
              <div className="mt-1.5 flex items-center gap-1">{n.pets.map((p: Look, i: number) => <Pet key={i} pet={p} />)}{Array.from({ length: n.size - n.filled }, (_, i) => <span key={i} className="inline-flex h-[22px] w-[22px] items-center justify-center rounded-full border border-dashed border-[#c9ad80] text-[11px] text-[#c9ad80]">+</span>)}
                <button type="button" disabled={busy || guild.joinedThisWeek || needNick} onClick={() => void run(async () => { apply(await send('party-join', { partyId: n.id })); setTab('team'); })} className="ml-auto rounded-lg bg-[#e0587a] px-3 py-1 text-xs font-bold text-white disabled:opacity-40">참여</button></div>
            </div>; }) : <p className="py-6 text-center text-xs text-[#7a6a70]">아직 모집글이 없어요. 먼저 올려 보세요!</p>}
          </div>
          {!guild.joinedThisWeek && !making && <button type="button" disabled={needNick} onClick={() => setMaking(true)} className="mt-3 w-full rounded-2xl bg-[#e0587a] py-3 text-sm font-bold text-white disabled:opacity-40">모집글 올리기</button>}
          {guild.joinedThisWeek && <p className="mt-3 text-center text-[11px] text-slate-400">이번 주는 이미 팀이 있어요 · 한 주에 한 팀이에요</p>}
          {!guild.joinedThisWeek && <p className="mt-2 text-center text-[11px] text-slate-400">한 주에 한 팀 · 월요일에 새로 시작해요</p>}
        </>}

        {tab === 'team' && (party ? (() => { const b = boss(party.boss), active = party.members.filter(m => m.status === 'active'); return <>
          <div className="mt-3 rounded-2xl bg-[#f3f8f1] p-4 text-center">
            <div className="flex items-center justify-between text-xs font-bold text-[#8b2f40]"><span>{party.name}</span><span>{dDay(party.endDay)}</span></div>
            <p className="mt-2 text-3xl" aria-hidden="true">{b.icon}</p><b className="text-sm font-black text-[#5e1e2a]">{b.name}</b>
            <div className="mt-2 h-3 overflow-hidden rounded-full bg-[#f3e3e6]"><div className="h-full rounded-full bg-[#e0587a]" style={{ width: `${Math.round(party.progress * 100)}%` }} /></div>
            <p className="mt-1 text-xs text-[#5e1e2a]">{party.hp} / {party.hpMax} · {Math.round(party.progress * 100)}% <span className="text-slate-400">(30%부터 보상)</span></p>
          </div>
          <p className="mt-3 text-xs font-bold text-[#8b2f40]">팀원 기여 (이번 주 처음 맞힌 단어)</p>
          <ul className="mt-1">{party.members.filter(m => m.status === 'active').map(m => <li key={m.index} className="flex items-center gap-2 border-b border-[#f6eef0] py-2 text-xs">
            <span className="w-4 text-center font-black text-[#b07a10]">{m.rank}</span><Pet pet={m.pet} size={28} />
            <span className="min-w-0 flex-1"><b className="font-bold text-[#5e1e2a]">{m.nickname}{m.me && ' · 나'}</b> <span className="text-slate-400">Lv.{m.pet.level}{m.idleDays >= 2 ? ` · ${m.idleDays}일째 쉬는 중` : ''}</span>
              {m.canVote && <button type="button" disabled={busy || m.votedByMe} onClick={() => void run(async () => { if (await askConfirm({ title: `${m.nickname} 내보내기 투표`, message: '팀원 절반 이상이 찬성하면 내보내져요.', confirmText: '투표하기' })) apply(await send('party-vote', { index: m.index })); })} className="ml-1 rounded-md border border-[#f3d5da] px-1.5 text-[10px] font-bold text-[#8b2f40] disabled:opacity-50">{m.votedByMe ? '투표함' : '내보내기 투표'} {m.votes}/{m.needVotes}</button>}</span>
            <b className="text-sm font-black text-[#5e1e2a]">{m.count}</b>
          </li>)}</ul>
          <p className="mt-2 text-[11px] text-slate-400">이번 주 {PET_PARTY.participateMin}문제 이상 맞혀야 보상을 받아요 · 단어 먹이 주기나 원정대에서 맞힌 단어가 쌓여요 · {active.length}/{party.size}명</p>
          <button type="button" disabled={busy} onClick={() => void run(async () => { if (await askConfirm({ title: '팀에서 나갈까요?', message: '이번 주 받을 수 있는 팀 보상이 사라지고, 이번 주에는 다른 팀에 들어갈 수 없어요.', confirmText: '나가기', tone: 'danger' })) apply(await send('party-leave')); })} className="mt-4 w-full rounded-2xl border border-[#f3d5da] py-2.5 text-xs font-bold text-slate-500">팀 나가기 (받을 보상이 사라져요)</button>
        </>; })() : <p className="mt-6 text-center text-sm text-slate-500">이번 주 팀이 없어요. 게시판에서 팀을 찾거나 모집글을 올려 보세요.</p>)}

        {tab === 'rank' && <ul className="mt-3">{rows.length ? rows.map((r, i) => <li key={i} className={`flex items-center gap-2 border-b border-[#f6eef0] py-2 text-xs ${r.mine ? 'bg-[#fef2f3]' : ''}`}>
          <span className="w-6 text-center text-base">{['🥇', '🥈', '🥉'][i] || i + 1}</span>
          <span className="min-w-0 flex-1"><b className="font-bold text-[#5e1e2a]">{r.name}</b>{r.mine && <span className="ml-1 text-[#e0587a]">우리 팀</span>}<span className="mt-0.5 flex gap-0.5">{r.pets.map((p: Look, k: number) => <Pet key={k} pet={p} size={20} />)}</span></span>
          <b className="text-sm font-black text-[#5e1e2a]">{Math.round(r.progress * 100)}%</b></li>) : <p className="py-6 text-center text-xs text-slate-500">이번 주 팀이 아직 없어요.</p>}
          <p className="mt-2 text-center text-[11px] text-slate-400">순위표에는 팀 이름과 펫만 보여요</p></ul>}
      </div>

      {making && <div className="fixed inset-0 z-[85] flex items-end justify-center bg-slate-900/30" onClick={e => { if (e.target === e.currentTarget) setMaking(false); }}>
        <div role="dialog" aria-modal="true" aria-label="모집글 올리기" className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-white px-5 pb-6 pt-4">
          <h2 className="text-center text-base font-black text-[#5e1e2a]">모집글 올리기</h2>
          <p className="mt-3 text-xs font-bold text-[#8b2f40]">팀 이름</p>
          <div className="mt-1 flex flex-wrap gap-1.5">{PET_PARTY.nameA.map(a => <Chip key={a} on={form.nameA === a} onClick={() => setForm(f => ({ ...f, nameA: a }))}>{a}</Chip>)}</div>
          <div className="mt-1.5 flex flex-wrap gap-1.5">{PET_PARTY.nameB.map(b => <Chip key={b} on={form.nameB === b} onClick={() => setForm(f => ({ ...f, nameB: b }))}>{b}</Chip>)}</div>
          <p className="mt-1 text-xs text-slate-500">→ {form.nameA} {form.nameB} 원정대</p>
          <p className="mt-3 text-xs font-bold text-[#8b2f40]">목표</p>
          <div className="mt-1 flex flex-wrap gap-1.5">{PET_PARTY.bosses.map(b => <Chip key={b.id} on={form.boss === b.id} onClick={() => setForm(f => ({ ...f, boss: b.id }))}>{b.icon} {b.name}</Chip>)}</div>
          <p className="mt-3 text-xs font-bold text-[#8b2f40]">한마디 (최대 2개)</p>
          <div className="mt-1 flex flex-wrap gap-1.5">{PET_PARTY.phrases.map(p => { const on = form.phrases.includes(p); return <Chip key={p} on={on} onClick={() => setForm(f => ({ ...f, phrases: on ? f.phrases.filter(x => x !== p) : [...f.phrases, p].slice(-2) }))}>{p}</Chip>; })}</div>
          <p className="mt-3 text-xs font-bold text-[#8b2f40]">인원 · 보스 체력은 인원 × {PET_PARTY.hpPerMember}</p>
          <div className="mt-1 flex gap-1.5">{PET_PARTY.sizes.map(n => <Chip key={n} on={form.size === n} onClick={() => setForm(f => ({ ...f, size: n }))}>{n}명</Chip>)}</div>
          <button type="button" disabled={busy || !form.phrases.length} onClick={() => void run(async () => { apply(await send('party-create', form)); setMaking(false); setTab('team'); })} className="mt-5 w-full rounded-2xl bg-[#e0587a] py-3 text-sm font-bold text-white disabled:opacity-50">게시판에 붙이기</button>
          {notice && <p role="alert" className="mt-2 text-center text-xs font-bold text-[#b04a5a]">{notice}</p>}
        </div>
      </div>}

      {needNick && <div className="fixed inset-0 z-[86] flex items-center justify-center bg-slate-900/40 p-4">
        <form role="dialog" aria-modal="true" aria-label="길드 별칭" onSubmit={e => { e.preventDefault(); void run(async () => apply(await send('guild-nickname', { nickname: nick }))); }} className="w-full max-w-xs rounded-3xl bg-white p-5 text-center">
          <h2 className="text-base font-black text-[#5e1e2a]">{guild.warned ? '별칭을 바꿔 주세요' : '길드에서 쓸 별칭'}</h2>
          <p className="mt-1 text-xs text-slate-500">{guild.warned ? '관리자가 별칭을 바꿔 달라고 했어요. 예전 별칭은 다시 쓸 수 없어요.' : '다른 친구들에게는 실명 대신 별칭과 펫만 보여요.'}</p>
          <input value={nick} onChange={e => setNick(e.target.value)} maxLength={PET_PARTY.nickname.max} placeholder="2~10자 (연락처는 안 돼요)" aria-label="별칭" className="mt-3 w-full rounded-xl border border-[#f3d5da] px-3 py-2 text-sm outline-none focus:border-[#e0587a]" />
          {notice && <p role="alert" className="mt-2 text-xs font-bold text-[#b04a5a]">{notice}</p>}
          <button type="submit" disabled={busy || nick.trim().length < PET_PARTY.nickname.min} className="mt-3 w-full rounded-2xl bg-[#e0587a] py-2.5 text-sm font-bold text-white disabled:opacity-50">정하기</button>
          <button type="button" onClick={onClose} className="mt-2 text-xs text-slate-400">나중에 할게요</button>
        </form>
      </div>}
    </div>
  );
}
