// 지문 분석기: what the app does on its own, at once and without AI (sentences, where to pause, grammar marks, word
// forms). Shared by the screen and the server (the server stores the AI parts next to these).
import { passageKey, splitPassage } from './workbook.js';

export const PASSAGE_LIMITS = { textChars: 6000, sentences: 40 };
export const passageSentences = (text: string) => splitPassage(text).slice(0, PASSAGE_LIMITS.sentences);
/** The same passage (same sentences) always gets the same id, so one stored analysis serves everyone. */
export const passageId = (sentences: string[]) => passageKey(sentences);

const clean = (w: string) => w.toLowerCase().replace(/^[^a-z0-9]+|[^a-z0-9']+$/g, '');
// A new meaning unit usually starts at these words (once the current one has a few words).
const STARTERS = new Set(['that', 'which', 'who', 'whom', 'whose', 'where', 'when', 'while', 'because', 'although', 'though', 'if', 'unless', 'since', 'whereas', 'but', 'so', 'as', 'what', 'how', 'why', 'whether']);
const LATE = new Set(['and', 'or', 'to', 'in', 'on', 'at', 'for', 'with', 'from', 'by', 'about', 'into', 'through', 'without', 'during', 'after', 'before', 'than', 'of', 'like', 'between', 'among', 'against', 'toward', 'towards', 'within', 'across', 'over', 'under', 'around', 'behind', 'beyond', 'along', 'upon', 'despite', 'until']);

/** Where to pause (끊어 읽기), as a first guess: the chunks joined with spaces give the sentence back exactly. */
export function chunkHints(sentence: string): string[] {
  const words = sentence.split(/\s+/).filter(Boolean), out: string[][] = [];
  let cur: string[] = [];
  words.forEach((word, i) => {
    const w = clean(word);
    const starts = cur.length >= 2 && STARTERS.has(w), late = cur.length >= 3 && LATE.has(w);
    if (cur.length && (starts || late) && words.length - i >= 2) { out.push(cur); cur = []; }
    cur.push(word);
    if (/[,;:]$/.test(word) && cur.length >= 2 && i < words.length - 2) { out.push(cur); cur = []; }
  });
  if (cur.length) out.push(cur);
  return out.map(c => c.join(' '));
}

const PP = 'known|made|given|taken|seen|done|written|built|found|held|kept|left|lost|paid|said|sold|sent|shown|spoken|told|thought|understood|chosen|driven|eaten|fallen|forgotten|gotten|grown|hidden|risen|shaken|stolen|thrown|worn|brought|bought|caught|taught|felt|heard|meant|met|put|read|set|shut|cut|hurt|let|born|drawn|begun|become|run|won|struck|forbidden|frozen|broken|woken';
const DET = /^(the|a|an|my|your|his|her|their|our|its|this|that|these|those|me|him|them|us|it|you)$/i;
export interface GrammarTag { label: string; kind: 'clause' | 'verb' | 'compare' | 'phrase' }
/** Grammar the app can spot by itself (shown as "앱 자동 표시": a hint, not a full analysis). */
export function grammarTags(sentence: string): GrammarTag[] {
  const s = sentence, low = s.toLowerCase(), tags: GrammarTag[] = [];
  const add = (label: string, kind: GrammarTag['kind']) => { if (!tags.some(t => t.label === label)) tags.push({ label, kind }); };
  if (/^it\s+(is|was|seems|seemed|becomes|became|will be|would be|can be|may be)\b[^.]*\b(to|that)\b/i.test(s)) add('가주어 it', 'clause');
  if (/\bwhat\b/i.test(s)) add('관계대명사·의문사 what', 'clause');
  for (const w of ['who', 'whom', 'whose', 'which']) if (new RegExp(`\\b${w}\\b`, 'i').test(s)) add(`관계사 ${w}`, 'clause');
  if (/\b(where|when)\b/i.test(s) && !/^(where|when)\b/i.test(s)) add('관계부사·접속사 where/when', 'clause');
  if (/\bthat\b/i.test(s)) add('접속사·관계사 that', 'clause');
  for (const w of ['although', 'though', 'because', 'while', 'unless', 'whereas', 'since', 'if', 'whether']) if (new RegExp(`\\b${w}\\b`, 'i').test(s)) { add(`부사절 접속사 ${w}`, 'clause'); break; }
  if (new RegExp(`\\b(am|is|are|was|were|be|been|being)\\s+(\\w+ly\\s+)?(\\w+ed|${PP})\\b`, 'i').test(s)) add('수동태', 'verb');
  if (new RegExp(`\\b(have|has|had)\\s+(\\w+ly\\s+)?(been|\\w+ed|${PP})\\b`, 'i').test(s)) add('완료 시제', 'verb');
  const to = (low.match(/\bto\s+([a-z]+)/g) || []) as string[];
  if (to.some(m => { const next = m.split(/\s+/)[1]; return !DET.test(next) && !/ing$/.test(next); })) add('to부정사', 'phrase');
  if (/^[A-Z]?[a-z]+ing\b[^,]*,/.test(s) || /^(having|being)\b/i.test(s)) add('분사구문', 'phrase');
  if (/\b(more|less)\s+\w+\s+than\b|\b\w+er\s+than\b/i.test(s)) add('비교급', 'compare');
  if (/\bthe\s+(most|least)\s+\w+|\bthe\s+\w+est\b/i.test(s)) add('최상급', 'compare');
  if (/\bnot only\b[^.]*\bbut( also)?\b/i.test(s)) add('not only A but (also) B', 'phrase');
  if (/\bso\s+\w+\s+that\b/i.test(s)) add('so ~ that 구문', 'phrase');
  if (/\btoo\s+\w+\s+to\b/i.test(s)) add('too ~ to 구문', 'phrase');
  return tags;
}

/** The words of a text, lowercased, as they appear (letters and an apostrophe). */
export const passageTokens = (text: string) => ((text.toLowerCase().match(/[a-z]+(?:'[a-z]+)?/g) || []) as string[]).filter(w => !w.includes("'"));
/** The forms a word may come from (studies → study, made → made, running → run, larger → large …), itself first. */
export function wordForms(w: string): string[] {
  const out = [w];
  const push = (x: string) => { if (x.length >= 2 && !out.includes(x)) out.push(x); };
  if (w.endsWith('ies')) push(w.slice(0, -3) + 'y');
  if (w.endsWith('es')) push(w.slice(0, -2));
  if (w.endsWith('s') && !w.endsWith('ss')) push(w.slice(0, -1));
  if (w.endsWith('ied')) push(w.slice(0, -3) + 'y');
  if (w.endsWith('ed')) { push(w.slice(0, -2)); push(w.slice(0, -1)); if (/([b-df-hj-np-tv-z])\1ed$/.test(w)) push(w.slice(0, -3)); }
  if (w.endsWith('ing')) { push(w.slice(0, -3)); push(w.slice(0, -3) + 'e'); if (/([b-df-hj-np-tv-z])\1ing$/.test(w)) push(w.slice(0, -4)); }
  if (w.endsWith('er')) { push(w.slice(0, -2)); push(w.slice(0, -1)); }
  if (w.endsWith('est')) { push(w.slice(0, -3)); push(w.slice(0, -2)); }
  if (w.endsWith('ly')) { push(w.slice(0, -2)); if (w.endsWith('ily')) push(w.slice(0, -3) + 'y'); }
  return out;
}
/** Words too common to list as unknown (the student knows these). */
export const COMMON_WORDS = new Set(('a an the and or but so if as at by for from in into of on to with about after before over under up down out off than then that this these those there here it its they them their we us our you your he him his she her i me my is am are was were be been being have has had do does did will would can could may might must shall should not no yes all any some each every many much more most other such only own same very just also too again still even ever never always often sometimes what which who whom whose when where why how because while although though since until unless whether one two three first new old good great little big small long high way time year day people thing things man men woman women child children world life make made get got go went gone come came take took give gave see saw know knew think thought say said tell told use used find found want work call try ask need feel become leave put mean keep let begin seem help show hear play run move live believe hold bring happen write provide sit stand lose pay meet include continue set learn change lead understand watch follow stop create speak read allow add spend grow open walk win offer remember love consider appear buy wait serve die send expect build stay fall cut reach kill remain like well back now how').split(' '));
