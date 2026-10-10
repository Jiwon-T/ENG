import TeacherWorkspace from './TeacherWorkspace';

/** 선생님방: the workspace. The old account/report room was retired once its last features moved
 *  (app name → 학생 홈·앱 사용자, 학습 성취도 평가 → 학생 관리 › 온라인 학습). */
export default function TeacherRoom({ onNavigate }: { onNavigate?: (view: any) => void }) {
  return <TeacherWorkspace onNavigate={onNavigate} />;
}
