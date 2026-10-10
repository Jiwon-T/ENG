// Only schema field names and stable error codes are public; never raw Notion responses.
export class LessonSchemaError extends Error {
 readonly fields:string[];
 constructor(fields:string[]){super('NOTION_SCHEMA_SETUP_REQUIRED');this.fields=fields;}
}
