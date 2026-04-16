import React from 'react';
import { motion } from 'motion/react';
import { Sparkles, LogIn } from 'lucide-react';
import { signIn } from '../../lib/firebase';

export default function Login() {
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
        
        <p className="mt-8 text-xs text-slate-400 font-medium">
          로그인 시 서비스 이용약관 및 개인정보 처리방침에 동의하게 됩니다.
        </p>
      </motion.div>
    </div>
  );
}
