const RESERVED = new Set(['api', 'admin', 'teacher', 'student', 'parent', 'report', 'reports', 'login', 'logout', 'signup', 'register', 'home', 'profile', 'settings', 'archive', 'analyzer', 'generator', 'library', 'auth', 'callback', 'assets', 'static', 'favicon', 'robots', 'sitemap', 'manifest', 'health', 'vocab', 'grammar', 'exam', 'tutor', 'teacher-room', 'pet', 'sw', 'icon']);
export function parentStartupSlug(pathname: string) {
  const legacy = pathname.match(/^\/report\/([a-z0-9]{3,30})$/);
  if (legacy) return legacy[1];
  const match = pathname.match(/^\/([a-z0-9]{3,30})$/);
  return match && !RESERVED.has(match[1]) ? match[1] : null;
}
