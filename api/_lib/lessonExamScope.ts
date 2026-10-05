import {LessonSchemaError} from './teacherLessonDiagnostics.js';
export function lessonExamScopeProperties(schema:any,input:any,value:string){
 // Old immutable write intents did not contain this property. Do not change
 // their payload during a retry just because the schema gained a new field.
 if(!value&&!Object.hasOwn(input,'examScope'))return {};
 if(!schema.properties?.['시험범위']){if(value)throw new LessonSchemaError(['시험범위']);return {};}
 if(schema.properties['시험범위'].type!=='rich_text')throw new LessonSchemaError(['시험범위 (텍스트)']);
 return {'시험범위':{rich_text:value.match(/[\s\S]{1,1900}/g)?.map(content=>({type:'text',text:{content}}))||[]}};
}
