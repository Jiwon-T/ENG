// 방 구경 (동물농장 style): a friend's room opened from the 순위 is a visit — counted once a day per friend, never your
// own — and a 응원 스티커 (fixed phrases only, one a day per room) can be left there. No points for anyone; the one who
// sticks it gets a little pet XP a few times a day. A room closed by its owner takes no visits or stickers.
import { PET_ROOM, petItem, type PetRoomSticker } from '../../src/lib/petCatalog.js';
import { addXP, PET_STATES, rollDay, seoulDay, type ServerPetState } from './pet.js';

export const PET_ROOMS = 'petRooms';
/** One friend's visit to one room on one day: `${owner}_${viewer}_${day}` (the sticker left that day, if any). */
export const PET_ROOM_VISITS = 'petRoomVisits';
/** 방 코드 → owner: `petRoomCodes/{code}` {uid}; the owner's code is kept in its room doc. */
export const PET_ROOM_CODES = 'petRoomCodes';
interface RoomDoc { day?: string; today?: number; total?: number; /** 응원 스티커 received today (`day`) */ todayStickers?: number; /** 간식 선물 received today */ todayGifts?: number; stickers?: Partial<Record<PetRoomSticker, number>>; code?: string;
  /** 이번 주 인기 방: 응원 스티커 received in the week starting `week` (Monday, Korea time) */ week?: string; weekStickers?: number;
  /** 이웃: rooms I keep (owners' uids, newest last), one-way — never shown to them */ neighbors?: string[] }
/** The Monday (Korea time) of `day`'s week. */
export const weekOf = (day: string) => { const d = new Date(`${day}T00:00:00Z`); d.setUTCDate(d.getUTCDate() - (d.getUTCDay() + 6) % 7); return d.toISOString().slice(0, 10); };
export interface RoomView { today: number; total: number; stickers: Partial<Record<PetRoomSticker, number>>; sticker: PetRoomSticker | null; /** my 간식 선물 here today */ gift?: string | null }

const counts = (r: RoomDoc | undefined, day: string): RoomView => ({today: r?.day === day ? r.today || 0 : 0, total: r?.total || 0, stickers: r?.stickers || {}, sticker: null});
/** For the pet screen: friends and 응원 스티커 today. */
export const roomToday = (r: RoomDoc | undefined, day: string) => ({visits: r?.day === day ? r.today || 0 : 0, stickers: r?.day === day ? r.todayStickers || 0 : 0, gifts: r?.day === day ? r.todayGifts || 0 : 0});
const visitId = (owner: string, viewer: string, day: string) => `${owner}_${viewer}_${day}`;
const addVisit = (r: RoomDoc | undefined, day: string): RoomDoc => ({...(r || {}), day, today: (r?.day === day ? r.today || 0 : 0) + 1, todayStickers: r?.day === day ? r.todayStickers || 0 : 0, todayGifts: r?.day === day ? r.todayGifts || 0 : 0, total: (r?.total || 0) + 1});

/** Opening a room: a friend's first look today counts (one visit doc per friend a day); your own room is only read.
 *  Null: the owner has closed it (read in the same transaction, so a room closed meanwhile is never counted or shown). */
export async function visitRoom(db: any, owner: string, viewer: string, now = Date.now()): Promise<RoomView | null> {
  const day = seoulDay(now), roomRef = db.collection(PET_ROOMS).doc(owner);
  if (owner === viewer) return counts((await roomRef.get()).data(), day);
  const visitRef = db.collection(PET_ROOM_VISITS).doc(visitId(owner, viewer, day));
  return db.runTransaction(async (tx: any) => {
    const [room, visit, ownerPet] = await Promise.all([tx.get(roomRef), tx.get(visitRef), tx.get(db.collection(PET_STATES).doc(owner))]);
    if (ownerPet.data()?.roomHidden) return null;
    let r: RoomDoc | undefined = room.data();
    if (!visit.exists) { r = addVisit(r, day); tx.set(roomRef, r); tx.set(visitRef, {owner, viewer, day, at: now}); }
    return {...counts(r, day), sticker: visit.data()?.sticker || null, gift: visit.data()?.gift || null};
  });
}

/** A 응원 스티커 in a friend's room (one a day per room; a visit too if it was not counted yet). The one who sticks it gets
 *  PET_ROOM.stickerXp on the pet they play, PET_ROOM.xpPerDay times a day. */
