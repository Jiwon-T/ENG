/** 테스트 평가 from the scores written (the average of the day's tests, out of 100); none written: 미확인. */
export const TEST_GRADE_STEPS: [number, string][] = [[95, '최상'], [90, '상'], [85, '중상'], [80, '중'], [70, '중하'], [60, '하'], [0, '최하']];
const pct = (c: any, t: any) => typeof c === 'number' && typeof t === 'number' && t > 0 ? c / t * 100 : null;
export function autoTestGrade(d: any) {
 const scores = [pct(d.correct, d.total), ...(Array.isArray(d.extraTests) ? d.extraTests : []).map((t: any) => pct(t.correct, t.total))].filter((n): n is number => n !== null);
 if (!scores.length) return '미확인';
 const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
 return TEST_GRADE_STEPS.find(([min]) => avg >= min)![1];
}
const SCORE_KEYS = ['correct', 'total', 'wrong', 'scorePercent', 'extraTests'];
/** A score changed: the 테스트 평가 follows it while it is still the automatic one (the teacher never picked it here, and it
 *  matches what the scores gave before); a grade the teacher chose stays. */
export function withAutoTestGrade(prev: any, next: any, key: string, touched: Iterable<string>) {
 if (!SCORE_KEYS.includes(key) || [...touched].includes('test') || (prev.test || '미확인') !== autoTestGrade(prev)) return next;
 return { ...next, test: autoTestGrade(next) };
}
export function wrongAnswers(value:any,correct:string,total:string,wrong:string):number|null {
 return value[wrong]??(value[correct]!=null&&value[total]!=null?value[total]-value[correct]:null);
}
export function testInputPatch(value:any,correct:string,total:string,wrong:string,key:string,number:number|null) {
 const mistakes=key===wrong?number:wrongAnswers(value,correct,total,wrong);
 const count=key===total?number:value[total]??null;
 return {[wrong]:mistakes,[total]:count,[correct]:mistakes==null||count==null?null:count-mistakes};
}
/** A score typed as a percentage (85): kept as 85 right out of 100 questions; empty clears the three numbers. */
export function percentInputPatch(correct:string,total:string,wrong:string,score:number|null) {
 return score==null?{[wrong]:null,[total]:null,[correct]:null}:{[wrong]:100-score,[total]:100,[correct]:score};
}
