// Only schema field names and stable error codes are public; never raw Notion responses.
export class LessonSchemaError extends Error {
 readonly fields:string[];
 constructor(fields:string[]){super('NOTION_SCHEMA_SETUP_REQUIRED');this.fields=fields;}
}
export function assertLessonNotionFields(schema:any,properties:Record<string,any>){
 const missing=Object.keys(properties).filter(key=>!schema.properties?.[key]);
 if(missing.length)throw new LessonSchemaError(missing);
}
export function lessonSyncWarning(failure:{body:{error:string;message?:string;diagnosticId:string}}){
 return `학생·학부모 리포트에는 반영됐습니다. 노션 저장 대기: ${failure.body.message||'노션 연결을 확인해 주세요.'} (${failure.body.error}, 오류 ID: ${failure.body.diagnosticId}) 저장 결과 확인·재시도로 기존 요청을 확인해 주세요.`;
}
