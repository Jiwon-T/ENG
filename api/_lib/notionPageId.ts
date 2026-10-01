/** Canonical UUID format, independent of hyphens and letter case. */
export function normalizeNotionPageId(value: string): string {
  const compact = String(value || '').trim().replace(/-/g, '').toLowerCase();
  if (!/^[0-9a-f]{32}$/.test(compact)) throw new Error('INVALID_NOTION_STUDENT_PAGE_ID');
  return `${compact.slice(0, 8)}-${compact.slice(8, 12)}-${compact.slice(12, 16)}-${compact.slice(16, 20)}-${compact.slice(20)}`;
}

export function isNotionPageId(value: string): boolean {
  try { normalizeNotionPageId(value); return true; } catch { return false; }
}
