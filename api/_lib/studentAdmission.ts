import {z} from 'zod';
import {admissionSubjects,emptyAdmission,type AdmissionInput} from '../../src/lib/studentAdmission.js';
const date=z.string().refine(v=>{if(!v)return true;const d=new Date(v+'T00:00:00Z');return /^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===v;},'날짜를 확인해 주세요.');
const text=(max:number)=>z.string().trim().max(max).default('');
// 점수 was a number (0–100) before it became free text: an old number (or null) still reads as text
const scoreText=z.preprocess(v=>v===null||v===undefined?'':typeof v==='number'?String(v):v,text(200));
export const admissionSchema=z.object({birthDate:date.default(''),address:text(500),referral:text(200),previousPeriod:text(200),previousAcademy:text(200),previousBooks:text(2000),previousContent:text(3000),
 levels:z.array(z.object({subject:z.enum(admissionSubjects),schoolScore:scoreText,schoolGrade:text(30),mockScore:scoreText,mockGrade:text(30),diagnostic:text(1000)}).strict()).max(4).refine(rows=>new Set(rows.map(r=>r.subject)).size===rows.length,'과목 중복을 확인해 주세요.').default(emptyAdmission().levels),
 goal:text(3000),availableDays:z.array(z.enum(['월','화','수','목','금','토','일'])).max(7).refine(days=>new Set(days).size===days.length).default([]),availableTimes:text(1000),notes:text(5000),consent:z.enum(['미확인','동의','미동의']).default('미확인'),consentDate:date.default(''),signerName:text(100),signedPaper:z.boolean().default(false),
}).strict().default(emptyAdmission() as any).transform(value=>value as AdmissionInput);
function textChunks(value:string){const chunks:string[]=[];let content='';for(const char of value){if(content.length+char.length>1800){chunks.push(content);content='';}content+=char;}if(content)chunks.push(content);return chunks;}
// Text kept on the student row in rich-text pieces (long notes in pieces of 1,800 characters).
const richProperty=(value:string)=>({rich_text:textChunks(value).map(content=>({text:{content}}))});
export function admissionProperties(a:AdmissionInput,guardianSalutation='') {
 const p:Record<string,any>={'생년월일':{date:a.birthDate?{start:a.birthDate}:null},'주소':richProperty(a.address),'알게 된 경로':richProperty(a.referral),'이전 학습 기간':richProperty(a.previousPeriod),'이전 학원명':richProperty(a.previousAcademy),'사용 교재':richProperty(a.previousBooks),'이전 학습 내용':richProperty(a.previousContent),'학습 목표':richProperty(a.goal),'수업 가능 요일':{multi_select:a.availableDays.map(name=>({name}))},'수업 가능 시간':richProperty(a.availableTimes),'상담 참고 사항':richProperty(a.notes),'개인정보 동의':{select:{name:a.consent}},'동의 확인일':{date:a.consentDate?{start:a.consentDate}:null},'서명자 이름':richProperty(a.signerName),'서명 원서 보관':{checkbox:a.signedPaper},'보호자 호칭':richProperty(guardianSalutation)};
 for(const subject of admissionSubjects){const row=a.levels.find(r=>r.subject===subject);p[subject+' 입학 내신 점수']=richProperty(row?.schoolScore||'');p[subject+' 입학 내신 등급']=richProperty(row?.schoolGrade||'');p[subject+' 입학 모평 점수']=richProperty(row?.mockScore||'');p[subject+' 입학 모평 등급']=richProperty(row?.mockGrade||'');p[subject+' 입학 진단평가']=richProperty(row?.diagnostic||'');}
 return p;
}

const plain=(p:any)=>(p?.rich_text||p?.title||[]).map((v:any)=>v.plain_text??v.text?.content??'').join('');
/** The admission answers kept on the student row (written at registration by admissionProperties), decoded for
 *  viewing and editing after registration. Missing properties read as empty. */
export function admissionFromProperties(p:any={}){
 // 점수: text now; a row saved when it was a number reads as that number in text
 const scoreOf=(v:any)=>typeof v?.number==='number'?String(v.number):plain(v);
 const levels=admissionSubjects.map(subject=>({subject,schoolScore:scoreOf(p[subject+' 입학 내신 점수']),schoolGrade:plain(p[subject+' 입학 내신 등급']),
  mockScore:scoreOf(p[subject+' 입학 모평 점수']),mockGrade:plain(p[subject+' 입학 모평 등급']),diagnostic:plain(p[subject+' 입학 진단평가'])}));
 const consent=p['개인정보 동의']?.select?.name;
 const admission:AdmissionInput={birthDate:p['생년월일']?.date?.start||'',address:plain(p['주소']),referral:plain(p['알게 된 경로']),previousPeriod:plain(p['이전 학습 기간']),previousAcademy:plain(p['이전 학원명']),
  previousBooks:plain(p['사용 교재']),previousContent:plain(p['이전 학습 내용']),levels,goal:plain(p['학습 목표']),availableDays:(p['수업 가능 요일']?.multi_select||[]).map((v:any)=>v.name).filter((d:any)=>['월','화','수','목','금','토','일'].includes(d)),
  availableTimes:plain(p['수업 가능 시간']),notes:plain(p['상담 참고 사항']),consent:consent==='동의'||consent==='미동의'?consent:'미확인',consentDate:p['동의 확인일']?.date?.start||'',signerName:plain(p['서명자 이름']),signedPaper:p['서명 원서 보관']?.checkbox===true};
 return {admission,guardianName:plain(p['보호자이름']),guardianSalutation:plain(p['보호자 호칭'])};
}
export const admissionEditSchema=z.object({admission:admissionSchema,guardianName:text(80),guardianSalutation:text(80)}).strict();
/** Only the admission and guardian-name properties; every other property on the row is left as it is. */
export function admissionEditProperties(v:{admission?:AdmissionInput;guardianName:string;guardianSalutation:string}){
 return {...admissionProperties(v.admission??emptyAdmission(),v.guardianSalutation),'보호자이름':richProperty(v.guardianName)};
}
