import { kstDay } from './notionUsage.js';

/*
 * Read-only readiness for disconnecting Notion and Make. Nothing here stops, deletes or changes anything:
 * Make scenarios, the template worker and the Notion token are changed by the user, with approval.
 */
// Routes allowed to keep calling Notion after every switch (explicit admin diagnostics only).
export const NOTION_ALLOWED_AFTER_CUTOVER = ['workspace:integrity-audit'];

async function safe(fn: () => Promise<boolean>) { try { return await fn(); } catch { return false; } }

export async function notionDisconnectStatus(db: any, actor: any, now = Date.now()) {
    if (!actor?.admin || actor.academyId !== 'main') throw Error('FORBIDDEN');
    const main = { academyId: 'main' };
    const [{ coreActive }, { classesActive }, { appSchedulesActive }, { lessonAppActive }, { templateAppActive }, { academicAppActive }] = await Promise.all([
        import('./academyCore.js'), import('./managedAcademy.js'), import('./appSchedule.js'), import('./lessonAuthority.js'), import('./messageTemplateAuthority.js'), import('./academicAuthority.js')]);
    const [core, classes, schedule, lesson, template, grade] = await Promise.all([safe(() => coreActive(db, main)), safe(() => classesActive(db, main)), safe(() => appSchedulesActive(db, main)), safe(() => lessonAppActive(db, main)), safe(() => templateAppActive(db)), safe(() => academicAppActive(db))]);
    const days = Array.from({ length: 7 }, (_, i) => kstDay(now - i * 86400000));
    const docs = await Promise.all(days.map(d => db.collection('notionUsage').doc(d).get()));
    const byRoute = new Map<string, number>(), webhooks = new Map<string, number>(), perDay: any[] = [];
    docs.forEach((doc: any, i: number) => {
        const u = doc.data() || {}; let notion = 0, hooks = 0;
        for (const [route, areas] of Object.entries<any>(u.notion || {})) for (const [area, n] of Object.entries<any>(areas || {})) { byRoute.set(route + '|' + area, (byRoute.get(route + '|' + area) || 0) + Number(n)); notion += Number(n); }
        for (const [kind, outcomes] of Object.entries<any>(u.webhook || {})) for (const [outcome, n] of Object.entries<any>(outcomes || {})) { webhooks.set(kind + '|' + outcome, (webhooks.get(kind + '|' + outcome) || 0) + Number(n)); hooks += Number(n); }
        perDay.push({ day: days[i], notion, webhooks: hooks });
    });
    const routes = [...byRoute].map(([k, count]) => { const [route, area] = k.split('|'); return { route, area, count }; }).sort((a, b) => b.count - a.count);
    const hooks = [...webhooks].map(([k, count]) => { const [kind, outcome] = k.split('|'); return { kind, outcome, count }; }).sort((a, b) => b.count - a.count);
    const hookCount = (kind: string, pred: (o: string) => boolean = () => true) => hooks.filter(h => h.kind === kind && pred(h.outcome)).reduce((s, h) => s + h.count, 0);
    const areas = [
        { key: 'core', appOnly: core }, { key: 'class', appOnly: classes }, { key: 'schedule', appOnly: schedule },
        { key: 'lesson', appOnly: lesson }, { key: 'template', appOnly: template }, { key: 'grade', appOnly: grade, notionEditsApplied: hookCount('academic', o => o === 'applied') },
    ];
    const allApp = areas.every(a => a.appOnly);
    const remaining = routes.filter(r => !NOTION_ALLOWED_AFTER_CUTOVER.includes(r.route));
    const steps = [
        { key: 'make-lesson', ready: lesson, deliveries: hookCount('lesson'), blockedAfterSwitch: hookCount('lesson', o => o === 'APP_AUTHORITY') },
        { key: 'make-schedule', ready: schedule, deliveries: hookCount('schedule'), blockedAfterSwitch: hookCount('schedule', o => o === 'APP_AUTHORITY') },
        // After the grade switch Make grade deliveries are refused, so the scenario can be turned off.
        { key: 'make-academic', ready: grade, deliveries: hookCount('academic'), notionEditsApplied: hookCount('academic', o => o === 'applied') },
        { key: 'template-worker', ready: template, workerEnabled: process.env.MESSAGE_TEMPLATE_SYNC_ENABLED === 'true' },
        { key: 'notion-token', ready: allApp && remaining.length === 0, remainingRoutes: remaining.slice(0, 20) },
    ];
    return { areas, steps, usage: { days: perDay, routes: routes.slice(0, 30), webhooks: hooks }, measuredSince: days.at(-1) };
}
