const rich = (value: string) => ({ rich_text: value.match(/[\s\S]{1,1900}/g)?.map(content => ({ type: 'text', text: { content } })) || [] });
// Keep the legacy mirror readable by older app versions without requiring it.
export function lessonSpecialNoteProperties(schema: Record<string, any>, value: string) {
    if (schema['특이사항']?.type !== 'rich_text') throw new Error('NOTION_SCHEMA_SETUP_REQUIRED');
    return { '특이사항': rich(value), ...(schema['앱 특이사항']?.type === 'rich_text' ? { '앱 특이사항': rich(value) } : {}) };
}
export function readLessonSpecialNote(properties: Record<string, any>) {
    const text = (property: any) => (property?.rich_text || []).map((part: any) => part.plain_text ?? part.text?.content ?? '').join('');
    return text(properties['특이사항']) || text(properties['앱 특이사항']);
}
