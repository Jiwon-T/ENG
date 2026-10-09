import {z} from 'zod';
import {normalizeNotionPageId as uuid} from './notionPageId.js';
import {DIRECTORY_ROWS,directoryRowKey} from './academyDirectorySource.js';
import {coreActive} from './academyCore.js';
import {registrationNotion,registrationText,type RegistrationNotion} from './teacherStudentRegistrationNotion.js';
/** Only the school and grade entered in student management, for exam titles. Contacts and other profile fields are never returned. */
export async function readStudentSchool(db:any,actor:any,id:unknown,notion:RegistrationNotion=registrationNotion){
 const key=uuid(z.string().uuid().parse(id));
 const allowed=actor.admin||actor.principal||[...(actor.scopes||[]),...(actor.teachingScopes||[])].some((s:any)=>s.studentKey===key);
 if(!allowed)throw Error('FORBIDDEN');
 const row=(await db.collection(DIRECTORY_ROWS).doc(directoryRowKey('students',key)).get()).data();
 let properties=row?.kind==='students'&&row.academyId===actor.academyId&&!row.fields?.archived?row.fields?.properties:null;
 // Before the student switch the directory copy may be missing; Notion is still the source then.
 if(!properties&&!await coreActive(db,actor))properties=(await notion(`pages/${key}`))?.properties;
 return {school:properties?registrationText(properties['학교']).trim().slice(0,40):'',grade:String(properties?.['학년']?.select?.name||'').slice(0,10)};
}
