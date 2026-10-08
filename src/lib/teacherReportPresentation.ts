export function testPercentage(score:unknown,total:unknown):number|null{if(typeof score!=='number'||typeof total!=='number'||!Number.isFinite(score)||!Number.isFinite(total)||total<=0||score<0)return null;return Math.round(score/total*1000)/10;}
export function reportScoreTone(value:number|null){return value===null||value>=70&&value<90?'neutral':value>=90?'success':'pending';}
export function sessionMatches(s:{type:string;category:string},filter:string){return filter==='all'||filter==='grammar'||filter==='exam'?filter==='all'||s.category===filter:s.type===filter;}

export function scoreAxis(values:number[]){const valid=values.filter(Number.isFinite);if(!valid.length)return {min:0,max:100};const low=Math.min(...valid),high=Math.max(...valid);const padding=Math.max(2,(high-low)*.2);const min=Math.max(0,Math.floor((low-padding)/5)*5),max=Math.min(100,Math.ceil((high+padding)/5)*5);return {min,max:max>min?max:min+5};}
export function loadedSectionCount(loaded:string,current:string,count:number){return loaded===current?count:null;}

export function filteredActivities<T extends {type:string;category:string;incorrectCount:number}>(sessions:T[],filter:string,wrongOnly:boolean){return sessions.filter(s=>sessionMatches(s,filter)&&(!wrongOnly||s.incorrectCount>0));}
export function wrongRowExpanded(id:string,wrongOnly:boolean,expanded:readonly string[]){return wrongOnly||expanded.includes(id);}
