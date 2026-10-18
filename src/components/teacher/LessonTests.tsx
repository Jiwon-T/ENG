import {useState} from 'react';
import {Trash2} from 'lucide-react';
import OptionalMark from './OptionalMark';
import {AudienceTag} from './LessonAudience';
import {gridScore} from '../../lib/teacherLessonGrid';
import {percentInputPatch,testInputPatch,wrongAnswers} from '../../lib/lessonTestInput';
import {TEST_NAME_OPTIONS} from '../../lib/lessonReportText';
/** 테스트 이름 (선택): 단어 · 모의고사 · 단원평가 or typed; tapping the chosen one again clears it (shown as just 테스트). */
function TestNamePicker({value,onChange}:{value:string;onChange:(name:string)=>void}){
 // A typed name (carried over or loaded with another lesson) keeps the box open by itself.
 const preset=(TEST_NAME_OPTIONS as readonly string[]).includes(value),[typing,setTyping]=useState(false),open=typing||(Boolean(value)&&!preset);
 return <div className="lesson-test-names" role="group" aria-label="테스트 이름">{TEST_NAME_OPTIONS.map(name=><button key={name} type="button" aria-pressed={value===name} onClick={()=>{setTyping(false);onChange(value===name?'':name);}}>{name}</button>)}
  <button type="button" aria-pressed={open} onClick={()=>{if(open){setTyping(false);if(!preset)onChange('');}else{setTyping(true);if(preset)onChange('');}}}>직접 입력</button>
  {open&&<input aria-label="테스트 이름 직접 입력" maxLength={30} placeholder="예: 듣기평가" value={preset?'':value} onChange={e=>onChange(e.target.value)}/>}</div>;
}
export default function LessonTests({value,onChange,error=false}:{value:any;onChange:(key:string,value:number|boolean|string|null)=>void;error?:boolean}) {
 return <div className="lesson-scores-panel"><div className="lesson-tests">{[
  ['일반 테스트','correct','total','wrong','scorePercent'],['내신 대비 테스트','examCorrect','examTotal','examWrong','examScorePercent'],
 ].map(([name,correct,total,wrong,percent])=>{
  const title=name==='일반 테스트'?'테스트 점수':'내신 대비 점수',score=gridScore(value[correct]??null,value[total]??null);
  const apply=(patch:Record<string,number|boolean|null>)=>{for(const [field,next] of Object.entries(patch))onChange(field,next);};
  return <fieldset key={name} className="lesson-test"><legend>{title} <OptionalMark/><AudienceTag to="all"/></legend>
 {/* Scores carried over from the previous lesson are cleared in one tap (shown on both boxes; dimmed when empty). */}
 <button type="button" className="lesson-test-clear" disabled={![correct,total,wrong].some(key=>value[key]!=null)} aria-label={`${title} 지우기`} title="점수 지우기" onClick={()=>{for(const key of [correct,total,wrong])onChange(key,null);}}><Trash2 size={13} aria-hidden="true"/></button>
 {/* 백분율: a score already worked out (85점) goes in as it is; it is kept as 100문항 so every average still works. */}
 <button type="button" className="lesson-test-mode" aria-pressed={Boolean(value[percent])} title={value[percent]?'오답 수·문항 수로 입력':'점수(백분율)로 바로 입력'} onClick={()=>apply(value[percent]?{[percent]:false,[correct]:null,[total]:null,[wrong]:null}:{[percent]:true,...percentInputPatch(correct,total,wrong,score)})}>{value[percent]?'문항':'%'}</button>
 {value[percent]
  ? <div className="lesson-test-inline"><label>점수<input aria-label={`${name} 점수`} type="number" step="any" min={0} max={100} value={value[total]===100?value[correct]??'':score??''} onChange={e=>apply(percentInputPatch(correct,total,wrong,e.target.value===''?null:Number(e.target.value)))}/></label><p className="lesson-test-converted">/ 100</p></div>
  : <div className="lesson-test-inline">{[[wrong,'오답 수'],[total,'문항 수']].map(([key,label])=><label key={key}>{label}<input aria-label={`${name} ${label}`} type="number" step="any" min={key===wrong?0:1} value={(key===wrong?wrongAnswers(value,correct,total,wrong):value[total])??''} onChange={e=>apply(testInputPatch(value,correct,total,wrong,key,e.target.value===''?null:Number(e.target.value)))}/></label>)}
 <p className="lesson-test-converted">환산 {score??'—'} / 100</p></div>}
 {name==='일반 테스트'&&<TestNamePicker value={value.testName||''} onChange={next=>onChange('testName',next)}/>}</fieldset>;})}</div></div>;
}
