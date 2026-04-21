import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Users, Calendar, ClipboardList, Plus, Search, MoreVertical, Phone, GraduationCap, Clock, MessageSquare, Trash2, Save, X, FileSpreadsheet, BookOpen, BarChart3, Sparkles, FileText } from 'lucide-react';
import { db, auth, handleFirestoreError, OperationType } from '../../lib/firebase';
import { collection, query, where, onSnapshot, addDoc, updateDoc, deleteDoc, doc, Timestamp, getDocs, writeBatch } from 'firebase/firestore';

import WordbookManager from './WordbookManager';
import StudentReportManager from './StudentReportManager';

interface StudentUser {
  uid: string;
  name: string;
  email: string;
  role: string;
  photoURL?: string;
  alias?: string;
  teacherNote?: string;
}

export default function TeacherRoom() {
  const [activeTab, setActiveTab] = useState<'students' | 'wordbook' | 'grammar' | 'reports'>('students');
  const [students, setStudents] = useState<StudentUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingAlias, setEditingAlias] = useState<string | null>(null);
  const [editingNote, setEditingNote] = useState<string | null>(null);
  const [aliasValue, setAliasValue] = useState('');
  const [noteValue, setNoteValue] = useState('');
  const [selectedStudentUid, setSelectedStudentUid] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [confirmDeleteUid, setConfirmDeleteUid] = useState<string | null>(null);

  useEffect(() => {
    if (!auth.currentUser) return;

    // Fetch all users (students and teachers)
    const q = query(collection(db, 'users'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const userData = snapshot.docs.map(doc => doc.data() as StudentUser);
      // Sort: Teacher first, then students by name/alias
      userData.sort((a, b) => {
        if (a.role === 'teacher') return -1;
        if (b.role === 'teacher') return 1;
        const nameA = a.alias || a.name;
        const nameB = b.alias || b.name;
        return nameA.localeCompare(nameB);
      });
      setStudents(userData);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'users');
    });

    return () => unsubscribe();
  }, []);

  const handleUpdateAlias = async (uid: string) => {
    try {
      await updateDoc(doc(db, 'users', uid), {
        alias: aliasValue.trim()
      });
      setEditingAlias(null);
    } catch (error) {
      console.error('Failed to update alias:', error);
      alert('이름 수정 중 오류가 발생했습니다.');
    }
  };

  const handleUpdateNote = async (uid: string) => {
    try {
      await updateDoc(doc(db, 'users', uid), {
        teacherNote: noteValue.trim()
      });
      setEditingNote(null);
    } catch (error) {
      console.error('Failed to update note:', error);
      alert('선생님 메모 수정 중 오류가 발생했습니다.');
    }
  };

  const handleDeleteStudent = async (uid: string) => {
    try {
      // Delete user document
      await deleteDoc(doc(db, 'users', uid));
      
      // Delete evaluation if exists
      await deleteDoc(doc(db, 'evaluations', uid));
      
      setConfirmDeleteUid(null);
    } catch (error) {
      console.error('Failed to withdraw student:', error);
      alert('탈퇴 처리 중 오류가 발생했습니다.');
    }
  };

  const navigateToReport = (uid: string) => {
    setSelectedStudentUid(uid);
    setActiveTab('reports');
  };

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-6 py-6 md:py-10">
      <header className="mb-8 md:mb-10 flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <h1 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight">선생님방</h1>
        </div>
        
        <div className="flex bg-white p-1.5 rounded-2xl shadow-sm border border-slate-100 w-full md:w-auto overflow-x-auto no-scrollbar">
          <TabButton active={activeTab === 'students'} onClick={() => setActiveTab('students')} icon={<Users size={18} />} label="수강생 관리" />
          <TabButton active={activeTab === 'wordbook'} onClick={() => setActiveTab('wordbook')} icon={<BookOpen size={18} />} label="단어장 관리" />
          <TabButton active={activeTab === 'grammar'} onClick={() => setActiveTab('grammar')} icon={<Sparkles size={18} />} label="문법 세트 관리" />
          <TabButton active={activeTab === 'reports'} onClick={() => setActiveTab('reports')} icon={<BarChart3 size={18} />} label="학습 리포트" />
        </div>
      </header>

      <main>
        <AnimatePresence mode="wait">
          {activeTab === 'students' && (
            <motion.div
              key="students"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <div className="flex justify-between items-center mb-6">
                <div className="relative w-72">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input
                    type="text"
                    placeholder="학습자 이름/메모 검색..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-2xl focus:ring-4 focus:ring-pastel-pink-100 outline-none transition-all text-sm font-medium"
                  />
                </div>
              </div>

              <div className="bg-white rounded-[2rem] md:rounded-[2.5rem] shadow-xl shadow-slate-200/50 border border-slate-100 overflow-x-auto no-scrollbar">
                <table className="w-full text-left min-w-[800px]">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      <th className="px-8 py-5 text-xs font-black text-slate-400 uppercase tracking-widest">계정 정보</th>
                      <th className="px-8 py-5 text-xs font-black text-slate-400 uppercase tracking-widest">학습자 이름</th>
                      <th className="px-8 py-5 text-xs font-black text-slate-400 uppercase tracking-widest">선생님 메모</th>
                      <th className="px-8 py-5 text-xs font-black text-slate-400 uppercase tracking-widest">이메일</th>
                      <th className="px-8 py-5 text-xs font-black text-slate-400 uppercase tracking-widest">구분</th>
                      <th className="px-8 py-5 text-xs font-black text-slate-400 uppercase tracking-widest">관리</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {students
                      .filter(s => 
                        s.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                        (s.alias && s.alias.toLowerCase().includes(searchQuery.toLowerCase())) ||
                        (s.teacherNote && s.teacherNote.toLowerCase().includes(searchQuery.toLowerCase())) ||
                        s.email.toLowerCase().includes(searchQuery.toLowerCase())
                      )
                      .map((student) => (
                      <tr key={student.uid} className="hover:bg-slate-50/50 transition-colors group">
                        <td className="px-8 py-5">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-pastel-pink-100 rounded-xl flex items-center justify-center text-pastel-pink-600 font-black overflow-hidden">
                              {student.photoURL && student.photoURL.startsWith('http') ? (
                                <img src={student.photoURL} alt={student.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                              ) : (
                                <span className="text-xl">{student.photoURL || student.name[0]}</span>
                              )}
                            </div>
                            <div>
                              <button 
                                onClick={() => navigateToReport(student.uid)}
                                className="font-bold text-slate-900 hover:text-pastel-pink-500 transition-colors text-left"
                              >
                                {student.name}
                              </button>
                              <div className="text-xs text-slate-400 font-medium">UID: {student.uid.slice(0, 8)}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-8 py-5">
                          {editingAlias === student.uid ? (
                            <div className="flex items-center gap-2">
                              <input
                                type="text"
                                value={aliasValue}
                                onChange={(e) => setAliasValue(e.target.value)}
                                className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm font-bold outline-none focus:ring-2 focus:ring-pastel-pink-200 w-32"
                                autoFocus
                              />
                              <button 
                                onClick={() => handleUpdateAlias(student.uid)}
                                className="p-1.5 bg-pastel-pink-500 text-white rounded-lg hover:bg-pastel-pink-600 transition-colors"
                              >
                                <Save size={14} />
                              </button>
                              <button 
                                onClick={() => setEditingAlias(null)}
                                className="p-1.5 bg-slate-100 text-slate-400 rounded-lg hover:bg-slate-200 transition-colors"
                              >
                                <X size={14} />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <span className={`text-sm font-black ${student.alias ? 'text-slate-900' : 'text-slate-300 italic'}`}>
                                {student.alias || '이름 미설정'}
                              </span>
                              <button 
                                onClick={() => {
                                  setEditingAlias(student.uid);
                                  setAliasValue(student.alias || '');
                                }}
                                className="p-1 text-slate-300 hover:text-pastel-pink-500 transition-colors opacity-0 group-hover:opacity-100"
                              >
                                <MessageSquare size={14} />
                              </button>
                            </div>
                          )}
                        </td>
                        <td className="px-8 py-5">
                          {editingNote === student.uid ? (
                            <div className="flex items-center gap-2">
                              <input
                                type="text"
                                value={noteValue}
                                onChange={(e) => setNoteValue(e.target.value)}
                                placeholder="메모 입력..."
                                className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium outline-none focus:ring-2 focus:ring-pastel-pink-200 w-40"
                                autoFocus
                              />
                              <button 
                                onClick={() => handleUpdateNote(student.uid)}
                                className="p-1.5 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors"
                              >
                                <Save size={12} />
                              </button>
                              <button 
                                onClick={() => setEditingNote(null)}
                                className="p-1.5 bg-slate-100 text-slate-400 rounded-lg hover:bg-slate-200 transition-colors"
                              >
                                <X size={12} />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <span className={`text-xs font-medium ${student.teacherNote ? 'text-slate-600' : 'text-slate-300 italic'}`}>
                                {student.teacherNote || '메모 없음'}
                              </span>
                              <button 
                                onClick={() => {
                                  setEditingNote(student.uid);
                                  setNoteValue(student.teacherNote || '');
                                }}
                                className="p-1 text-slate-300 hover:text-slate-500 transition-colors opacity-0 group-hover:opacity-100"
                              >
                                <FileText size={14} />
                              </button>
                            </div>
                          )}
                        </td>
                        <td className="px-8 py-5">
                          <span className="text-sm font-medium text-slate-500">{student.email}</span>
                        </td>
                        <td className="px-8 py-5">
                          <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                            student.role === 'teacher' ? 'bg-indigo-100 text-indigo-600' : 'bg-emerald-100 text-emerald-600'
                          }`}>
                            {student.role === 'teacher' ? '선생님' : '수강생'}
                          </span>
                        </td>
                        <td className="px-8 py-5">
                          <div className="flex items-center gap-2">
                            <button 
                              onClick={() => navigateToReport(student.uid)}
                              className="p-2 text-slate-300 hover:text-blue-500 transition-colors"
                              title="리포트 보기"
                            >
                              <BarChart3 size={18} />
                            </button>
                            {student.role !== 'teacher' && (
                              confirmDeleteUid === student.uid ? (
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() => handleDeleteStudent(student.uid)}
                                    className="px-2 py-1 bg-red-500 text-white text-[10px] font-black rounded-md"
                                  >
                                    확인
                                  </button>
                                  <button
                                    onClick={() => setConfirmDeleteUid(null)}
                                    className="px-2 py-1 bg-slate-200 text-slate-500 text-[10px] font-black rounded-md"
                                  >
                                    취소
                                  </button>
                                </div>
                              ) : (
                                <button 
                                  onClick={() => setConfirmDeleteUid(student.uid)}
                                  className="p-2 text-slate-300 hover:text-red-500 transition-colors"
                                  title="학생 삭제"
                                >
                                  <Trash2 size={18} />
                                </button>
                              )
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {students.length === 0 && !loading && (
                      <tr>
                        <td colSpan={5} className="px-8 py-20 text-center">
                          <div className="flex flex-col items-center gap-4">
                            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center">
                              <Users className="text-slate-200" size={32} />
                            </div>
                            <p className="text-slate-400 font-medium">등록된 학생이 없습니다.</p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}

          {activeTab === 'wordbook' && (
            <motion.div
              key="wordbook"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <WordbookManager category="word" />
            </motion.div>
          )}

          {activeTab === 'grammar' && (
            <motion.div
              key="grammar"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <WordbookManager category="grammar" />
            </motion.div>
          )}

          {activeTab === 'reports' && (
            <motion.div
              key="reports"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <StudentReportManager initialStudentUid={selectedStudentUid} />
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

function TabButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 md:px-6 py-2.5 md:py-3 rounded-xl font-bold text-xs md:text-sm transition-all whitespace-nowrap flex-1 md:flex-none justify-center ${
        active 
          ? 'bg-pastel-pink-500 text-white shadow-lg shadow-pastel-pink-200' 
          : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'
      }`}
    >
      {icon}
      <span className="whitespace-nowrap">{label}</span>
    </button>
  );
}
