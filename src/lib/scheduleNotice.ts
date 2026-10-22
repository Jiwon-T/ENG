// 일정 저장·반영 알림: what the teacher is told depends on who receives the 일정. With students it goes to their
// 학생·학부모 일정 (반영); without (a 신입생 상담) nothing goes out, so the button says 확정 and the notice says so.
export const scheduleAudience = (students: unknown) => Array.isArray(students) ? new Set(students).size : 0;
export const publishLabel = (count: number) => count ? '반영' : '확정';
export const publishedNotice = (count: number) => count ? `학생 ${count}명의 학생·학부모 일정에 반영했어요` : '일정을 확정했어요 · 대상 학생이 없어 학생·학부모 화면에는 보이지 않아요';
export const savedNotice = (count: number) => count ? '일정을 저장했습니다. 반영하면 학생·학부모 리포트에 표시됩니다.' : '일정을 저장했어요. 대상 학생이 없어 확정해도 학생·학부모 화면에는 보이지 않아요.';
