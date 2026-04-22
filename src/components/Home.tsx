import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { GraduationCap, Languages, BookOpen, History, BarChart3, FileText, Users, ArrowRight, X, Sparkles, Dog } from 'lucide-react';

interface HomeProps {
  onNavigate: (view: 'home' | 'analyzer' | 'generator' | 'vocab' | 'grammar' | 'vocab-mobile' | 'tutor' | 'report' | 'archive' | 'teacher-room') => void;
  userRole?: 'teacher' | 'student' | 'admin';
  hasNewAssignment?: boolean;
}

export default function Home({ onNavigate, userRole, hasNewAssignment }: HomeProps) {
  const menuItems = [
    {
      id: 'vocab',
      title: '단어 세트',
      description: '객관식, 플래시카드, 매치게임으로 단어장을 학습합니다.',
      icon: <BookOpen className="text-pastel-pink-500 w-4 h-4 md:w-8 md:h-8" />,
      color: 'bg-pastel-pink-50',
      borderColor: 'border-pastel-pink-100',
      textColor: 'text-pastel-pink-600',
      show: true
    },
    {
      id: 'grammar',
      title: '드릴 세트',
      description: '주요 문법 포인트를 학습합니다.',
      icon: <GraduationCap className="text-purple-500 w-4 h-4 md:w-8 md:h-8" />,
      color: 'bg-purple-50',
      borderColor: 'border-purple-100',
      textColor: 'text-purple-600',
      show: true
    },
    {
      id: 'analyzer',
      title: '지문 분석기',
      description: '영어 지문을 분석해 보세요.',
      icon: <Languages className="text-blue-500 w-4 h-4 md:w-8 md:h-8" />,
      color: 'bg-blue-50',
      borderColor: 'border-blue-100',
      textColor: 'text-blue-600',
      show: true
    },
    {
      id: 'generator',
      title: '문제 생성기',
      description: '다양한 유형의 변형 문제를 생성합니다.',
      icon: <Sparkles className="text-amber-500 w-4 h-4 md:w-8 md:h-8" />,
      color: 'bg-amber-50',
      borderColor: 'border-amber-100',
      textColor: 'text-amber-600',
      show: true
    },
    {
      id: 'pet',
      title: '펫 키우기',
      description: '학습으로 포인트를 모아 나만의 펫을 키워보세요.',
      icon: <Dog className="text-emerald-500 w-4 h-4 md:w-8 md:h-8" />,
      color: 'bg-emerald-50',
      borderColor: 'border-emerald-100',
      textColor: 'text-emerald-600',
      show: true
    }
  ];

  return (
    <div className="max-w-5xl mx-auto px-6 py-12">
      <header className="text-center mb-16">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="inline-flex items-center gap-2 px-4 py-2 bg-white rounded-full shadow-sm mb-6 border border-pastel-pink-100"
        >
          <span className="text-sm">🏫</span>
          <span className="text-sm font-bold text-pastel-pink-500 uppercase tracking-wider">
            지원T English
          </span>
        </motion.div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {menuItems.filter(item => item.show).map((item, index) => (
          <motion.button
            key={item.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            onClick={() => onNavigate(item.id as any)}
            className={`group p-6 md:p-8 rounded-[2.5rem] border-2 ${item.borderColor} ${item.color} hover:shadow-2xl hover:shadow-pastel-pink-200/30 transition-all duration-300 text-left flex flex-col h-full active:scale-[0.98]`}
          >
            <div className="mb-4 md:mb-6 p-2 md:p-4 bg-white rounded-2xl shadow-sm flex items-center gap-2 md:gap-4 group-hover:scale-105 transition-transform duration-300">
              <div className="flex-shrink-0">
                {item.icon}
              </div>
              <h3 className={`text-base md:text-xl font-black ${item.textColor} flex items-center gap-2`}>
                {item.title}
              </h3>
            </div>
            <p className="text-sm md:text-base text-slate-600 font-medium leading-relaxed">
              {item.description}
            </p>
            <div className="mt-auto pt-6 flex items-center gap-2 text-sm font-bold opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              <span>바로가기</span>
              <div className="w-5 h-5 rounded-full bg-white flex items-center justify-center">
                <ArrowRight size={12} className={item.textColor} />
              </div>
            </div>
          </motion.button>
        ))}
      </div>

      <footer className="mt-24 text-center border-t border-slate-100 pt-12">
        <p className="text-slate-400 text-sm font-medium">
          © 2026 지원T English. All rights reserved.
        </p>
        <p className="text-slate-400 text-sm font-medium mt-2">
          ✉️ lizywon@naver.com
        </p>
      </footer>
    </div>
  );
}
