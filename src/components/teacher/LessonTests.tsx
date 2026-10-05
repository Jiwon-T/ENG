import OptionalMark from './OptionalMark';
import {gridScore} from '../../lib/teacherLessonGrid';
import {testInputPatch,wrongAnswers} from '../../lib/lessonTestInput';
export default function LessonTests({value,onChange}:{value:any;onChange:(key:string,value:number|null)=>void}) {
 return <div className="lesson-tests">{[
  ['일반 테스트','correct','total','wrong'],['내신 대비 테스트','examCorrect','examTotal','examWrong'],
 ].map(([name,correct,total,wrong])=><fieldset key={name} className="lesson-test"><legend>{name} <OptionalMark/></legend>
 <div className="grid grid-cols-2 gap-2">{[[wrong,'오답 수'],[total,'문항 수']].map(([key,label])=><label key={key}>{label}<input aria-label={`${name} ${label}`} type="number" step="any" min={key===wrong?0:1} value={(key===wrong?wrongAnswers(value,correct,total,wrong):value[total])??''} onChange={e=>{const patch=testInputPatch(value,correct,total,wrong,key,e.target.value===''?null:Number(e.target.value));for(const [field,number] of Object.entries(patch))onChange(field,number);}}/></label>)}</div>
 <p className="text-xs text-pink-600 mt-2">환산 {gridScore(value[correct]??null,value[total]??null)??'—'} / 100</p></fieldset>)}</div>;
}