export async function placeSticker(db: any, owner: string, viewer: string, stickerInput: unknown, now = Date.now()) {
  const sticker = String(stickerInput || '') as PetRoomSticker;
  if (!PET_ROOM.stickers.some(x => x.id === sticker)) throw Error('ROOM_BAD_STICKER');
  if (owner === viewer) throw Error('ROOM_OWN');
  const day = seoulDay(now), roomRef = db.collection(PET_ROOMS).doc(owner), visitRef = db.collection(PET_ROOM_VISITS).doc(visitId(owner, viewer, day));
  const ownerRef = db.collection(PET_STATES).doc(owner), meRef = db.collection(PET_STATES).doc(viewer);
  return db.runTransaction(async (tx: any) => {
    const [room, visit, ownerPet, mePet] = await Promise.all([tx.get(roomRef), tx.get(visitRef), tx.get(ownerRef), tx.get(meRef)]);
    if (ownerPet.data()?.roomHidden) throw Error('ROOM_HIDDEN');
    if (visit.data()?.sticker) throw Error('ROOM_STICKER_USED');
    let r: RoomDoc = room.data() || {};
    if (!visit.exists) r = addVisit(r, day);
    const week = weekOf(day);
    r = {...r, todayStickers: (r.day === day ? r.todayStickers || 0 : 0) + 1, week, weekStickers: (r.week === week ? r.weekStickers || 0 : 0) + 1, stickers: {...(r.stickers || {}), [sticker]: (r.stickers?.[sticker] || 0) + 1}};
    tx.set(roomRef, r);
    tx.set(visitRef, {...(visit.data() || {}), owner, viewer, day, at: visit.data()?.at || now, sticker, stuckAt: now});
    let xp = 0;
    if (mePet.exists) {
      const s = rollDay(mePet.data(), now) as ServerPetState;
      if ((s.today.stickers || 0) < PET_ROOM.xpPerDay) { s.today.stickers = (s.today.stickers || 0) + 1; addXP(s, PET_ROOM.stickerXp); xp = PET_ROOM.stickerXp; s.updatedAt = now; tx.set(meRef, s); }
    }
    return {room: {...counts(r, day), sticker, gift: visit.data()?.gift || null}, xp};
  });
}

