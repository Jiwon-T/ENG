// 담당 변경 기록 for 관리자 설정 → 선생님: principal and admin only (teachers never see who left whom or why).
export async function readTeacherTransfers(db: any, actor: any) {
    if (actor.academyId !== 'main' || !(actor.admin || actor.principal)) throw Error('FORBIDDEN');
    const q = await db.collection('teacherTransfers').where('academyId', '==', 'main').limit(1001).get();
    if (q.docs.length > 1000) throw Error('TRANSFER_PAGE_LIMIT');
    const transfers = q.docs.map((d: any) => { const r = d.data(); return { id: d.id, studentKey: String(r.studentKey || ''), subject: String(r.subject || ''), fromUids: Array.isArray(r.fromUids) ? r.fromUids : [], toUids: Array.isArray(r.toUids) ? r.toUids : [], afterUids: Array.isArray(r.afterUids) ? r.afterUids : null, reason: String(r.reason || ''), note: String(r.note || ''), at: Number(r.at) || 0 }; })
        .sort((a: any, b: any) => b.at - a.at);
    return { transfers };
}
