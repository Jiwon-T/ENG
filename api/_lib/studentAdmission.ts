import {z} from 'zod';
import {admissionSubjects,emptyAdmission,type AdmissionInput} from '../../src/lib/studentAdmission.js';
const date=z.string().refine(v=>{if(!v)return true;const d=new Date(v+'T00:00:00Z');return /^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===v;},'날짜를 확인해 주세요.');
const text=(max:number)=>z.string().trim().max(max).default('');
export const admissionSchema=z.object({birthDate:date.default(''),address:text(500),referral:text(200),previousPeriod:text(200),previousAcademy:text(200),previousBooks:text(2000),previousContent:text(3000),
 levels:z.array(z.object({subject:z.enum(admissionSubjects),schoolScore:z.number().min(0).max(100).nullable(),schoolGrade:text(30),mockScore:z.number().min(0).max(100).nullable(),mockGrade:text(30),diagnostic:text(1000)}).strict()).max(4).refine(rows=>new Set(rows.map(r=>r.subject)).size===rows.length,'과목 중복을 확인해 주세요.').default(emptyAdmission().levels),
 goal:text(3000),availableDays:z.array(z.enum(['월','화','수','목','금','토','일'])).max(7).refine(days=>new Set(days).size===days.length).default([]),availableTimes:text(1000),notes:text(5000),consent:z.enum(['미확인','동의','미동의']).default('미확인'),consentDate:date.default(''),signerName:text(100),signedPaper:z.boolean().default(false),
}).strict().default(emptyAdmission() as any).transform(value=>value as AdmissionInput);
function textChunks(value:string){const chunks:string[]=[];let content='';for(const char of value){if(content.length+char.length>1800){chunks.push(content);content='';}content+=char;}if(content)chunks.push(content);return chunks;}
// Admission is backed up in the student page body during the original CREATE.
// No second page creation or API call is needed, so response-loss recovery keeps the same marker.
export function admissionBlocks(a:AdmissionInput){
 const sections=[['입학·상담 정보',[a.birthDate&&`생년월일: ${a.birthDate}`,a.address&&`주소: ${a.address}`,a.referral&&`알게 된 경로: ${a.referral}`]],['이전 학습 이력',[a.previousPeriod&&`기간: ${a.previousPeriod}`,a.previousAcademy&&`학원명: ${a.previousAcademy}`,a.previousBooks&&`사용 교재: ${a.previousBooks}`,a.previousContent&&`학습 내용: ${a.previousContent}`]],['입학 당시 학습 수준',a.levels.filter(r=>r.schoolScore!==null||r.schoolGrade||r.mockScore!==null||r.mockGrade||r.diagnostic).map(r=>`${r.subject}\n내신 점수: ${r.schoolScore??'미입력'} / 등급: ${r.schoolGrade||'미입력'}\n모평 점수: ${r.mockScore??'미입력'} / 등급: ${r.mockGrade||'미입력'}\n진단평가: ${r.diagnostic||'미입력'}`)],['목표·가능 시간·참고 사항',[a.goal&&`목표: ${a.goal}`,a.availableDays.length&&`가능 요일: ${a.availableDays.join(', ')}`,a.availableTimes&&`가능 시간: ${a.availableTimes}`,a.notes&&`참고 사항: ${a.notes}`]],['원서 동의 확인',[`확인 상태: ${a.consent}`,a.consentDate&&`확인일: ${a.consentDate}`,a.signerName&&`서명자: ${a.signerName}`,`서명 원서 보관: ${a.signedPaper?'확인':'미확인'}`]]] as const;
 return sections.flatMap(([title,values])=>{const body=values.filter(Boolean).join('\n\n');if(!body)return [];return [{object:'block',type:'heading_2',heading_2:{rich_text:[{type:'text',text:{content:title}}]}},...textChunks(body).map(content=>({object:'block',type:'paragraph',paragraph:{rich_text:[{type:'text',text:{content}}]}}))];});
}

// Keep long notes losslessly within Notion's per-rich-text-item limit.
const richProperty=(value:string)=>({rich_text:textChunks(value).map(content=>({text:{content}}))});
export function admissionNotionProperties(a:AdmissionInput,guardianSalutation='') {
 const p:Record<string,any>={'생년월일':{date:a.birthDate?{start:a.birthDate}:null},'주소':richProperty(a.address),'알게 된 경로':richProperty(a.referral),'이전 학습 기간':richProperty(a.previousPeriod),'이전 학원명':richProperty(a.previousAcademy),'사용 교재':richProperty(a.previousBooks),'이전 학습 내용':richProperty(a.previousContent),'학습 목표':richProperty(a.goal),'수업 가능 요일':{multi_select:a.availableDays.map(name=>({name}))},'수업 가능 시간':richProperty(a.availableTimes),'상담 참고 사항':richProperty(a.notes),'개인정보 동의':{select:{name:a.consent}},'동의 확인일':{date:a.consentDate?{start:a.consentDate}:null},'서명자 이름':richProperty(a.signerName),'서명 원서 보관':{checkbox:a.signedPaper},'보호자 호칭':richProperty(guardianSalutation)};
 for(const subject of admissionSubjects){const row=a.levels.find(r=>r.subject===subject);p[subject+' 입학 내신 점수']={number:row?.schoolScore??null};p[subject+' 입학 내신 등급']=richProperty(row?.schoolGrade||'');p[subject+' 입학 모평 점수']={number:row?.mockScore??null};p[subject+' 입학 모평 등급']=richProperty(row?.mockGrade||'');p[subject+' 입학 진단평가']=richProperty(row?.diagnostic||'');}
 return p;
}
