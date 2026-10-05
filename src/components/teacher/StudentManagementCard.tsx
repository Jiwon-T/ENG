export default function StudentManagementCard({student,onOpen}:{student:any;onOpen:()=>void}) {
 return <button type="button" className="student-management-card" aria-label={`${student.studentDisplayName} 학생 관리 열기`} onClick={onOpen}>
  <span className="font-bold text-sm">{student.studentDisplayName}</span>
  <span className="flex flex-wrap gap-1 mt-2">{(student.subjects||[]).map((s:any)=><span key={s.subject} className="text-[11px] px-2 py-1 rounded-full bg-white border border-slate-100">{s.subject} · {s.status}</span>)}</span>
  <span className="text-xs text-slate-500 mt-2">{student.linkedFirebaseUid?'앱 계정 연결됨':'앱 계정 미연결'} · {student.hasGuardianContact?'보호자 연락처 등록됨':'연락처 확인 필요'}</span>
  <span className="student-management-card-hint">학생 관리 열기 →</span>
 </button>;
}
