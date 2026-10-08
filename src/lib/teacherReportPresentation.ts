export function testPercentage(score:unknown,total:unknown):number|null{if(typeof score!=='number'||typeof total!=='number'||!Number.isFinite(score)||!Number.isFinite(total)||total<=0||score<0)return null;return Math.round(score/total*1000)/10;}
export function reportScoreTone(value:number|null){return value===null||value>=70&&value<90?'neutral':value>=90?'success':'pending';}
export function sessionMatches(s:{type:string;category:string},filter:string){return filter==='all'||filter==='grammar'||filter==='exam'?filter==='all'||s.category===filter:s.type===filter;}
