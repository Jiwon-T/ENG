// Grammar sets split into 세트 their own way (not every 10 words): 문제은행 sets by their `set`, the others at fixed
// boundaries. The student list, quiz and test range and the teacher's 시험지 range all read them from here.

const GRAMMAR_SET_BOUNDS: Record<string, number[]> = {
  'complement-grammar': [0, 7, 17, 29],
  'basic-modal-grammar': [0, 6, 15],
  'modal-grammar': [0, 14, 21, 30, 37, 42, 48],
};
const BY_SET_FIELD = ['grammar-cramming', 'verb-form-grammar'];

/** How many 세트 the type has, or 0 when it is split every N words. */
export const grammarSetCount = (type?: string) =>
  type && BY_SET_FIELD.includes(type) ? 6 : (type && GRAMMAR_SET_BOUNDS[type] ? GRAMMAR_SET_BOUNDS[type].length - 1 : 0);

/** The words of 세트 `set` (1-based; words in their saved order), or null for a type split every N words. */
export function grammarSetWords<W>(type: string | undefined, words: W[], set: number): W[] | null {
  if (type && BY_SET_FIELD.includes(type)) return words.filter(w => (w as { set?: unknown }).set === set);
  const bounds = type ? GRAMMAR_SET_BOUNDS[type] : undefined;
  if (!bounds) return null;
  return set >= 1 && set < bounds.length ? words.slice(bounds[set - 1], bounds[set]) : [];
}
