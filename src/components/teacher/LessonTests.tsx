import OptionalMark from './OptionalMark';
import {gridScore} from '../../lib/teacherLessonGrid';
import {testInputPatch,wrongAnswers} from '../../lib/lessonTestInput';
export default function LessonTests({value,onChange,error=false}:{value:any;onChange:(key:string,value:number|null)=>void;error?:boolean}) {
 return <div className="lesson-scores-panel"><div className="lesson-tests">{[
  ['일반 테스트','correct','total','wrong'],['내신 대비 테스트','examCorrect','examTotal','examWrong'],
 ].map(([name,correct,total,wrong])=><fieldset key={name} className="lesson-test"><legend>{name==='일반 테스트'?'테스트 점수':'내신 대비 점수'} <OptionalMark/></legend>
 <div className="lesson-test-inline">{[[wrong,'오답 수'],[total,'문항 수']].map(([key,label])=><label key={key}>{label}<input aria-label={`${name} ${label}`} type="number" step="any" min={key===wrong?0:1} value={(key===wrong?wrongAnswers(value,correct,total,wrong):value[total])??''} onChange={e=>{const patch=testInputPatch(value,correct,total,wrong,key,e.target.value===''?null:Number(e.target.value));for(const [field,number] of Object.entries(patch))onChange(field,number);}}/></label>)}
 <p className="lesson-test-converted">환산 {gridScore(value[correct]??null,value[total]??null)??'—'} / 100</p></div></fieldset>)}</div></div>;
}
