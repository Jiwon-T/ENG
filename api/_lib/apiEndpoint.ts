// Vercel rewrites retain query parameters used by the original handlers.
// Local calls use the original path; rewritten calls use the fixed endpoint.
export function apiEndpoint(rawUrl: string | undefined, audience: 'parent' | 'student') {
  const url = new URL(rawUrl || '/', 'http://localhost');
  const prefix = `/api/${audience}/`;
  return url.pathname.startsWith(prefix)
    ? url.pathname.slice(prefix.length)
    : url.pathname === `/api/${audience}` ? url.searchParams.get('__endpoint') || '' : '';
}
