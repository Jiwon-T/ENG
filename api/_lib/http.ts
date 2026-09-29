import type { IncomingMessage, ServerResponse } from 'http';

export function sendJson(res: ServerResponse, statusCode: number, data: any) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(data));
}

export async function parseJsonBody(req: IncomingMessage): Promise<any> {
  if ((req as any).body && typeof (req as any).body === 'object') {
    return (req as any).body;
  }
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 1e6) {
        req.destroy();
        reject(new Error('PAYLOAD_TOO_LARGE'));
      }
    });
    req.on('end', () => {
      if (!body.trim()) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (e) {
        reject(new Error('INVALID_JSON'));
      }
    });
    req.on('error', reject);
  });
}

export function parseCookies(req: IncomingMessage): Record<string, string> {
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return {};
  const list: Record<string, string> = {};
  cookieHeader.split(';').forEach(cookie => {
    const parts = cookie.split('=');
    const name = parts.shift()?.trim();
    if (name) {
      list[name] = decodeURIComponent(parts.join('=').trim());
    }
  });
  return list;
}

export function setCookie(
  res: ServerResponse,
  name: string,
  value: string,
  options: {
    maxAgeSeconds?: number;
    path?: string;
    httpOnly?: boolean;
    secure?: boolean;
    sameSite?: 'Strict' | 'Lax' | 'None';
  } = {}
) {
  const {
    maxAgeSeconds = 86400,
    path = '/',
    httpOnly = true,
    secure = process.env.NODE_ENV === 'production',
    sameSite = 'Lax',
  } = options;

  let cookieString = `${name}=${encodeURIComponent(value)}; Path=${path}; Max-Age=${maxAgeSeconds}; SameSite=${sameSite}`;
  if (httpOnly) cookieString += '; HttpOnly';
  if (secure) cookieString += '; Secure';

  res.setHeader('Set-Cookie', cookieString);
}
