const initials = ['ㄱ','ㄲ','ㄴ','ㄷ','ㄸ','ㄹ','ㅁ','ㅂ','ㅃ','ㅅ','ㅆ','ㅇ','ㅈ','ㅉ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];
const finals = ['','ㄱ','ㄲ','ㄱㅅ','ㄴ','ㄴㅈ','ㄴㅎ','ㄷ','ㄹ','ㄹㄱ','ㄹㅁ','ㄹㅂ','ㄹㅅ','ㄹㅌ','ㄹㅍ','ㄹㅎ','ㅁ','ㅂ','ㅂㅅ','ㅅ','ㅆ','ㅇ','ㅈ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];
// The Korean keyboard joins two typed initials into one letter (ㄱ+ㅅ → ㄳ); search treats it as both.
const joined:Record<string,string> = {'ㄳ':'ㄱㅅ','ㄵ':'ㄴㅈ','ㄶ':'ㄴㅎ','ㄺ':'ㄹㄱ','ㄻ':'ㄹㅁ','ㄼ':'ㄹㅂ','ㄽ':'ㄹㅅ','ㄾ':'ㄹㅌ','ㄿ':'ㄹㅍ','ㅀ':'ㄹㅎ','ㅄ':'ㅂㅅ'};
const isJamo=(char:string)=>char>='ㄱ'&&char<='ㆎ';
// NFKC would turn ㄱ into a different (combining) letter, so letters typed on their own are kept as they are.
export const normalizeSearch=(value:string)=>[...value].map(char=>isJamo(char)?(joined[char]||char):char.normalize('NFKC')).join('').replace(/\s+/gu,'').toLowerCase();
const syllable=(char:string)=>{const code=char.charCodeAt(0)-0xac00;return code>=0&&code<11172?{initial:Math.floor(code/588),vowel:Math.floor(code%588/28),final:code%28}:null;};
export function koreanInitials(value:string){
 return [...value].map(char=>{const s=syllable(char);return s?initials[s.initial]:char;}).join('');
}
type Step={exact:string}|{initial:string}|{start:number;vowels:number[]};
// Vowels the keyboard can still grow while typing (ㅗ→ㅘ·ㅙ·ㅚ, ㅜ→ㅝ·ㅞ·ㅟ, ㅡ→ㅢ).
const growing:Record<number,number[]>={8:[9,10,11],13:[14,15,16],18:[19]};
// A query is read letter by letter: a whole syllable must match, a lone consonant matches a syllable's
// first sound (초성), and the syllable still being typed (전수 → 전숳 before 현) matches what it can become.
function querySteps(query:string):Step[][]{
 const chars=[...normalizeSearch(query)];if(!chars.length)return [[]];
 const head:Step[]=chars.slice(0,-1).map(char=>initials.includes(char)?{initial:char}:{exact:char}),last=chars[chars.length-1],s=syllable(last);
 if(!s)return [[...head,initials.includes(last)?{initial:last}:{exact:last}]];
 const open={start:s.initial,vowels:s.final?[s.vowel]:[s.vowel,...(growing[s.vowel]||[])]};
 // 수 can still become 숙·순…; 숳 is either 숳 itself or 수 followed by a name letter starting with ㅎ.
 return s.final?[[...head,{exact:last}],[...head,open,...[...finals[s.final]].map(initial=>({initial}))]]:[[...head,open]];
}
function stepMatches(step:Step,char:string){
 if('exact' in step)return step.exact===char;
 const s=syllable(char);
 if('initial' in step)return s?initials[s.initial]===step.initial:char===step.initial;
 // The syllable being typed: same first sound, a vowel it can still become, any final consonant.
 return Boolean(s)&&s!.initial===step.start&&step.vowels.includes(s!.vowel);
}
export function matchesKoreanSearch(name:string,query:string){
 const text=[...normalizeSearch(name)];
 return querySteps(query).some(steps=>!steps.length||text.some((_,from)=>from+steps.length<=text.length&&steps.every((step,i)=>stepMatches(step,text[from+i]))));
}
/** This function only filters/reorders the already authorized input list. */
export function studentSearchResults<T extends {studentKey:string;studentDisplayName:string}>(students:readonly T[],query:string,todayKeys:readonly string[]=[]){
 const current=new Set(todayKeys),matched=students.filter(student=>matchesKoreanSearch(student.studentDisplayName,query));
 return [...matched.filter(student=>current.has(student.studentKey)),...matched.filter(student=>!current.has(student.studentKey))];
}
