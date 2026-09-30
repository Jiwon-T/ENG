/**
 * 수업 피드백 텍스트에서 과제 부분만 안전하게 추출하는 서버 순수 함수
 *
 * 규칙:
 * 1. feedback이 null, undefined, 비문자열 또는 공백이면 null 반환
 * 2. 줄 시작에 있는 '과제:' 또는 전각 콜론을 사용한 '과제：'를 인식 (콜론 앞뒤 공백 허용)
 * 3. feedback 안에 '과제:'가 여러 번 있으면 마지막으로 등장하는 줄 시작 표식을 사용
 * 4. 해당 표식 이후부터 문자열 끝까지를 과제 내용으로 추출
 * 5. '과제:'와 같은 줄에 있는 내용도 포함
 * 6. 다음 줄에 작성한 글머리표와 줄바꿈도 보존
 * 7. 일반 문장 중간에 들어간 '과제:'라는 단어는 오인하지 않도록 반드시 줄 시작 표식만 인식
 * 8. 비어 있거나 '없음', '없는 날', '없음.', '해당 없음' 등 과제 없음 표현은 null 반환
 */
export function extractAssignmentFromFeedback(feedback: string | null | undefined): string | null {
  if (!feedback || typeof feedback !== 'string') {
    return null;
  }

  const trimmed = feedback.trim();
  if (!trimmed) {
    return null;
  }

  // 줄 시작(또는 문자열 시작)에서 "과제" + 임의의 공백 + (: 또는 ：) 매칭
  // 'm' (multiline) 플래그로 각 줄의 시작(^|\n)에서만 인식
  // 'g' (global) 플래그로 모든 매칭 위치를 찾아 마지막 표식을 선택
  const regex = /(?:^|\n)[ \t]*과제[ \t]*[:：][ \t]*/g;

  let lastMatchIndex = -1;
  let matchLength = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(feedback)) !== null) {
    lastMatchIndex = match.index;
    matchLength = match[0].length;
  }

  if (lastMatchIndex === -1) {
    return null;
  }

  // 마지막 '과제:' 표식 바로 다음 위치부터 끝까지 추출
  const contentStart = lastMatchIndex + matchLength;
  const rawContent = feedback.slice(contentStart).trim();

  if (!rawContent) {
    return null;
  }

  // '과제 없음' 패턴 정규화 처리:
  // "없음", "없는 날", "없음.", "해당 없음", "해당없음", "x", "X", "-"
  const normalizedLower = rawContent.replace(/\s+/g, ' ').trim().toLowerCase();
  const noAssignmentPhrases = new Set([
    '없음',
    '없음.',
    '없는 날',
    '없는날',
    '해당 없음',
    '해당없음',
    '없습니다',
    '없습니다.',
    'x',
    '-',
  ]);

  if (noAssignmentPhrases.has(normalizedLower)) {
    return null;
  }

  return rawContent;
}
