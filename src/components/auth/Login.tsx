import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Info, ShieldCheck, Lock, Mail, Eye, EyeOff, ExternalLink, Copy, Users, MessageCircle } from 'lucide-react';
import { signIn, signUpWithEmail, signInWithEmail, resetPassword } from '../../lib/firebase';
import { NibTile } from '../RosyLogo';

/** In-app browsers (카카오톡, 인스타그램, 네이버, 라인, 페이스북, 에브리타임) block Google sign-in. */
export function inAppBrowser(ua: string): { name: string; android: boolean } | null {
  const android = /Android/i.test(ua);
  const known: [RegExp, string][] = [[/KAKAOTALK/i, '카카오톡'], [/Instagram/i, '인스타그램'], [/NAVER\(inapp/i, '네이버'], [/\bLine\//i, '라인'], [/FBAN|FBAV/i, '페이스북'], [/everytimeApp/i, '에브리타임']];
  const hit = known.find(([re]) => re.test(ua));
  return hit ? { name: hit[1], android } : null;
}
/** Where "다른 브라우저로 열기" goes: KakaoTalk's own opener, else Chrome on Android; null on iPhone (copy the link). */
export function externalOpenUrl(href: string, app: { name: string; android: boolean }) {
  if (app.name === '카카오톡') return `kakaotalk://web/openExternal?url=${encodeURIComponent(href)}`;
  if (!app.android) return null;
  const u = new URL(href);
  return `intent://${u.host}${u.pathname}${u.search}#Intent;scheme=${u.protocol.replace(':', '')};package=com.android.chrome;end`;
}
/** Official Google "G" mark (Google sign-in branding). */
function GoogleMark() {
  return <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>;
}
// 최근 로그인한 이메일: kept on this device (on by default; unticking forgets it). Any storage error just means nothing is remembered.
const REMEMBER_KEY = 'jt.login.email', REMEMBER_OFF_KEY = 'jt.login.remember-off';
const readStore = (key: string) => { try { return localStorage.getItem(key); } catch { return null; } };
const writeStore = (key: string, value: string | null) => { try { if (value == null) localStorage.removeItem(key); else localStorage.setItem(key, value); } catch { /* not available: nothing remembered */ } };
/** "haneul@gmail.com" → "ha•••@gmail.com" */
export const maskEmail = (value: string) => { const [local, domain] = value.split('@'); return domain ? `${local.slice(0, 2)}•••@${domain}` : value; };
const RESET_SENT = '가입된 이메일이면 비밀번호 재설정 메일을 보냈어요. 메일함(스팸함 포함)을 확인해 주세요.';
const inputClass = 'w-full pl-11 pr-4 py-3.5 bg-[#f7f8fa] rounded-2xl border border-[#eef0f4] outline-none focus:border-[#eaa0a9] focus:bg-white font-medium text-slate-700 text-sm md:text-base';

function PasswordField({ id, label, value, onChange, autoComplete, required }: { id: string; label: string; value: string; onChange: (v: string) => void; autoComplete: string; required: boolean }) {
  const [shown, setShown] = useState(false);
  return <div className="relative">
    <label htmlFor={id} className="sr-only">{label}</label>
    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} aria-hidden="true" />
    <input id={id} type={shown ? 'text' : 'password'} placeholder={label} value={value} onChange={e => onChange(e.target.value)} autoComplete={autoComplete} className={inputClass + ' pr-11'} required={required} />
    <button type="button" onClick={() => setShown(v => !v)} aria-label={shown ? '비밀번호 숨기기' : '비밀번호 보기'} aria-pressed={shown} className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-slate-400 hover:text-slate-600">{shown ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}</button>
  </div>;
}

export default function Login() {
  const [showTerms, setShowTerms] = useState(false);
  const dialogRef = useRef<HTMLDivElement | null>(null), opener = useRef<HTMLElement | null>(null);
  const openTerms = () => { opener.current = document.activeElement as HTMLElement | null; setShowTerms(true); };
  useEffect(() => { if (!showTerms) opener.current?.focus(); }, [showTerms]);
  // Tab and Shift+Tab cycle inside the notice while it is open.
  const trapTab = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { setShowTerms(false); return; }
    if (e.key !== 'Tab' || !dialogRef.current) return;
    const items = [...dialogRef.current.querySelectorAll<HTMLElement>('button, [href], input, [tabindex]:not([tabindex="-1"])')];
    if (!items.length) return; const first = items[0], last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); } else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };
  const [mode, setMode] = useState<'login' | 'signup' | 'reset'>('login');
  const [saved, setSaved] = useState(() => readStore(REMEMBER_KEY) || '');
  const [remember, setRemember] = useState(() => readStore(REMEMBER_OFF_KEY) !== '1');
  const [email, setEmail] = useState(saved);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | React.ReactNode>('');
  const [success, setSuccess] = useState('');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const app = typeof navigator !== 'undefined' ? inAppBrowser(navigator.userAgent) : null;
  const external = app ? externalOpenUrl(window.location.href, app) : null;
  const copyLink = async () => { try { await navigator.clipboard.writeText(window.location.href); setCopied(true); } catch { setCopied(false); } };
  const keep = (address: string) => { writeStore(REMEMBER_OFF_KEY, remember ? null : '1'); writeStore(REMEMBER_KEY, remember && address ? address : null); };
  const forget = () => { writeStore(REMEMBER_KEY, null); setSaved(''); setEmail(''); };
  // The choice is saved at once: unticking forgets the stored email now, not only after a successful login.
  const changeRemember = (on: boolean) => { setRemember(on); writeStore(REMEMBER_OFF_KEY, on ? null : '1'); if (!on) { writeStore(REMEMBER_KEY, null); setSaved(''); } };
  const openNewWindow = <button type="button" onClick={() => window.open(window.location.href, '_blank')} className="text-[11px] underline underline-offset-2 text-[#b04a5a] hover:text-[#8b2f40] font-bold">새 창에서 로그인하기 ↗</button>;

  const handleGoogleLogin = async () => {
    if (busy) return;
    setError('');
    if (app) { setError(`${app.name} 안에서는 구글 로그인이 안 돼요. 위의 안내대로 다른 브라우저에서 열거나, 이메일로 로그인해 주세요.`); return; }
    setBusy(true);
    try {
      const user = await signIn();
      keep(user?.email || '');
    } catch (error: any) {
      // Only the error code is logged (Firebase errors can carry the email address).
      console.error('Google sign-in failed:', error?.code || 'unknown');
      if (error?.code === 'auth/popup-blocked') {
        setError('브라우저의 팝업 차단이 설정되어 있습니다. 팝업을 허용해 주시거나, 화면을 길게 눌러 "새 탭에서 열기"를 이용해 보세요.');
      } else if (error?.code === 'auth/popup-closed-by-user') {
        setError('로그인 창이 닫혔습니다. 다시 시도해 주세요.');
      } else if (error?.code === 'auth/cancelled-popup-request') {
        // Ignore duplicate requests
      } else if (error?.code === 'auth/user-disabled') {
        setError('이 계정은 학원에서 사용을 중지했습니다. 학원에 문의해 주세요.');
      } else if (error?.code === 'auth/network-request-failed') {
        setError('네트워크 연결이 원활하지 않습니다. 인터넷 연결을 확인해 주세요.');
      } else if (error?.code === 'auth/unauthorized-domain') {
        setError('이 주소에서는 구글 로그인을 쓸 수 없어요. 이메일로 로그인하시거나 학원에 알려 주세요.');
      } else if (error?.code === 'auth/internal-error' || error?.message?.includes('cross-origin') || error?.message?.includes('storage-access')) {
        setError(<span className="flex flex-col gap-2 items-center"><span>브라우저 보안 설정으로 로그인이 막혔어요.</span><span className="text-[11px] text-slate-500 text-center font-medium">사파리·크롬의 '크로스 사이트 추적 방지' 때문일 수 있어요. 다른 브라우저를 쓰거나 새 창에서 다시 해 보세요.</span>{openNewWindow}</span>);
      } else {
        setError(<span className="flex flex-col gap-2 items-center"><span>구글 로그인 중 오류가 발생했습니다.</span>{openNewWindow}</span>);
      }
    } finally {
      setBusy(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setError('');
    setSuccess('');

    if (mode === 'reset') {
      setBusy(true);
      try {
        await resetPassword(email);
        setSuccess(RESET_SENT);
      } catch (error: any) {
        // The same message whether or not the address is registered (no hint about who has an account).
        if (error.code === 'auth/user-not-found') setSuccess(RESET_SENT);
        else if (error.code === 'auth/invalid-email') setError('유효하지 않은 이메일 형식입니다.');
        else setError('이메일 전송 중 오류가 발생했습니다.');
      } finally {
        setBusy(false);
      }
      return;
    }

    if (mode === 'signup' && password !== confirmPassword) {
      setError('비밀번호가 일치하지 않습니다.');
      return;
    }

    setBusy(true);
    try {
      if (mode === 'signup') {
        try {
          await signUpWithEmail(email, password);
          keep(email);
        } catch (signupError: any) {
          if (signupError.code === 'auth/email-already-in-use') {
            // Attempt to "Login" with the same credentials to see if it's a re-activation
            try {
              await signInWithEmail(email, password);
              keep(email);
              // If successful, onAuthStateChanged in App.tsx will handle the rest
              return;
            } catch {
              // If login fails, then they definitely have an account and gave the wrong password
              setError('이미 가입된 이메일입니다. 이전에 가입하셨다면 로그인 버튼을 누르거나 비밀번호를 다시 확인해 주세요.');
              return;
            }
          }
          throw signupError;
        }
      } else {
        await signInWithEmail(email, password);
        keep(email);
      }
    } catch (error: any) {
      const expectedCodes = ['auth/email-already-in-use', 'auth/weak-password', 'auth/invalid-email', 'auth/user-not-found', 'auth/wrong-password', 'auth/invalid-credential'];
      if (!expectedCodes.includes(error.code)) console.error('Email sign-in failed:', error?.code || 'unknown');

      if (error.code === 'auth/email-already-in-use') {
        setError('이미 등록된 이메일입니다. 로그인하시거나 다른 이메일을 사용해 주세요.');
      } else if (error.code === 'auth/weak-password') {
        setError('비밀번호가 너무 취약합니다. 6자 이상으로 설정해 주세요.');
      } else if (error.code === 'auth/invalid-email') {
        setError('유효하지 않은 이메일 형식입니다.');
      } else if (error.code === 'auth/user-disabled') {
        setError('이 계정은 학원에서 사용을 중지했습니다. 학원에 문의해 주세요.');
      } else if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        setError('이메일 또는 비밀번호가 일치하지 않습니다.');
      } else if (error.code === 'auth/too-many-requests') {
        setError('시도가 너무 많았어요. 잠시 뒤 다시 해 주세요.');
      } else {
        setError('인증 중 오류가 발생했습니다. 잠시 뒤 다시 시도해 주세요.');
      }
    } finally {
      setBusy(false);
    }
  };

  const switchMode = (next: 'login' | 'signup' | 'reset') => { setMode(next); setConfirmPassword(''); setError(''); setSuccess(''); };
  const submitText = busy ? (mode === 'login' ? '로그인 중…' : mode === 'signup' ? '가입하는 중…' : '보내는 중…') : mode === 'login' ? '로그인하기' : mode === 'signup' ? '가입하기' : '재설정 메일 보내기';

  const subtitle = mode === 'login' ? '로그인하고 오늘 수업을 이어가세요' : mode === 'signup' ? '새 계정을 만들고 시작하세요' : '비밀번호 다시 설정하기';
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const onTabKey = (e: React.KeyboardEvent) => {
    const order: ('login' | 'signup')[] = ['login', 'signup'], at = Math.max(0, order.indexOf(mode as 'login' | 'signup'));
    const next = e.key === 'ArrowRight' ? order[(at + 1) % 2] : e.key === 'ArrowLeft' ? order[(at + 1) % 2] : e.key === 'Home' ? 'login' : e.key === 'End' ? 'signup' : null;
    if (!next) return; e.preventDefault(); switchMode(next); tabRefs.current[next]?.focus();
  };
  const tab = (key: 'login' | 'signup', label: string) => <button type="button" role="tab" id={`login-tab-${key}`} ref={el => { tabRefs.current[key] = el; }} tabIndex={mode === key ? 0 : -1} aria-selected={mode === key} onClick={() => switchMode(key)} className={`flex-1 rounded-full py-2 text-sm font-bold transition-colors ${mode === key ? 'bg-white text-[#8b2f40] shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>{label}</button>;

  return (
    <div className="min-h-screen flex items-start md:items-center justify-center bg-white p-4 md:p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        inert={showTerms}
        className="mt-4 w-full max-w-[400px] rounded-[28px] border border-[#f5e6e9] bg-white px-5 pt-8 shadow-[0_10px_36px_rgba(210,98,114,0.10)] md:mt-0 md:px-7"
      >
        <div className="px-2 pb-6 text-center">
          <NibTile size={72} className="mx-auto mb-4" />
          <h1 className="text-[28px] md:text-[32px] font-black tracking-tight text-[#1f1a24]">지원T <span className="text-[#e0587a]">English</span></h1>
          <p className="mt-1.5 text-sm font-medium text-slate-500">{subtitle}</p>
        </div>

        <div className="px-1 text-center">
        {app && <div role="note" className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-left text-[13px] text-amber-900">
          <p className="font-bold">{app.name} 안에서 열려 있어요</p>
          <p className="mt-1 font-medium leading-relaxed">구글 로그인은 다른 브라우저에서만 돼요. 이메일 로그인은 여기서도 돼요.</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {external ? <a href={external} className="inline-flex items-center gap-1 rounded-lg bg-white px-3 py-1.5 font-bold border border-amber-200"><ExternalLink size={14} aria-hidden="true" />다른 브라우저로 열기</a>
              : <button type="button" onClick={() => void copyLink()} className="inline-flex items-center gap-1 rounded-lg bg-white px-3 py-1.5 font-bold border border-amber-200"><Copy size={14} aria-hidden="true" />{copied ? '주소를 복사했어요' : '주소 복사하기'}</button>}
          </div>
          {!external && <p className="mt-2 text-[12px] text-amber-800">복사한 주소를 사파리에 붙여 넣어 열어 주세요. 오른쪽 아래 ⋯ 메뉴의 '다른 브라우저로 열기'도 돼요.</p>}
        </div>}
          {mode !== 'reset' ? <div role="tablist" aria-label="로그인 또는 가입" onKeyDown={onTabKey} className="mb-4 flex rounded-full bg-[#f8f1f2] p-1">{tab('login', '로그인')}{tab('signup', '가입하기')}</div>
            : <p className="mb-4 text-sm text-slate-500 font-medium">가입하신 이메일을 입력하면 재설정 링크를 보내드립니다.</p>}

          <form onSubmit={handleSubmit} className="space-y-3 mb-4">
            {mode === 'login' && saved && email === saved ? <div className="flex items-center gap-2 rounded-2xl border border-[#f6d3d8] bg-[#fef2f3] px-4 py-3 text-left">
              <input id="login-email" type="email" autoComplete="username" value={email} readOnly className="sr-only" tabIndex={-1} aria-label="이메일" />
              <Mail size={18} className="text-[#b04a5a] flex-none" aria-hidden="true" /><span className="flex-1 truncate text-sm font-bold text-slate-700">{maskEmail(saved)}</span>
              <button type="button" onClick={forget} className="text-xs font-bold text-slate-400 hover:text-[#b04a5a]">다른 계정</button>
            </div> : <div className="relative">
              <label htmlFor="login-email" className="sr-only">이메일</label>
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} aria-hidden="true" />
              <input id="login-email" type="email" inputMode="email" autoComplete={mode === 'signup' ? 'email' : 'username'} placeholder="이메일" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} required />
            </div>}

            {mode !== 'reset' && <PasswordField id="login-password" label="비밀번호" value={password} onChange={setPassword} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} required />}

            <AnimatePresence>
              {mode === 'signup' && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                  <PasswordField id="login-password-confirm" label="비밀번호 확인" value={confirmPassword} onChange={setConfirmPassword} autoComplete="new-password" required />
                  <p className="mt-1.5 text-left text-xs text-slate-400 font-medium">비밀번호는 6자 이상이에요.</p>
                </motion.div>
              )}
            </AnimatePresence>

            {mode !== 'reset' && <div className="flex items-center justify-between gap-2 px-1">
              <label className="flex items-center gap-2 text-left text-xs font-medium text-slate-500"><input type="checkbox" checked={remember} onChange={e => changeRemember(e.target.checked)} className="h-4 w-4 accent-[#e0587a]" />이메일 기억하기</label>
              {mode === 'login' && <button type="button" onClick={() => switchMode('reset')} className="text-xs font-medium text-slate-400 hover:text-[#b04a5a]">비밀번호를 잊으셨나요?</button>}
            </div>}

            {error && <p role="alert" className="text-sm text-red-500 font-bold">{error}</p>}
            {success && <p role="status" className="text-sm text-emerald-600 font-bold">{success}</p>}

            <button type="submit" disabled={busy} aria-busy={busy} className="w-full py-4 bg-[#e0587a] text-white rounded-2xl font-bold hover:bg-[#cc4a6b] transition-all flex items-center justify-center gap-3 shadow-lg shadow-[#e0587a40] active:scale-[0.98] disabled:opacity-60 disabled:cursor-wait">
              {submitText}
            </button>
          </form>

          {mode === 'reset' && <button type="button" onClick={() => switchMode('login')} className="mb-4 text-sm text-[#b04a5a] font-bold hover:underline">로그인 화면으로 돌아가기</button>}

          {mode !== 'reset' && <>
            <div className="relative" aria-hidden="true">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-100" /></div>
              <div className="relative flex justify-center text-xs"><span className="bg-white px-2 text-slate-400 font-bold">또는</span></div>
            </div>
            <button type="button" onClick={handleGoogleLogin} disabled={busy} className="w-full mt-4 py-3.5 bg-white border border-[#e9e4e6] rounded-2xl font-bold text-slate-700 hover:bg-slate-50 transition-all flex items-center justify-center gap-3 active:scale-[0.98] disabled:opacity-60">
              <GoogleMark />
              구글로 시작하기
            </button>
          </>}
        </div>

        <div className="px-2 pt-5 pb-6 text-center text-xs text-slate-500 font-medium space-y-2">
          <p>학부모님은 리포트 링크로 보시면 돼요</p>
          <button type="button" onClick={openTerms} className="text-slate-400">
            로그인하면 서비스 이용 안내에 동의한 것으로 봐요 · <span className="inline-flex items-center gap-0.5 font-bold text-[#b04a5a] hover:underline">안내 보기 <Info size={11} aria-hidden="true" /></span>
          </button>
        </div>

      </motion.div>
        <AnimatePresence>
          {showTerms && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-900/40 backdrop-blur-sm"
              onClick={(e) => { if (e.target === e.currentTarget) setShowTerms(false); }}
              onKeyDown={trapTab}
            >
              <motion.div
                ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="terms-title"
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="bg-white rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden relative"
              >
                <div className="p-8 pt-12">
                  <button type="button" onClick={() => setShowTerms(false)} aria-label="닫기" className="absolute top-6 right-6 p-2 text-slate-300 hover:text-slate-500 transition-colors">
                    <X size={20} aria-hidden="true" />
                  </button>

                  <div className="mb-8 text-center">
                    <div className="w-14 h-14 bg-[#fef2f3] rounded-2xl flex items-center justify-center mb-4 mx-auto text-[#b04a5a]">
                      <ShieldCheck size={28} aria-hidden="true" />
                    </div>
                    <h2 id="terms-title" className="text-xl font-black text-slate-900 tracking-tight">서비스 이용 안내</h2>
                  </div>

                  <ul className="space-y-4 text-left">
                    <li className="flex gap-3"><span className="mt-0.5 p-2 bg-[#fef2f3] text-[#b04a5a] rounded-lg h-fit"><Lock size={16} aria-hidden="true" /></span><span><b className="block text-sm font-bold text-slate-900">수집하는 정보</b><span className="text-xs text-slate-500 font-medium">이메일, 이름, 앱 이용 기록(출석·학습)</span></span></li>
                    <li className="flex gap-3"><span className="mt-0.5 p-2 bg-[#fef2f3] text-[#b04a5a] rounded-lg h-fit"><Users size={16} aria-hidden="true" /></span><span><b className="block text-sm font-bold text-slate-900">보는 사람</b><span className="text-xs text-slate-500 font-medium">담당 선생님과 학원 관리자만</span></span></li>
                    <li className="flex gap-3"><span className="mt-0.5 p-2 bg-[#fef2f3] text-[#b04a5a] rounded-lg h-fit"><MessageCircle size={16} aria-hidden="true" /></span><span><b className="block text-sm font-bold text-slate-900">문의·삭제</b><span className="text-xs text-slate-500 font-medium">학원에 요청해 주세요</span></span></li>
                  </ul>

                  <div className="mt-8">
                    <button type="button" autoFocus onClick={() => setShowTerms(false)} className="w-full py-4 bg-slate-900 text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-slate-800 transition-all active:scale-[0.98]">
                      확인했습니다
                    </button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
    </div>
  );
}
