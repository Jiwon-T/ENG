export interface SafeFetchResult<T> {
  ok: boolean;
  status: number;
  data: T | null;
  error?: string;
  userMessage: string;
}

/**
 * 안전한 클라이언트 JSON fetch 유틸리티:
 * 1. 응답 상태 및 Content-Type 검증
 * 2. text()로 먼저 안전하게 읽어 JSON 파싱 시도
 * 3. JSON이 아니거나 HTML/오류 페이지일 때 "Unexpected token" 예외 방지
 * 4. 민감한 내부 에러나 HTML 본문을 콘솔/UI에 노출하지 않고 표준 안내 메시지로 변환
 */
export async function safeFetchJson<T = any>(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<SafeFetchResult<T>> {
  try {
    const res = await fetch(input, init);
    const contentType = res.headers.get('content-type') || '';
    const rawText = await res.text();

    if (!rawText || !rawText.trim()) {
      return {
        ok: res.ok,
        status: res.status,
        data: null,
        userMessage: res.ok ? '' : '서버 응답이 비어 있습니다.',
      };
    }

    if (contentType.includes('application/json')) {
      try {
        const parsed = JSON.parse(rawText);
        return {
          ok: res.ok && parsed.ok !== false,
          status: res.status,
          data: parsed,
          error: parsed.error,
          userMessage: parsed.message || (res.ok ? '' : '서버 연결에 실패했습니다. 잠시 후 다시 시도해 주세요.'),
        };
      } catch (parseErr) {
        return {
          ok: false,
          status: res.status,
          data: null,
          error: 'JSON_PARSE_ERROR',
          userMessage: '서버 연결에 실패했습니다. 잠시 후 다시 시도해 주세요.',
        };
      }
    }

    // JSON이 아닌 일반 텍스트나 HTML 에러 페이지인 경우 (Unexpected token 'A' 방지)
    return {
      ok: false,
      status: res.status,
      data: null,
      error: 'NON_JSON_RESPONSE',
      userMessage: '서버 연결에 실패했습니다. 잠시 후 다시 시도해 주세요.',
    };
  } catch (netErr: any) {
    return {
      ok: false,
      status: 0,
      data: null,
      error: 'NETWORK_ERROR',
      userMessage: '네트워크 연결이 불안정합니다. 인터넷 상태를 확인해 주세요.',
    };
  }
}
