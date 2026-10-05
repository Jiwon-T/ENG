export function canRetryPublication(record: any, now = Date.now()) {
    if (!record?.revision || record.stage === 'published' || record.archived)
        return false;
    if (['publishing', 'processing', 'notion_saved'].includes(record.stage))
        return Boolean(record.publishStartedAt && now - record.publishStartedAt > 180000 && (record.notionWrite?.leaseUntil || 0) <= now);
    return ['failed', 'report_published_notion_pending'].includes(record.stage) || Boolean(record.notionWrite && !record.notionWrite.done);
}
