export default function LessonModeSwitch({value,onChange}:{value:'single'|'grid';onChange:(value:'single'|'grid')=>void}){
 return <div className="lesson-mode-switch" role="group" aria-label="일지 작성 방식">{([['single','한 학생 작성'],['grid','여러 학생 작성']] as const).map(([id,label])=><button key={id} type="button" aria-pressed={value===id} onClick={()=>onChange(id)}>{label}</button>)}</div>;
}
