import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, LogIn, X, Info, ShieldCheck, CalendarCheck, Lock, Mail, User as UserIcon, UserPlus } from 'lucide-react';
import { signIn, signUpWithEmail, signInWithEmail, resetPassword } from '../../lib/firebase';

export default function Login() {
  const [showTerms, setShowTerms] = useState(false);
  const [mode, setMode] = useState<'login' | 'signup' | 'reset'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | React.ReactNode>('');
  const [success, setSuccess] = useState('');

  const handleGoogleLogin = async () => {
    try {
      setError('');
      const isKakaoTalk = /KAKAOTALK/i.test(navigator.userAgent);
      if (isKakaoTalk) {
        setError('카카오톡 인앱 브라우저에서는 구글 로그인이 제한될 수 있습니다. 상단 혹은 하단의 메뉴를 통해 "다른 브라우저로 열기"를 선택하시거나, 이메일/비밀번호 로그인을 이용해 주세요.');
        return;
      }
      await signIn();
    } catch (error: any) {
      console.error('Login failed:', error);
      
      if (error?.code === 'auth/popup-blocked') {
        setError('브라우저의 팝업 차단이 설정되어 있습니다. 팝업을 허용해 주시거나, 화면을 길게 눌러 "새 탭에서 열기"를 이용해 보세요.');
      } else if (error?.code === 'auth/popup-closed-by-user') {
        setError('로그인 창이 닫혔습니다. 다시 시도해 주세요.');
      } else if (error?.code === 'auth/cancelled-popup-request') {
        // Ignore duplicate requests
      } else if (error?.code === 'auth/network-request-failed') {
        setError('네트워크 연결이 원활하지 않습니다. 인터넷 연결을 확인해 주세요.');
      } else if (error?.code === 'auth/unauthorized-domain') {
        setError(
          <div className="flex flex-col gap-2 items-center">
            <span className="text-red-600">승인되지 않은 도메인입니다.</span>
            <span className="text-[10px] text-slate-500 text-center leading-normal">
              Firebase 콘솔 &gt; Authentication &gt; Settings 에서<br />
              아래 도메인을 '승인된 도메인'에 추가해야 합니다:
            </span>
            <div className="flex items-center gap-2 w-full mt-1">
              <code className="flex-1 text-[10px] font-mono bg-slate-100 p-2 rounded-lg border border-slate-200 select-all break-all">
                {window.location.hostname}
              </code>
            </div>
          </div> as any
        );
      } else if (error?.code === 'auth/internal-error' || error?.message?.includes('cross-origin') || error?.message?.includes('storage-access')) {
        setError(
          <div className="flex flex-col gap-2 items-center">
            <span>브라우저 보안 설정으로 인해 로그인이 차단되었습니다.</span>
            <span className="text-[10px] text-slate-500 text-center">사파리나 크롬의 '크로스 사이트 추적 방지' 설정 때문일 수 있습니다. 다른 브라우저를 사용하거나 아래 버튼을 눌러 새 창에서 시도해 주세요.</span>
            <button 
              onClick={() => window.open(window.location.href, '_blank')}
              className="text-[11px] underline underline-offset-2 text-pastel-pink-600 hover:text-pastel-pink-700 font-bold"
            >
              새 창에서 로그인하기 ↗
            </button>
          </div> as any
        );
      } else {
        setError(
          <div className="flex flex-col gap-2 items-center">
            <span>구글 로그인 중 오류가 발생했습니다.</span>
            <button 
              onClick={() => window.open(window.location.href, '_blank')}
              className="text-[11px] underline underline-offset-2 text-pastel-pink-600 hover:text-pastel-pink-700 font-bold"
            >
              로그인이 안 되나요? 새 창에서 열기 ↗
            </button>
          </div> as any
        );
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (mode === 'reset') {
      try {
        await resetPassword(email);
        setSuccess('비밀번호 재설정 이메일을 보냈습니다. 이메일함을 확인해 주세요.');
      } catch (error: any) {
        if (error.code === 'auth/user-not-found') {
          setError('해당 이메일로 가입된 계정을 찾을 수 없습니다.');
        } else if (error.code === 'auth/invalid-email') {
          setError('유효하지 않은 이메일 형식입니다.');
        } else {
          setError('이메일 전송 중 오류가 발생했습니다.');
        }
      }
      return;
    }

    if (mode === 'signup' && password !== confirmPassword) {
      setError('비밀번호가 일치하지 않습니다.');
      return;
    }

    try {
      if (mode === 'signup') {
        try {
          await signUpWithEmail(email, password);
        } catch (signupError: any) {
          if (signupError.code === 'auth/email-already-in-use') {
            // Attempt to "Login" with the same credentials to see if it's a re-activation
            try {
              await signInWithEmail(email, password);
              // If successful, onAuthStateChanged in App.tsx will handle the rest
              return;
            } catch (signInError: any) {
              // If login fails, then they definitely have an account and gave the wrong password
              setError('이미 가입된 이메일입니다. 이전에 가입하셨다면 로그인 버튼을 누르거나 비밀번호를 다시 확인해 주세요.');
              return;
            }
          }
          throw signupError;
        }
      } else {
        await signInWithEmail(email, password);
      }
    } catch (error: any) {
      // Only log unexpected auth errors
      const expectedCodes = [
        'auth/email-already-in-use',
        'auth/weak-password',
        'auth/invalid-email',
        'auth/user-not-found',
        'auth/wrong-password',
        'auth/invalid-credential'
      ];
      
      if (!expectedCodes.includes(error.code)) {
        console.error('Auth failed:', error);
      }

      if (error.code === 'auth/email-already-in-use') {
        setError('이미 등록된 이메일입니다. 로그인하시거나 다른 이메일을 사용해 주세요.');
      } else if (error.code === 'auth/weak-password') {
        setError('비밀번호가 너무 취약합니다. 6자 이상으로 설정해 주세요.');
      } else if (error.code === 'auth/invalid-email') {
        setError('유효하지 않은 이메일 형식입니다.');
      } else if (
        error.code === 'auth/user-not-found' || 
        error.code === 'auth/wrong-password' ||
        error.code === 'auth/invalid-credential'
      ) {
        setError('이메일 또는 비밀번호가 일치하지 않습니다.');
      } else {
        setError(error.message || '인증 중 오류가 발생했습니다.');
      }
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#fafafa] p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-[420px] w-full bg-white p-7 md:p-12 rounded-[3.5rem] shadow-2xl shadow-pastel-pink-200/30 border border-pastel-pink-50 text-center flex flex-col justify-center min-h-[540px] md:min-h-0"
      >
        <div className="w-14 h-14 md:w-20 md:h-20 bg-pastel-pink-100 rounded-[1.8rem] md:rounded-3xl flex items-center justify-center mb-5 md:mb-8 mx-auto text-2xl md:text-4xl shadow-inner">
          {mode === 'login' ? '✒️' : '✒️'}
        </div>
        <h1 className="text-3xl md:text-4xl font-black text-slate-900 mb-3 md:mb-4 tracking-tight">
          지원T <span className="text-pastel-pink-500">English</span>
        </h1>
        <p className="text-slate-500 mb-8 md:mb-10 font-medium leading-relaxed text-sm md:text-base">
          {mode === 'login' ? '로그인하고 학습을 시작하세요!' : 
           mode === 'signup' ? '새 계정을 만들고 시작하세요!' : 
           '가입하신 이메일을 입력하면 재설정 링크를 보내드립니다.'}
        </p>

        <form onSubmit={handleSubmit} className="space-y-2.5 md:space-y-4 mb-4 md:mb-6">
          <div className="relative">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="email"
              placeholder="이메일"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full pl-11 pr-4 py-3.5 md:py-4 bg-slate-50 rounded-2xl border border-slate-100 outline-none focus:border-pastel-pink-300 font-medium text-slate-700 text-sm md:text-base"
              required
            />
          </div>
          
          {mode !== 'reset' && (
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type="password"
                placeholder="비밀번호"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-11 pr-4 py-3.5 md:py-4 bg-slate-50 rounded-2xl border border-slate-100 outline-none focus:border-pastel-pink-300 font-medium text-slate-700 text-sm md:text-base"
                required={mode !== 'reset'}
              />
            </div>
          )}

          <AnimatePresence>
            {mode === 'signup' && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="relative overflow-hidden"
              >
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  type="password"
                  placeholder="비밀번호 확인"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full pl-11 pr-4 py-3.5 md:py-4 bg-slate-50 rounded-2xl border border-slate-100 outline-none focus:border-pastel-pink-300 font-medium text-slate-700 text-sm md:text-base"
                  required={mode === 'signup'}
                />
              </motion.div>
            )}
          </AnimatePresence>

          {error && <p className="text-sm text-red-500 font-bold">{error}</p>}
          {success && <p className="text-sm text-emerald-500 font-bold">{success}</p>}

          <button
            type="submit"
            className="w-full py-4 md:py-5 bg-pastel-pink-500 text-white rounded-2xl font-bold hover:bg-pastel-pink-600 transition-all flex items-center justify-center gap-3 shadow-lg shadow-pastel-pink-100 active:scale-[0.98]"
          >
            {mode === 'login' ? '로그인하기' : mode === 'signup' ? '가입하기' : '재설정 메일 보내기'}
          </button>
        </form>

        {mode === 'login' && (
          <button
            onClick={() => {
              setMode('reset');
              setError('');
              setSuccess('');
            }}
            className="mb-6 text-sm text-slate-400 hover:text-pastel-pink-500 font-medium"
          >
            비밀번호를 잊으셨나요?
          </button>
        )}

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-100" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-white px-2 text-slate-400 font-bold">또는</span>
          </div>
        </div>
        
        <button
          onClick={handleGoogleLogin}
          className="w-full mt-5 md:mt-6 py-4 md:py-5 bg-white border-2 border-slate-100 rounded-2xl font-bold text-slate-700 hover:bg-slate-50 hover:border-pastel-pink-200 transition-all flex items-center justify-center gap-3 shadow-sm active:scale-[0.98]"
        >
          <span className="text-xl">🗝️</span>
          구글로 시작하기
        </button>

        <button
          onClick={() => {
            if (mode === 'reset') {
              setMode('login');
            } else {
              setMode(mode === 'login' ? 'signup' : 'login');
            }
            setConfirmPassword('');
            setError('');
            setSuccess('');
          }}
          className="mt-4 md:mt-6 text-sm text-pastel-pink-500 font-bold hover:underline"
        >
          {mode === 'login' ? '계정이 없으신가요? 가입하기' : 
           mode === 'signup' ? '이미 계정이 있으신가요? 로그인하기' : 
           '로그인 화면으로 돌아가기'}
        </button>
        
        <button
          onClick={() => setShowTerms(true)}
          className="mt-8 text-xs text-slate-400 font-medium hover:text-pastel-pink-500 transition-colors flex flex-col items-center gap-1 group mx-auto"
        >
          <span>로그인 시 이메일과 이름만이 안전하게 보관됩니다.</span>
          <span className="text-[10px] opacity-70 group-hover:opacity-100 flex items-center gap-0.5">
            자세히 보기 <Info size={10} />
          </span>
        </button>

        <AnimatePresence>
          {showTerms && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-900/40 backdrop-blur-sm"
              onClick={(e) => {
                if (e.target === e.currentTarget) setShowTerms(false);
              }}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="bg-white rounded-[2.5rem] w-full max-w-sm shadow-2xl overflow-hidden relative"
              >
                <div className="p-8 pt-12">
                  <button 
                    onClick={() => setShowTerms(false)}
                    className="absolute top-6 right-6 p-2 text-slate-300 hover:text-slate-500 transition-colors"
                  >
                    <X size={20} />
                  </button>

                  <div className="mb-8 text-center">
                    <div className="w-14 h-14 bg-pastel-pink-50 rounded-2xl flex items-center justify-center mb-4 mx-auto text-pastel-pink-500">
                      <ShieldCheck size={28} />
                    </div>
                    <h2 className="text-xl font-black text-slate-900 tracking-tight">서비스 이용 안내</h2>
                  </div>

                  <div className="space-y-6">
                    <div className="flex gap-4">
                      <div className="mt-1 p-2 bg-blue-50 text-blue-500 rounded-lg h-fit">
                        <Lock size={16} />
                      </div>
                      <div className="flex-1 text-justify">
                        <h3 className="text-sm font-bold text-slate-900 mb-1">개인정보 보호 원칙</h3>
                        <p className="text-xs text-slate-500 leading-relaxed font-medium">
                          사용자의 식별을 위한 <span className="text-slate-900 font-bold">이메일 주소와 이름(닉네임)</span>만이 수집되며, 이는 보안 프로토콜에 따라 암호화되어 안전하게 보관됩니다.
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-4">
                      <div className="mt-1 p-2 bg-amber-50 text-amber-500 rounded-lg h-fit">
                        <LogIn size={16} />
                      </div>
                      <div className="flex-1 text-justify">
                        <h3 className="text-sm font-bold text-slate-900 mb-1">데이터 관리 권한</h3>
                        <p className="text-xs text-slate-500 leading-relaxed font-medium">
                          수집된 정보는 학습 피드백 및 지도를 위해 <span className="text-slate-900 font-bold">담당 선생님(관리자)</span>에 한해서만 시스템적으로 접근이 허용됩니다.
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-4">
                      <div className="mt-1 p-2 bg-green-50 text-green-500 rounded-lg h-fit">
                        <CalendarCheck size={16} />
                      </div>
                      <div className="flex-1 text-justify">
                        <h3 className="text-sm font-bold text-slate-900 mb-1">학습 이력 관리</h3>
                        <p className="text-xs text-slate-500 leading-relaxed font-medium">
                          성실한 학습 환경 조성을 위해 <span className="text-slate-900 font-bold">로그인 시 출석 기록</span>이 자동으로 생성되며, 이는 개인 학습 통계의 기반이 됩니다.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-10">
                    <button
                      onClick={() => setShowTerms(false)}
                      className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-slate-800 transition-all active:scale-[0.98]"
                    >
                      확인했습니다
                    </button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
