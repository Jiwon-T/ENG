// 선생님 인증: a student's own study (워크북 printed and done, 지문 분석지 read again, 변형 문제 they made and solved) is
// checked by the teacher, who gives the points. Shared by the server and the screens. Server-imported: relative imports
// keep .js.
export type CertKind = 'workbook' | 'reading' | 'questions';
export type CertGrade = '최상' | '상' | '중' | 'ok' | 'redo';
export const CERT_RULES = {
  /** 워크북: by how well it was done (다시 해 오기: none, may be asked again). */
  workbook: { 최상: { points: 30, xp: 45 }, 상: { points: 20, xp: 30 }, 중: { points: 10, xp: 15 } },
  /** 지문 분석지: each 회독 (one a day), up to 3 a passage. */
  reading: { points: 10, xp: 15, rounds: 3 },
  /** Paid outside the daily study cap (the teacher checked it), at most this many a day. */
  dailyPaid: 5,
  /** Requests waiting at once. */
  maxPending: 10,
  /** A photo (optional): a JPEG data URL, shrunk on the phone first. */
  photoChars: 700_000,
} as const;
export const CERT_KIND_LABEL: Record<CertKind, string> = { workbook: '워크북', reading: '지문 분석지', questions: '직접 만든 변형 문제' };
/** The grades a teacher can give each kind (the last one is always 다시 해 오기 / 아직이에요). */
export const CERT_GRADES: Record<CertKind, { grade: CertGrade; label: string }[]> = {
  workbook: [{ grade: '최상', label: '최상 +30P' }, { grade: '상', label: '상 +20P' }, { grade: '중', label: '중 +10P' }, { grade: 'redo', label: '다시 해 오기' }],
  reading: [{ grade: 'ok', label: '회독 확인 +10P' }, { grade: 'redo', label: '아직이에요' }],
  questions: [{ grade: 'ok', label: '인정' }, { grade: 'redo', label: '다시 풀어 오기' }],
};
export interface CertView { id: string; kind: CertKind; ref: string; round: number; title: string; status: 'pending' | 'approved' | 'redo'; grade: CertGrade | null; points: number; photo: boolean; requestedAt: number; decidedAt: number | null }
