/** Decides what an open admin page does next. The server lease remains the only execution lock. */
export type LessonMigrationJob={status?:string;phase?:string;nextRunAt?:number;busy?:boolean;mode?:string;final?:boolean;scanCompleted?:boolean;counts?:Record<string,number>;result?:any;lastError?:string|null};
export function nextDriverAction(job:LessonMigrationJob|null|undefined,now=Date.now()):{kind:'step'}|{kind:'wait';ms:number}|{kind:'stop'}{
 if(!job||!['running','waiting'].includes(job.status||''))return {kind:'stop'};
 if(job.busy)return {kind:'wait',ms:10000};
 if((job.nextRunAt||0)>now)return {kind:'wait',ms:Math.min(60000,Math.max(2000,job.nextRunAt!-now))};
 return {kind:'step'};
}
/** Which of the three steps the admin is on: 1 import, 2 resolve holds, 3 switch. */
export function lessonCutoverStep(status:{job?:LessonMigrationJob|null;openHolds?:number;cutover?:{active?:boolean}}|null|undefined):1|2|3{
 if(status?.cutover?.active)return 3;
 const job=status?.job;
 // The final check belongs to step 3; if it surfaces new problems they are resolved in step 2.
 if(job?.final)return ['running','waiting'].includes(job.status||'')||(status?.openHolds||0)===0?3:2;
 const imported=Boolean(job&&job.mode==='full'&&(job.scanCompleted||job.status==='completed'&&job.result));
 if(!imported)return 1;
 if(['running','waiting'].includes(job!.status||'')&&!job!.final)return job!.phase==='recheck'?2:1;
 return (status?.openHolds||0)>0?2:3;
}
export const lessonMigrationStatusLabel:Record<string,string>={running:'진행 중',waiting:'일시 오류 · 자동 재시도 대기',paused:'일시 중지',blocked:'중지됨 · 확인 필요',completed:'완료',none:'시작 전'};
export const lessonMigrationPhaseLabel:Record<string,string>={scan:'Notion 일지 읽는 중','catchup':'진행 중 바뀐 일지 다시 확인','app-check':'앱 일지·진행 중 요청 대조',recheck:'확인 필요 항목 다시 확인',report:'결과 정리',done:'완료'};
export const lessonMigrationPhaseOrder=['scan','catchup','app-check','recheck','report','done'];
export const lessonMigrationHoldLabel:Record<string,{label:string;accept?:string;fix:string}>={
 STUDENT_LINK_MISSING:{label:'학생이 연결되지 않은 일지',accept:'이전하지 않고 Notion에만 보관',fix:'Notion 일지에 학생을 연결하면 다시 확인할 때 이전됩니다. 지금 화면에도 보이지 않는 일지입니다.'},
 MULTIPLE_STUDENTS:{label:'학생이 2명 이상 연결된 일지',accept:'이전하지 않고 Notion에만 보관',fix:'일지 하나에 학생 한 명만 남기면 이전됩니다. 지금 화면에도 보이지 않는 일지입니다.'},
 SUBJECT_INVALID:{label:'과목이 비어 있거나 다른 일지',accept:'이전하지 않고 Notion에만 보관',fix:'Notion에서 과목을 고르면 이전됩니다.'},
 AUTHOR_UNKNOWN:{label:'작성 선생님이 연결되지 않은 일지',accept:'작성자 없이 이전 (관리자·원장만 보기)',fix:'Notion의 작성자 선생님을 연결하면 그 선생님 일지로 이전됩니다.'},
 MARKER_ORPHAN:{label:'앱 기록 번호가 맞지 않는 일지',accept:'Notion 작성 일지로 이전',fix:'앱에서 지워진 기록의 번호가 남은 경우입니다.'},
 PUBLIC_REPORT_MISSING:{label:'반영 완료인데 학부모 리포트가 없는 일지',accept:'공개 상태는 그대로 두고 이전',fix:'리포트가 필요하면 전환 후 앱에서 다시 반영하세요.'},
 PUBLIC_VALUES_DIFFER:{label:'학부모 리포트 내용이 Notion과 다른 일지',accept:'지금 공개된 내용 그대로 이전',fix:'공개 내용을 바꾸려면 전환 후 앱에서 수정해 반영하세요.'},
 SOURCE_REMOVED:{label:'Notion에서 삭제된 일지',accept:'앱에서도 숨김 (자료는 보관)',fix:'실수로 지웠다면 Notion 휴지통에서 복원하세요.'},
 STUDENT_MAPPING:{label:'앱 학생 연결이 없는 일지',fix:'학생·선생님·수강 이전에서 이 학생의 연결을 먼저 마쳐 주세요.'},
 DUPLICATE_APP_RECORD:{label:'앱 일지가 중복 연결된 일지',fix:'같은 Notion 일지에 앱 일지가 둘 이상 연결되어 있습니다. 관리자 확인이 필요합니다.'},
 DUPLICATE_PUBLIC:{label:'학부모 리포트가 중복된 일지',fix:'같은 일지의 공개 리포트가 둘 있습니다. 하나만 남기는 정리가 필요합니다.'},
 SOURCE_IDENTITY:{label:'학생·과목·학원이 앱 기록과 다른 일지',fix:'Notion 원본을 앱 기록과 같게 바로잡아 주세요.'},
 SOURCE_TOO_LARGE:{label:'내용이 너무 큰 일지',fix:'Notion 페이지 내용을 줄여 주세요.'},
 NOTION_WRITE_UNCERTAIN:{label:'Notion 저장 결과가 확인되지 않은 앱 일지',fix:'전체 대조를 다시 실행하면 자동으로 판정합니다.'},
 APP_WRITE_PENDING:{label:'지금 반영 중인 앱 일지',fix:'반영이 끝나면 다시 확인할 때 자동으로 풀립니다.'},
};
export const lessonCutoverCheckLabel:Record<string,string>={core:'학생·선생님 앱 전환 완료',migration:'과거 일지 전체 대조 완료',holds:'확인 필요 항목 없음',inFlight:'지금 반영 중인 일지 없음',paths:'앱 일지 조회·저장 경로 준비'};
export function lessonMigrationSummary(job:LessonMigrationJob|null|undefined){
 const c=job?.counts||{};
 return [['읽은 일지',c.seen],['이전',c.staged],['이전 예정',c.wouldStage],['변경 없음',c.unchanged],['앱 일지와 연결',c.appLinked],['확인 필요',c.held],['이전 제외',(c.excluded||0)+(c.otherAcademy||0)||undefined]].filter(([,v])=>v!==undefined&&v!==0) as [string,number][];
}