// 방 코드: 4 letters a friend can be told (no 0/O, 1/I/L). A new one replaces the old (the old stops working).
const CODE_LETTERS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const normCode = (v: unknown) => String(v ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
export const isRoomCode = (v: string) => v.length === 4 && [...v].every(c => CODE_LETTERS.includes(c));
/** The student's 방 코드, made the first time (`renew`: a new one, the old freed). */
export async function roomCode(db: any, uid: string, renew = false, rand = Math.random): Promise<string> {
  const roomRef = db.collection(PET_ROOMS).doc(uid);
  return db.runTransaction(async (tx: any) => {
    const room: RoomDoc | undefined = (await tx.get(roomRef)).data();
    if (room?.code && !renew) return room.code;
    const tries = Array.from({length: 6}, () => Array.from({length: 4}, () => CODE_LETTERS[Math.floor(rand() * CODE_LETTERS.length)]).join(''));
    const taken = await Promise.all(tries.map(c => tx.get(db.collection(PET_ROOM_CODES).doc(c))));
    const code = tries.find((c, i) => !taken[i].exists && c !== room?.code);
    if (!code) throw Error('ROOM_CODE_BUSY');
    if (room?.code) tx.delete(db.collection(PET_ROOM_CODES).doc(room.code));
    tx.set(db.collection(PET_ROOM_CODES).doc(code), {uid});
    tx.set(roomRef, {...(room || {}), code});
    return code;
  });
}
/** The owner of a 방 코드, or null. */
export async function roomOwner(db: any, codeInput: unknown): Promise<string | null> {
  const code = normCode(codeInput); if (!isRoomCode(code)) return null;
  return (await db.collection(PET_ROOM_CODES).doc(code).get()).data()?.uid || null;
}
/** 방명록: today's friends in my room (who, when, the sticker), newest first. */
export async function todaysVisits(db: any, owner: string, now = Date.now()) {
  const snap = await db.collection(PET_ROOM_VISITS).where('owner', '==', owner).where('day', '==', seoulDay(now)).get();
  return snap.docs.map((d: any) => d.data()).sort((a: any, b: any) => Math.max(b.stuckAt || 0, b.giftAt || 0, b.at || 0) - Math.max(a.stuckAt || 0, a.giftAt || 0, a.at || 0)).slice(0, 50) as {viewer: string; at: number; sticker?: PetRoomSticker; stuckAt?: number; gift?: string; giftAt?: number}[];
}

/** 이웃: add or remove a room I keep (up to PET_ROOM.neighborsMax; never my own). Returns whether it is kept now. */
export async function setNeighbor(db: any, me: string, owner: string, keep: boolean) {
  if (owner === me) throw Error('ROOM_OWN');
  const ref = db.collection(PET_ROOMS).doc(me);
  return db.runTransaction(async (tx: any) => {
    const room: RoomDoc = (await tx.get(ref)).data() || {}, list = (room.neighbors || []).filter(u => u !== owner);
    if (keep && list.length >= PET_ROOM.neighborsMax) throw Error('ROOM_NEIGHBORS_FULL');
    tx.set(ref, {...room, neighbors: keep ? [...list, owner] : list});
    return keep;
  });
}
/** My 이웃 (owners' uids). */
export const neighborsOf = async (db: any, me: string): Promise<string[]> => ((await db.collection(PET_ROOMS).doc(me).get()).data()?.neighbors || []) as string[];
/** Whether I left a 응원 스티커 in each of these rooms today. */
export async function stuckToday(db: any, me: string, owners: string[], now = Date.now()) {
  const day = seoulDay(now), docs = await Promise.all(owners.map(o => db.collection(PET_ROOM_VISITS).doc(visitId(o, me, day)).get()));
  return new Set(owners.filter((_, i) => Boolean(docs[i].data()?.sticker)));
}
/** 이번 주 인기 방: rooms by 응원 스티커 received this week, most first (only the rooms cheered this week are read). */
export async function weeklyStickers(db: any, now = Date.now()) {
  const week = weekOf(seoulDay(now)), snap = await db.collection(PET_ROOMS).where('week', '==', week).get();
  return snap.docs.map((d: any) => ({uid: d.id as string, n: Number(d.data().weekStickers) || 0})).filter((x: any) => x.n > 0).sort((a: any, b: any) => b.n - a.n) as {uid: string; n: number}[];
}

/** 간식 선물 in a friend's room: a food snack bought with my points (or from my 가방) goes into the friend's 가방 — one a day
 *  per room, PET_ROOM.giftsPerDay a day; my pet gets PET_ROOM.giftXp. A visit too if it was not counted yet. */
export async function placeGift(db: any, owner: string, viewer: string, itemInput: unknown, fromBag: boolean, now = Date.now()) {
  const id = String(itemInput || ''), item = petItem(id);
  if (!item || !(PET_ROOM.gifts as readonly string[]).includes(id)) throw Error('ROOM_BAD_GIFT');
  if (owner === viewer) throw Error('ROOM_OWN');
  const day = seoulDay(now), roomRef = db.collection(PET_ROOMS).doc(owner), visitRef = db.collection(PET_ROOM_VISITS).doc(visitId(owner, viewer, day));
  const ownerRef = db.collection(PET_STATES).doc(owner), meRef = db.collection(PET_STATES).doc(viewer);
  return db.runTransaction(async (tx: any) => {
    const [room, visit, ownerPet, mePet] = await Promise.all([tx.get(roomRef), tx.get(visitRef), tx.get(ownerRef), tx.get(meRef)]);
    if (!ownerPet.exists) throw Error('ROOM_NO_PET');
    if (ownerPet.data()?.roomHidden) throw Error('ROOM_HIDDEN');
    if (visit.data()?.gift) throw Error('ROOM_GIFT_USED');
    // a full 가방 (99 of it) takes nothing, so nothing is spent
    const friend = rollDay(ownerPet.data(), now) as ServerPetState;
    if ((friend.snacks?.[id] || 0) >= 99) throw Error('ROOM_GIFT_BAG_FULL');
    if (!mePet.exists) throw Error('PET_NOT_ENOUGH_POINTS');
    const me = rollDay(mePet.data(), now) as ServerPetState;
    if ((me.today.gifts || 0) >= PET_ROOM.giftsPerDay) throw Error('ROOM_GIFTS_DONE');
    if (fromBag) { if (!(me.snacks?.[id]! > 0)) throw Error('PET_BAG_EMPTY'); me.snacks![id] -= 1; if (!me.snacks![id]) delete me.snacks![id]; }
    else { if (me.points < item.price) throw Error('PET_NOT_ENOUGH_POINTS'); me.points -= item.price; }
    me.today.gifts = (me.today.gifts || 0) + 1; addXP(me, PET_ROOM.giftXp); me.updatedAt = now;
    const bag = friend.snacks ||= {};
    bag[id] = (bag[id] || 0) + 1; friend.updatedAt = now;
    let r: RoomDoc = room.data() || {};
    if (!visit.exists) r = addVisit(r, day);
    r = {...r, todayGifts: (r.day === day ? r.todayGifts || 0 : 0) + 1};
    tx.set(roomRef, r); tx.set(visitRef, {...(visit.data() || {owner, viewer, day, at: now}), gift: id, giftAt: now});
    tx.set(meRef, me); tx.set(ownerRef, friend);
    return {gift: id, xp: PET_ROOM.giftXp, points: me.points, giftsLeft: PET_ROOM.giftsPerDay - (me.today.gifts || 0), snacks: me.snacks || {}};
  });
}
