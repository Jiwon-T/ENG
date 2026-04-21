import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, LogIn, X, Info, ShieldCheck, CalendarCheck, Lock } from 'lucide-react';
import { signIn } from '../../lib/firebase';

export default function Login() {
  const [showTerms, setShowTerms] = useState(false);

  const handleLogin = async () => {
    try {
      await signIn();
    } catch (error) {
      console.error('Login failed:', error);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#fafafa] p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-white p-10 rounded-[3rem] shadow-2xl shadow-pastel-pink-200/30 border border-pastel-pink-50 text-center"
      >
        <div className="w-20 h-20 bg-pastel-pink-100 rounded-3xl flex items-center justify-center mb-8 mx-auto text-4xl">
          ✒️
        </div>
        <h1 className="text-4xl font-black text-slate-900 mb-4 tracking-tight">
          지원T <span className="text-pastel-pink-500">English</span>
        </h1>
        <p className="text-slate-500 mb-10 font-medium leading-relaxed">
          로그인하고 학습을 시작하세요!
        </p>
        
        <button
          onClick={handleLogin}
          className="w-full py-5 bg-white border-2 border-slate-100 rounded-2xl font-bold text-slate-700 hover:bg-slate-50 hover:border-pastel-pink-200 transition-all flex items-center justify-center gap-3 shadow-sm active:scale-[0.98]"
        >
          <span className="text-xl">🗝️</span>
          구글로 시작하기
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
