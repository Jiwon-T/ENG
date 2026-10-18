// Built-in grammar data → its Firestore copy. A fix in the code (a choice, an answer, an explanation, a sentence) must
// reach the saved questions, without new ids, without touching what a teacher added, and without rewriting what is
// already the same.

/** The fields of `next` that differ from `current` (compared as JSON), or null when nothing changed. */
export function changedFields(current: Record<string, unknown>, next: Record<string, unknown>): Record<string, unknown> | null {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(next)) if (JSON.stringify(current[k] ?? null) !== JSON.stringify(v ?? null)) out[k] = v;
  return Object.keys(out).length ? out : null;
}

/**
 * Pairs each built-in item with the saved doc it was written as. `keys(item)` lists what may identify it in order of
 * preference (a pool id first, then its sentence, then sentences it had before a fix); `docKeys(data)` lists the same
 * kinds of keys for a saved doc. Each doc is used once, so two items with the same sentence get two docs. Items with no
 * doc are left out (to be added); docs no item claims (a teacher's own) are left alone.
 */
export function matchBuiltIn<T>(items: readonly T[], docs: readonly { id: string; data: Record<string, unknown> }[],
  keys: (item: T) => string[], docKeys: (data: Record<string, unknown>) => string[]): Map<number, string> {
  const byKey = new Map<string, string[]>();
  for (const d of docs) for (const k of docKeys(d.data)) if (k) byKey.set(k, [...(byKey.get(k) || []), d.id]);
  const used = new Set<string>(), out = new Map<number, string>();
  // Strongest keys first across all items, so an item's own id is never taken by another item's old sentence.
  const depth = Math.max(0, ...items.map(it => keys(it).length));
  for (let level = 0; level < depth; level++) {
    items.forEach((item, i) => {
      if (out.has(i)) return;
      const k = keys(item)[level];
      const id = k ? (byKey.get(k) || []).find(d => !used.has(d)) : undefined;
      if (id) { used.add(id); out.set(i, id); }
    });
  }
  return out;
}
