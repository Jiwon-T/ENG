import {useState} from 'react';
import {Plus,Trash2} from 'lucide-react';
import OptionalMark from './OptionalMark';
import {AudienceTag} from './LessonAudience';
import {gridScore} from '../../lib/teacherLessonGrid';
import {percentInputPatch,testInputPatch,wrongAnswers} from '../../lib/lessonTestInput';
import {MAX_EXTRA_TESTS,TEST_NAME_OPTIONS,type ExtraTest} from '../../lib/lessonReportText';
/** 테스트 이름 (선택): 단어 · 문법 · 모의고사 · 단원평가 or typed; tapping the chosen one again clears it (shown as just 테스트). */
function TestNamePicker({value,onChange}:{key?:number;value:string;onChange:(name:string)=>void}){
 // A typed name (carried over or loaded with another lesson) keeps the box open by itself.
 const preset=(TEST_NAME_OPTIONS as readonly string[]).includes(value),[typing,setTyping]=useState(false),open=typing||(Boolean(value)&&!preset);
 return <div className="lesson-test-names" role="group" aria-label="테스트 이름">{TEST_NAME_OPTIONS.map(name=><button key={name} type="button" aria-pressed={value===name} onClick={()=>{setTyping(false);onChange(value===name?'':name);}}>{name}</button>)}
  <button type="button" aria-pressed={open} onClick={()=>{if(open){setTyping(false);if(!preset)onChange('');}else{setTyping(true);if(preset)onChange('');}}}>직접 입력</button>
  {open&&<input aria-label="테스트 이름 직접 입력" maxLength={30} placeholder="예: 듣기평가" value={preset?'':value} onChange={e=>onChange(e.target.value)}/>}</div>;
}
const circled=['①','②','③','④'];
/** 테스트 점수 can hold more than one test (단어 + 벼락치기 …): small tabs in the title row, the box below edits the chosen
 *  one, so the box never grows. The first test stays in correct/total/…/testName; the others go in extraTests. */
function TestTabs({tests,active,onPick,onAdd}:{tests:{name:string;score:number|null}[];active:number;onPick:(i:number)=>void;onAdd:()=>void}){
 return <span className="lesson-test-tabs" role="group" aria-label="테스트 고르기">
  {tests.length>1&&tests.map((t,i)=><button key={i} type="button" aria-pressed={i===active} title={t.name||'테스트'} onClick={()=>onPick(i)}>{circled[i]}{t.name?<span className="lesson-test-tab-name"> {t.name}</span>:null}{t.score!=null?` ${t.score}`:''}</button>)}
  {tests.length<=MAX_EXTRA_TESTS&&<button type="button" className="lesson-test-add" aria-label="테스트 하나 더 기록" title="테스트 하나 더 기록" onClick={onAdd}><Plus size={11} aria-hidden="true"/></button>}
 </span>;
}
export default function LessonTests({value,onChange,error=false}:{value:any;onChange:(key:string,value:any)=>void;error?:boolean}) {
 const [tab,setTab]=useState(0),extras:ExtraTest[]=Array.isArray(value.extraTests)?value.extraTests:[],active=Math.min(tab,extras.length);
 // The chosen extra test seen through the same field names as the first, so one box edits either.
 const extra=active>0?extras[active-1]:null;
 const general=extra?{correct:extra.correct??null,total:extra.total??null,wrong:extra.wrong??null,scorePercent:Boolean(extra.scorePercent),testName:extra.name||''}:value;
 const setExtras=(next:ExtraTest[])=>onChange('extraTests',next);
 const tests=[{name:value.testName||'',score:gridScore(value.correct??null,value.total??null)},...extras.map(t=>({name:t.name||'',score:gridScore(t.correct??null,t.total??null)}))];
 return <div className="lesson-scores-panel"><div className="lesson-tests">{[
  ['일반 테스트','correct','total','wrong','scorePercent'],['내신 대비 테스트','examCorrect','examTotal','examWrong','examScorePercent'],
 ].map(([name,correct,total,wrong,percent])=>{
  const isGeneral=name==='일반 테스트',v=isGeneral?general:value;
  const title=isGeneral?'테스트 점수':'내신 대비 점수',score=gridScore(v[correct]??null,v[total]??null);
  const apply=(patch:Record<string,any>)=>{
   if(isGeneral&&extra){const {testName,...rest}=patch,named=testName===undefined?rest:{...rest,name:testName};setExtras(extras.map((t,i)=>i===active-1?{...t,...named}:t));return;}
   for(const [field,next] of Object.entries(patch))onChange(field,next);
  };
  const label=isGeneral&&tests.length>1?`${title} ${active+1}`:title;
  return <fieldset key={name} className="lesson-test"><legend>{title} <OptionalMark/><AudienceTag to="all"/>{isGeneral&&<TestTabs tests={tests} active={active} onPick={setTab} onAdd={()=>{setExtras([...extras,{name:'',correct:null,total:null,wrong:null,scorePercent:false}]);setTab(extras.length+1);}}/>}</legend>
 {/* Scores carried over from the previous lesson are cleared in one tap (shown on both boxes; dimmed when empty). An added test is taken away whole. */}
 <button type="button" className="lesson-test-clear" disabled={!(isGeneral&&extra)&&![correct,total,wrong].some(key=>v[key]!=null)} aria-label={`${label} 지우기`} title={isGeneral&&extra?'이 테스트 지우기':'점수 지우기'} onClick={()=>{if(isGeneral&&extra){setExtras(extras.filter((_,i)=>i!==active-1));setTab(active-1);return;}for(const key of [correct,total,wrong])onChange(key,null);}}><Trash2 size={13} aria-hidden="true"/></button>
 {/* 백분율: a score already worked out (85점) goes in as it is; it is kept as 100문항 so every average still works. */}
 <button type="button" className="lesson-test-mode" aria-pressed={Boolean(v[percent])} title={v[percent]?'오답 수·문항 수로 입력':'점수(백분율)로 바로 입력'} onClick={()=>apply(v[percent]?{[percent]:false,[correct]:null,[total]:null,[wrong]:null}:{[percent]:true,...percentInputPatch(correct,total,wrong,score)})}>{v[percent]?'문항':'%'}</button>
 {v[percent]
  ? <div className="lesson-test-inline"><label>점수<input aria-label={`${name} 점수`} type="number" step="any" min={0} max={100} value={v[total]===100?v[correct]??'':score??''} onChange={e=>apply(percentInputPatch(correct,total,wrong,e.target.value===''?null:Number(e.target.value)))}/></label><p className="lesson-test-converted">/ 100</p></div>
  : <div className="lesson-test-inline">{[[wrong,'오답 수'],[total,'문항 수']].map(([key,label])=><label key={key}>{label}<input aria-label={`${name} ${label}`} type="number" step="any" min={key===wrong?0:1} value={(key===wrong?wrongAnswers(v,correct,total,wrong):v[total])??''} onChange={e=>apply(testInputPatch(v,correct,total,wrong,key,e.target.value===''?null:Number(e.target.value)))}/></label>)}
 <p className="lesson-test-converted">환산 {score??'—'} / 100</p></div>}
 {isGeneral&&<TestNamePicker key={active} value={v.testName||''} onChange={next=>apply({testName:next})}/>}</fieldset>;})}</div></div>;
}
