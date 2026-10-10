import { createHash, randomInt } from 'node:crypto';
import { z } from 'zod';
import { linkStudentAccount } from './studentAccountLink.js';
import { normalizeNotionPageId as uuid } from './notionPageId.js';
// Student link codes: the admin makes a one-time code for a registered student; the student types it in the app
// after signing up and their account is linked with the same steps as the admin's 앱 계정 연결.
// Only a hash of the code is stored. One live code per student; it expires after 14 days or once used.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no 0/O, 1/I/L
const CODE_LENGTH = 8, CODE_DAYS = 14, ATTEMPTS_PER_HOUR = 8;
export const normalizeCode = (value: string) => String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const hash = (code: string) => createHash('sha256').update('student-link:' + code).digest('hex');
export const formatCode = (code: string) => `${code.slice(0, 4)}-${code.slice(4)}`;

export async function createLinkCode(db: any, actor: any, input: unknown, now = Date.now()) {
    if (actor.academyId !== 'main' || !actor.admin) throw Error('FORBIDDEN'); // linking accounts is admin-only
    const studentKey = uuid(z.object({ studentKey: z.string().uuid() }).strict().parse(input).studentKey);
    const member = (await db.collection('academyStudentMemberships').doc(studentKey).get()).data();
    if (!member || member.academyId !== 'main' || member.disabled) throw Error('STUDENT_NOT_FOUND');
    const code = Array.from({ length: CODE_LENGTH }, () => ALPHABET[randomInt(ALPHABET.length)]).join(''), expiresAt = now + CODE_DAYS * 86_400_000;
    const indexRef = db.collection('studentLinkCodeIndex').doc(studentKey), codeRef = db.collection('studentLinkCodes').doc(hash(code));
    await db.runTransaction(async (tx: any) => {
        const old = (await tx.get(indexRef)).data();
        if (old?.codeHash) tx.delete(db.collection('studentLinkCodes').doc(old.codeHash)); // the previous code stops working
        tx.set(codeRef, { studentKey, createdBy: actor.uid, createdAt: now, expiresAt, usedBy: null, usedAt: null });
        tx.set(indexRef, { codeHash: hash(code), createdBy: actor.uid, createdAt: now, expiresAt });
    });
    return { code: formatCode(code), expiresAt };
}

/** A signed-in student redeems a code. Teachers and already-linked accounts are told plainly what to do instead. */
export async function redeemLinkCode(db: any, uid: string, input: unknown, now = Date.now()) {
    const code = normalizeCode(z.object({ code: z.string().max(40) }).strict().parse(input).code);
    const user = (await db.collection('users').doc(uid).get()).data();
    if (!user) throw Error('USER_NOT_FOUND');
    if (user.role !== 'student') throw Error('LINK_CODE_NOT_STUDENT');
    if (user.notionStudentKey) throw Error('LINK_CODE_ALREADY_LINKED');
    // Slow down guessing: a few tries per hour per account.
    const attemptRef = db.collection('studentLinkAttempts').doc(uid);
    const allowed = await db.runTransaction(async (tx: any) => {
        const a = (await tx.get(attemptRef)).data(), fresh = !a || now - a.windowStart > 3_600_000;
        const count = fresh ? 1 : a.count + 1;
        tx.set(attemptRef, { windowStart: fresh ? now : a.windowStart, count });
        return count <= ATTEMPTS_PER_HOUR;
    });
    if (!allowed) throw Error('LINK_CODE_TOO_MANY');
    if (code.length !== CODE_LENGTH) throw Error('LINK_CODE_INVALID');
    const codeRef = db.collection('studentLinkCodes').doc(hash(code)), row = (await codeRef.get()).data();
    if (!row || row.usedBy) throw Error('LINK_CODE_INVALID');
    if (row.expiresAt < now) throw Error('LINK_CODE_EXPIRED');
    let linked;
    try { linked = await linkStudentAccount(db, { firebaseUid: uid, studentKey: row.studentKey, linkedByUid: row.createdBy }); }
    catch (e: any) { if (e?.message === 'NOTION_STUDENT_ALREADY_LINKED_TO_ANOTHER_ACCOUNT') throw Error('LINK_CODE_STUDENT_TAKEN'); throw e; }
    await db.runTransaction(async (tx: any) => { const cur = (await tx.get(codeRef)).data(); if (cur) tx.set(codeRef, { ...cur, usedBy: uid, usedAt: now }); });
    return { studentKey: linked.studentKey, studentDisplayName: linked.studentDisplayName };
}
