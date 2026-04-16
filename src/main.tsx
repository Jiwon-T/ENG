import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
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
    <App />
  </StrictMode>,
);
