import {StrictMode, Suspense, lazy} from 'react';
import {createRoot} from 'react-dom/client';
import { parentStartupSlug } from './lib/startupRoute';
const App = lazy(() => import('./App'));
const ParentReport = lazy(() => import('./components/parent/ParentReportView').then(m => ({ default: m.ParentReportView })));
const parentSlug = parentStartupSlug(window.location.pathname);
if (parentSlug && window.location.pathname.startsWith('/report/')) window.history.replaceState({}, '', `/${parentSlug}`);
import './index.css';

// Force HTTPS redirect
if (typeof window !== 'undefined' && 
    window.location.protocol === 'http:' && 
    !window.location.hostname.includes('localhost') &&
    !window.location.hostname.includes('127.0.0.1')) {
  window.location.replace(window.location.href.replace('http:', 'https:'));
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Suspense fallback={<div role="status" className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-500">지원T를 불러오는 중입니다…</div>}>
      {parentSlug ? <ParentReport reportSlug={parentSlug} onGoHome={() => { window.location.href = '/'; }} /> : <App />}
    </Suspense>
  </StrictMode>,
);
