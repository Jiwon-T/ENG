// 연결 제안 (admin, 앱 사용자): a signed-up account whose name matches exactly one registered student without an
// account, or one 앱 미연결 선생님, is offered for linking. The admin confirms each one; linking reuses the existing
// steps (linkStudentAccount; 선생님 권한 + linkOfflineTeacher). A suggestion the admin turns down is stored here, not
// in the browser, so it stays hidden on every device.
import {createHash} from 'node:crypto';
import {z} from 'zod';
import {DIRECTORY_ROWS,directoryRowKey,directorySourceKey,readDirectoryStudents} from './academyDirectorySource.js';
import {subjects} from './teacherWorkspacePolicy.js';
import {hashStudentKey} from './security.js';
import {normalizeNotionPageId as uuid} from './notionPageId.js';
import {linkStudentAccount} from './studentAccountLink.js';
import {setAppUserRole} from './appUsers.js';
import {linkOfflineTeacher} from './academyCore.js';
import {shortTeacherName} from '../../src/lib/teacherName.js';

const DISMISSED='linkSuggestionDismissals';
const COMPOUND_SURNAMES=['남궁','황보','제갈','선우','독고','사공','서문','동방','어금','망절'];
function admin(actor:any){if(actor.academyId!=='main'||!actor.admin)throw Error('FORBIDDEN');}
const norm=(v:string)=>String(v||'').replace(/\s+/g,'').toLowerCase();
/** The given name of a Korean name ("정하늘" → "하늘", "남궁민수" → "민수"); null when too short to compare. */
export function givenName(name:string){const n=norm(name);if(n.length<3)return null;const rest=COMPOUND_SURNAMES.includes(n.slice(0,2))&&n.length>=4?n.slice(2):n.slice(1);return rest.length>=2?rest:null;}
/** 2 = same name (spaces ignored), 1 = same given name (the surname left out on either side or different), 0 = no. */
export function nameMatch(a:string,b:string):0|1|2{
 const x=norm(a),y=norm(b);if(!x||!y)return 0;if(x===y)return 2;
 const xs=[x,givenName(x)].filter(v=>v&&v.length>=2),ys=[y,givenName(y)].filter(v=>v&&v.length>=2);
 return xs.some(v=>ys.includes(v))?1:0;
}
/** Teacher label → the person's name: "영수 박민지T" → "박민지". */
export const teacherBaseName=(label:string)=>shortTeacherName(label).replace(/\s*(T|선생님|쌤)$/,'').trim();
export const dismissalId=(kind:string,uid:string,target:string)=>createHash('sha256').update(`link-suggestion:${kind}:${uid}:${target}`).digest('hex');

type Person={id:string;name:string};
type Found={kind:'student'|'teacher';uid:string;targetId:string;level:1|2};
type Unclear={kind:'student'|'teacher';uid:string;count:number;targetIds:string[];reason:'same-name'|'shared';level:1|2};
/** Pure matching: for each account the best-matching target of a kind, offered only when it is the single one at that
 *  level and no other account matches that target as well. Turned-down pairs are skipped. */
export function matchLinkSuggestions(input:{kind:'student'|'teacher';accounts:Person[];targets:Person[];dismissed:Set<string>}){
 const found:Found[]=[],unclear:Unclear[]=[];
 for(const a of input.accounts){
  const scored=input.targets.filter(t=>!input.dismissed.has(dismissalId(input.kind,a.id,t.id))).map(t=>({t,level:nameMatch(a.name,t.name)})).filter(s=>s.level>0);
  if(!scored.length)continue;
  const best=Math.max(...scored.map(s=>s.level)),top=scored.filter(s=>s.level===best);
  if(top.length===1)found.push({kind:input.kind,uid:a.id,targetId:top[0].t.id,level:best as 1|2});
  else unclear.push({kind:input.kind,uid:a.id,count:top.length,targetIds:top.map(s=>s.t.id),reason:'same-name',level:best as 1|2});
 }
 // Two accounts pointing at the same target: neither is offered (the admin links it in 학생 관리 / 선생님 관리).
 const shared=new Set(found.map(f=>f.targetId).filter((id,i,all)=>all.indexOf(id)!==i));
 for(const f of found.filter(f=>shared.has(f.targetId)))unclear.push({kind:f.kind,uid:f.uid,count:found.filter(x=>x.targetId===f.targetId).length,targetIds:[f.targetId],reason:'shared',level:f.level});
 return {found:found.filter(f=>!shared.has(f.targetId)),unclear};
}

