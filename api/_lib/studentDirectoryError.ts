export function studentDirectoryError(error: unknown) {
  const message = error instanceof Error ? error.message : '';
  const rawCode = (error as { code?: unknown } | null)?.code;
  const upstream = /^NOTION_QUERY_FAILED: (\d{3})$/.exec(message);
  if (upstream) return { error: 'NOTION_QUERY_FAILED', upstreamStatus: Number(upstream[1]), message: 'Notion 학생 목록 조회에 실패했습니다. 서버의 Notion 연결 권한과 DB 설정을 확인해 주세요.' };
  if (message.startsWith('CONFIG_ERROR:')) return { error: 'SERVER_CONFIG_ERROR', message: '서버 연결 설정을 확인해야 합니다. 관리자에게 문의해 주세요.' };
  if (['STUDENT_MAPPING_CONFLICT', 'STUDENT_ID_MISMATCH'].includes(message)) return { error: message, message: '학생 연결 정보가 충돌하여 목록을 불러오지 못했습니다. 기존 연결을 해제하지 말고 관리자에게 문의해 주세요.' };
  if (rawCode === 10 || rawCode === 'aborted') return { error: 'FIRESTORE_TRANSACTION_ABORTED', message: '학생 연결 정보 처리 중 충돌이 발생했습니다. 잠시 후 다시 시도해 주세요.' };
  if (rawCode === 9 || rawCode === 'failed-precondition') return { error: 'FIRESTORE_PRECONDITION_FAILED', message: '학생 연결 정보를 조회하지 못했습니다. 서버 로그에서 Firestore 설정 또는 인덱스를 확인해 주세요.' };
  if (rawCode === 7 || rawCode === 'permission-denied') return { error: 'FIRESTORE_PERMISSION_DENIED', message: '서버의 학생 데이터 접근 권한을 확인해야 합니다.' };
  return { error: 'SERVER_ERROR', message: '학생 목록을 불러오지 못했습니다. 잠시 후 새로고침해 주세요.' };
}