const text=(p:any)=>(p?.title||p?.rich_text||[]).map((v:any)=>v.plain_text??v.text?.content??'').join('');
/** users.createdAt (a Firestore Timestamp, or an ISO string on older records) → YYYY-MM-DD in Seoul, or null. */
function joinedDay(v:any){const ms=v?.toMillis?.()??(typeof v?.seconds==='number'?v.seconds*1000:typeof v==='string'?Date.parse(v):NaN);return Number.isFinite(ms)?new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul'}).format(new Date(ms)):null;}
const short=(d:string)=>{const [y,m,dd]=d.split('-');return `${y}.${Number(m)}.${Number(dd)}`;};
/** Same-name students side by side: 학교 · 학년 · 캠퍼스, 학원 등록일, 과목 시작일; "가입 직전 등록" when exactly one of
 *  them came to the academy within 14 days before the account signed up (a hint only: the admin still picks). */
export function markJustBefore<T extends {registered:string|null}>(choices:T[],joined:string|null){
 if(!joined)return choices.map(c=>({...c,justBefore:false}));const from=new Date(Date.parse(joined+'T00:00:00Z')-14*86_400_000).toISOString().slice(0,10);
 const near=choices.filter(c=>c.registered&&c.registered>=from&&c.registered<=joined);return choices.map(c=>({...c,justBefore:near.length===1&&near[0]===c}));
}
export async function readLinkSuggestions(db:any,actor:any){
 admin(actor);
 const [users,access,dismissals,students]=await Promise.all([db.collection('users').limit(1001).get(),db.collection('teacherWorkspaceAccess').get(),db.collection(DISMISSED).limit(1001).get(),readDirectoryStudents(db,actor)]);
 if(users.docs.length>1000||dismissals.docs.length>1000)throw Error('APP_USER_LIMIT');
 const profiles=new Map<string,any>(access.docs.map((d:any)=>[d.id,d.data()]));
 const dismissed=new Set<string>(dismissals.docs.map((d:any)=>d.id));
 const accountOf=(d:any)=>{const u=d.data()||{};return {id:d.id as string,name:String(u.alias||u.name||''),email:String(u.email||'').slice(0,120),role:u.role||'student',linkedStudent:Boolean(u.notionStudentKey),joined:joinedDay(u.createdAt)};};
 const all=users.docs.map(accountOf).filter((u:any)=>u.id!==process.env.ADMIN_UID&&u.id!==actor.uid&&u.name);
 // Students: registered and without an app account.
 const mapped=students.length?(typeof db.getAll==='function'?await db.getAll(...students.map((s:any)=>db.collection('notionStudentMappings').doc(hashStudentKey(s.studentKey)))):await Promise.all(students.map((s:any)=>db.collection('notionStudentMappings').doc(hashStudentKey(s.studentKey)).get()))):[];
 const openStudents=students.filter((_:any,i:number)=>!mapped[i].data()?.firebaseUid).map((s:any)=>({id:s.studentKey,name:String(s.studentDisplayName||'').replace(/\s*\(.*\)\s*$/,'')}));
 const studentAccounts=all.filter((u:any)=>u.role==='student'&&!u.linkedStudent);
 // Teachers: 앱 미연결 records; accounts that are new (student role) or teachers with only their automatic 명부 줄.
 const offline=[...profiles.entries()].filter(([,p])=>p.offline&&!p.disabled&&!p.linkedUid&&p.academyId==='main').map(([id,p])=>({id,name:teacherBaseName(p.workspaceLabel||''),profile:p}));
 const teacherAccounts=all.filter((u:any)=>{const p=profiles.get(u.id);if(u.role==='student')return !u.linkedStudent&&!p?.notionTeacherPageId;return ['teacher','principal'].includes(u.role)&&p&&!p.offline&&!p.disabled&&!p.linkedOfflineUid&&(!p.notionTeacherPageId||p.appTeacherRow);});
 const s=matchLinkSuggestions({kind:'student',accounts:studentAccounts,targets:openStudents,dismissed});
 const t=matchLinkSuggestions({kind:'teacher',accounts:teacherAccounts,targets:offline,dismissed});
 // Details to tell people apart: 학교 · 학년 · 캠퍼스 for a student; 담당 과목 and student count for a teacher.
 const rows=await Promise.all(s.found.map(f=>db.collection(DIRECTORY_ROWS).doc(directoryRowKey('students',f.targetId)).get()));
 const account=(uid:string)=>all.find((u:any)=>u.id===uid);
 const suggestions=[
  ...s.found.map((f,i)=>{const p=rows[i].data()?.fields?.properties||{};const detail=[text(p['학교']),p['학년']?.select?.name,(p['캠퍼스']?.multi_select||[]).map((c:any)=>c.name).join('·')].filter(Boolean).join(' · ');
   return {kind:'student',uid:f.uid,accountName:account(f.uid).name,email:account(f.uid).email,targetId:f.targetId,targetName:openStudents.find((x:any)=>x.id===f.targetId)!.name,detail,sameName:f.level===2};}),
  ...t.found.map(f=>{const o=offline.find(x=>x.id===f.targetId)!,a=account(f.uid);const n=new Set((o.profile.scopes||[]).map((x:any)=>uuid(x.studentKey))).size;
   return {kind:'teacher',uid:f.uid,accountName:a.name,email:a.email,targetId:f.targetId,targetName:o.profile.workspaceLabel||o.name,detail:[(o.profile.subjects||[]).join('·'),`담당 ${n}명`].filter(Boolean).join(' · '),sameName:f.level===2,needsRole:a.role==='student'};}),
 ];
 // Same-name students or teachers: offered side by side so the admin can pick one.
 const choiceStudents=[...new Set(s.unclear.filter(u=>u.reason==='same-name').flatMap(u=>u.targetIds))];
 const [studentRows,enrollRows]=await Promise.all([Promise.all(choiceStudents.map(k=>db.collection(DIRECTORY_ROWS).doc(directoryRowKey('students',k)).get())),Promise.all(choiceStudents.map(k=>db.collection(DIRECTORY_ROWS).where('sourceKey','==',directorySourceKey('enrollments')).where('studentKey','==',k).limit(2).get()))]);
 const about=new Map<string,{detail:string;registered:string|null;subjects:string}>();
 choiceStudents.forEach((k,i)=>{const p=studentRows[i].data()?.fields?.properties||{},e=enrollRows[i].docs.length===1?enrollRows[i].docs[0].data().fields?.properties||{}:{};
  const starts=subjects.map(sub=>[sub,e[sub+' 시작일']?.date?.start] as const).filter(([,d])=>d) as [string,string][];
  about.set(k,{detail:[text(p['학교']),p['학년']?.select?.name,(p['캠퍼스']?.multi_select||[]).map((c:any)=>c.name).join('·')].filter(Boolean).join(' · '),registered:p['학원 등록일']?.date?.start||starts.map(([,d])=>d).sort()[0]||null,subjects:starts.map(([sub,d])=>`${sub} ${short(d)}`).join(' · ')});});
 const unclear=[...s.unclear,...t.unclear].map(u=>{const a=account(u.uid);
  const choices=u.reason!=='same-name'?[]:u.kind==='student'?markJustBefore(u.targetIds.map(id=>({targetId:id,targetName:openStudents.find((x:any)=>x.id===id)!.name,sameName:u.level===2,...about.get(id)!})),a.joined)
   :u.targetIds.map(id=>{const o=offline.find(x=>x.id===id)!;return {targetId:id,targetName:o.profile.workspaceLabel||o.name,sameName:u.level===2,detail:[(o.profile.subjects||[]).join('·'),`담당 ${new Set((o.profile.scopes||[]).map((x:any)=>uuid(x.studentKey))).size}명`].join(' · '),registered:null,subjects:'',justBefore:false};});
  return {kind:u.kind,uid:u.uid,accountName:a.name,email:a.email,joined:a.joined,count:u.count,reason:u.reason,needsRole:u.kind==='teacher'&&a.role==='student',choices};});
 return {suggestions,unclear};
}

const pick=z.object({kind:z.enum(['student','teacher']),uid:z.string().min(1).max(200),targetId:z.string().min(1).max(200)}).strict();
/** 연결: a student account to the student (as in 학생 관리), or 선생님 권한 + link to the 앱 미연결 선생님. */
export async function acceptLinkSuggestion(db:any,actor:any,input:unknown){
 admin(actor);const v=pick.parse(input);
 if(v.kind==='student')return {kind:v.kind,...await linkStudentAccount(db,{firebaseUid:v.uid,studentKey:uuid(v.targetId),linkedByUid:actor.uid})};
 const user=(await db.collection('users').doc(v.uid).get()).data();if(!user)throw Error('USER_NOT_FOUND');
 if(user.notionStudentKey)throw Error('APP_USER_LINKED_STUDENT');
 if(!['teacher','principal'].includes(user.role))await setAppUserRole(db,actor,{uid:v.uid,role:'teacher'});
 return {kind:v.kind,...await linkOfflineTeacher(db,actor,{offlineUid:v.targetId,uid:v.uid})};
}
/** 아니요: this pair is not suggested again. */
export async function dismissLinkSuggestion(db:any,actor:any,input:unknown){
 admin(actor);const v=pick.parse(input);
 const ref=db.collection(DISMISSED).doc(dismissalId(v.kind,v.uid,v.targetId));
 await db.runTransaction(async(tx:any)=>{tx.set(ref,{kind:v.kind,uid:v.uid,targetId:v.targetId,by:actor.uid,at:Date.now()});});
 return {dismissed:true};
}
