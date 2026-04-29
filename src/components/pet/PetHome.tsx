import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Heart, Star, ShoppingBag, MessageCircle, Ruler, Shirt, ChevronLeft, RefreshCcw, Sparkles, Trophy, CheckCircle2, Pencil, Check, X } from 'lucide-react';
import { PetService, PetSystemState, PetCharacterType, PetData, getKSTDateString } from '../../lib/petService';
import { PetCharacter } from './PetCharacters';
import confetti from 'canvas-confetti';
import { auth } from '../../lib/firebase';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';

const CHARACTER_OPTIONS: { id: PetCharacterType, name: string }[] = [
  { id: 'kuromi', name: '다롱' },
  { id: 'mymelody', name: '아롱' },
  { id: 'cinnamoroll', name: '나몽' },
  { id: 'molang', name: '말랑' },
  { id: 'mang_bear', name: '고미' }
];

const SHOP_ITEMS = {
  outfits: [
    { id: 'uniform', name: '교복', price: 150, icon: '👔', category: 'clothing' },
    { id: 'muji_cape', name: '무지개 망토', price: 120, icon: '🌈', category: 'clothing' }
  ],
  accessories: [
    { id: 'pink_ribbon', name: '리본', price: 50, icon: '🎀', category: 'accessory' },
    { id: 'star_hat', name: '별핀', price: 80, icon: '⭐', category: 'accessory' },
    { id: 'crown', name: '왕관', price: 200, icon: '👑', category: 'accessory' },
    { id: 'sunglasses', name: '선글라스', price: 100, icon: '😎', category: 'accessory' },
    { id: 'flower', name: '꽃핀', price: 60, icon: '🌸', category: 'accessory' }
  ],
  consumables: [
    { id: 'cookie', name: '쿠키', price: 30, xp: 5, icon: '🍪', category: 'consumable' },
    { id: 'cake', name: '딸기케이크', price: 60, xp: 15, icon: '🍰', category: 'consumable' },
    { id: 'candy', name: '별사탕', price: 100, xp: 30, icon: '🍬', category: 'consumable' },
    { id: 'macaron', name: '마카롱', price: 50, xp: 10, icon: '🍭', category: 'consumable' },
    { id: 'coffee', name: '커피', price: 40, energy: 30, icon: '☕', category: 'consumable' },
    { id: 'energy_drink', name: '에너지드링크', price: 70, energy: 60, icon: '⚡', category: 'consumable' }
  ],
  backgrounds: [
    { id: 'default', name: '기본 보금자리', price: 0, icon: '🏠', category: 'background' },
    { id: 'pink_cushion', name: '핑크 쿠션', price: 80, icon: '🛋️', category: 'background' },
    { id: 'bed', name: '작은 침대', price: 150, icon: '🛏️', category: 'background' },
    { id: 'star_room', name: '별빛 방', price: 300, icon: '✨', category: 'background' },
    { id: 'desk', name: '미니 책상', price: 200, icon: '📝', category: 'background' }
  ]
};

export default function PetHome({ onBack }: { onBack: () => void }) {
  const [state, setState] = useState<PetSystemState | null>(null);
  const [showSelector, setShowSelector] = useState(false);
  const [activeTab, setActiveTab] = useState<'main' | 'shop' | 'outfit' | 'teach' | 'snacks'>('main');
  const [hearts, setHearts] = useState<{ id: number, x: number, y: number }[]>([]);
  const [teachInput, setTeachInput] = useState('');
  const [teachFeedback, setTeachFeedback] = useState<string | null>(null);
  const [isEditingName, setIsEditingName] = useState(false);
  const [newName, setNewName] = useState('');
  const [currentSpeech, setCurrentSpeech] = useState('');
  const [isTeaching, setIsTeaching] = useState(false);
  const interactionRef = React.useRef<HTMLDivElement>(null);
  const petViewRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (activeTab !== 'main' && window.innerWidth < 1024) {
      interactionRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [activeTab]);

  const [user, setUser] = useState<FirebaseUser | null>(null); // Add user state
  // ... existing states ...
  useEffect(() => {
    onAuthStateChanged(auth, (firebaseUser) => setUser(firebaseUser));
  }, []);

  // Daily Reset Real-time Check
  useEffect(() => {
    if (!user || !state) return;

    const interval = setInterval(() => {
      const today = getKSTDateString();
      if (state.lastResetDate !== today) {
        const newState = PetService.getState(user.uid);
        setState({ ...newState });
      }
    }, 30000); // Check every 30 seconds

    return () => clearInterval(interval);
  }, [user, state?.lastResetDate]);

  useEffect(() => {
    if (!user) return;
    
    const initializePetState = async () => {
      // 1. Get current state from local storage (or initial)
      let currentLocalState = PetService.getState(user.uid);
      
      try {
        // 2. Fetch latest profile from Firestore to sync progress
        const { doc, getDoc } = await import('firebase/firestore');
        const { db } = await import('../../lib/firebase');
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        
        if (userDoc.exists()) {
          const profileData = userDoc.data();
          // 3. Sync local state with firestore profile (restores points/level if needed)
          currentLocalState = await PetService.syncFromProfile(user.uid, profileData);
        }
      } catch (e) {
        console.error('Failed to sync pet state from profile:', e);
      }

      // If first pet is initial placeholder, show selector
      if (currentLocalState.pets[0].name === '친구가 필요해요') {
        setShowSelector(true);
      }
      setState(currentLocalState);
    };

    initializePetState();
  }, [user]);

  // Need to update actions too.

  const currentPet = state?.pets.find(p => p.slot === state.currentPetSlot);

  useEffect(() => {
    if (currentPet && !currentSpeech) {
      setCurrentSpeech(getPetSpeech());
    }
  }, [currentPet, currentSpeech]);

  // Handle Monologues
  useEffect(() => {
    if (!currentPet || currentPet.learnedPhrases.length === 0 || !user) return;

    const triggerMonologue = async () => {
      // Don't interrupt teaching or special feedback
      if (teachFeedback || isTeaching) return;

      const phrases = currentPet.learnedPhrases;
      const phrase = phrases[Math.floor(Math.random() * phrases.length)];
      const levelKey = Math.floor(currentPet.level / 10) * 10;
      
      let message = phrase.evolvedVersions[levelKey];
      if (!message) {
        try {
          message = await PetService.generateEvolvedVersion(phrase.remembered, currentPet.level);
          // Save back to sync
          const latestState = PetService.getState(user.uid);
          const p = latestState.pets.find(x => x.slot === latestState.currentPetSlot);
          const lp = p?.learnedPhrases.find(x => x.original === phrase.original);
          if (lp) {
            lp.evolvedVersions[levelKey] = message;
            PetService.saveState(latestState, user.uid);
            setState(latestState);
          }
        } catch (e) {
          return;
        }
      }

      setCurrentSpeech(message);
      // Back to default after 6 seconds
      setTimeout(() => {
        setCurrentSpeech(getPetSpeech());
      }, 6000);
    };

    const interval = setInterval(triggerMonologue, Math.random() * 30000 + 30000); // 30-60s
    return () => clearInterval(interval);
  }, [currentPet?.slot, currentPet?.learnedPhrases.length, teachFeedback, isTeaching, user]);

  const handleRename = () => {
    if (!newName.trim() || !user || !currentPet) {
      setIsEditingName(false);
      return;
    }
    const newState = PetService.renamePet(newName.trim(), user.uid);
    setState(newState);
    setIsEditingName(false);
    
    // 펫의 반응 설정 (나이에 따른 반응)
    const stage = PetService.getStage(currentPet.level);
    let reaction = '';
    switch (stage) {
      case 'baby': reaction = '냐!'; break;
      case 'child': reaction = `${newName.trim()}! 우와, 고마워!`; break;
      case 'teen': reaction = `${newName.trim()}? 특이한데? 완전 마음에 들어!`; break;
      case 'adult': reaction = `좋은 이름이네. ${newName.trim()}(으)로 우리 잘 지내보자!`; break;
      case 'master': reaction = `우와, ${newName.trim()}? 멋진 이름을 지어줘서 고마워!`; break;
    }
    setCurrentSpeech(reaction);
    // 6초 후 기본 대사로 복귀
    setTimeout(() => setCurrentSpeech(getPetSpeech()), 6000);
  };

  const startEditing = () => {
    setNewName(currentPet?.name || '');
    setIsEditingName(true);
  };

  const triggerLevelUp = () => {
    confetti({
      particleCount: 150,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#FF80AB', '#FFB2CC', '#B3E5FC', '#FFD54F']
    });
  };

  const handleSelectCharacter = (char: PetCharacterType) => {
    if (!user) return;
    const newState = { ...state! };
    const pet = newState.pets.find(p => p.slot === newState.currentPetSlot)!;
    pet.character = char;
    pet.name = CHARACTER_OPTIONS.find(c => c.id === char)?.name || char;
    PetService.saveState(newState, user.uid);
    setState(newState);
    setShowSelector(false);
  };

  const handlePetAction = (e: React.MouseEvent) => {
    if (!state || !user) return;
    const result = PetService.petPet(user.uid);
    
    if (!result.success) {
      setTeachFeedback(result.message || '체력이 부족해요!');
      setTimeout(() => setTeachFeedback(null), 2000);
      return;
    }

    const { xpGain, newState } = result;
    const oldLevel = currentPet?.level || 1;
    const newLevel = newState.pets.find(p => p.slot === newState.currentPetSlot)?.level || 1;
    
    if (newLevel > oldLevel) {
      triggerLevelUp();
    }
    
    setState(newState);
    
    // Add heart effect
    const newHeart = { id: Date.now(), x: e.clientX, y: e.clientY };
    setHearts(prev => [...prev, newHeart]);
    setTimeout(() => {
      setHearts(prev => prev.filter(h => h.id !== newHeart.id));
    }, 1000);
  };

  const handlePurchase = (item: any, category: any) => {
    if (!user) return;
    const oldLevel = currentPet?.level || 1;
    const { success, newState, message } = PetService.purchaseItem(item.id, item.price, category, user.uid);
    if (success) {
      const newLevel = newState.pets.find(p => p.slot === newState.currentPetSlot)?.level || 1;
      if (newLevel > oldLevel) triggerLevelUp();
      setState(newState);
    } else {
      alert(message);
    }
  };

  const handleTeach = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teachInput.trim() || !currentPet || isTeaching || !user) return;
    
    setIsTeaching(true);
    setTeachFeedback(`"${teachInput}" (배우는 중...)`);
    
    // Scroll back to pet on mobile
    if (window.innerWidth < 1024) {
      petViewRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
    
    const result = await PetService.handleTeachWord(teachInput, user.uid);
    
    if (!result.success) {
      setTeachFeedback(result.message || '너무 지쳤나봐요.');
      setTimeout(() => {
        setTeachFeedback(null);
        setIsTeaching(false);
      }, 3000);
      return;
    }

    const oldLevel = currentPet.level;
    const newLevel = result.newState.pets.find(p => p.slot === result.newState.currentPetSlot)?.level || 1;
    
    if (newLevel > oldLevel) {
      triggerLevelUp();
      if (newLevel % 10 === 0) {
        setTeachFeedback(`📚 ${currentPet.name}이(가) 배운 말이 더 성숙해졌어요!`);
        setTimeout(() => setTeachFeedback(null), 3000);
      }
    }

    setState(result.newState);
    setTeachInput('');
    setCurrentSpeech(result.reaction);
    setTeachFeedback(`말을 배웠어요! ✨`);
    
    setTimeout(() => {
      setTeachFeedback(null);
      setIsTeaching(false);
    }, 2000);
  };

  const getPetSpeech = () => {
    if (!currentPet) return '';
    const lv = currentPet.level;
    if (lv <= 10) return ['...', '음냐', '냐~'][Math.floor(Math.random() * 3)];
    if (lv <= 30) return ['안녕', '배고파', '놀자'][Math.floor(Math.random() * 3)];
    if (lv <= 50) return ['오늘도 공부했어?', '간식 줘!'][Math.floor(Math.random() * 2)];
    if (lv <= 80) return ['오늘 열심히 했으니까 간식 하나만 더 줘~'];
    if (lv <= 99) return ['Good job today! 나 칭찬해줘'];
    return "오늘도 열심히 공부했네! I'm so proud of you 🎉";
  };

  if (!state || !currentPet) return null;

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-6 flex flex-col items-center">
      <AnimatePresence>
        {showSelector && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-6"
          >
            <motion.div 
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              className="bg-white rounded-[2.5rem] sm:rounded-[3rem] p-6 sm:p-10 max-w-2xl w-full text-center shadow-2xl"
            >
              <h2 className="text-2xl sm:text-3xl font-black text-slate-900 mb-2">친구를 선택해주세요!</h2>
              <p className="text-slate-500 font-medium mb-6 sm:mb-10 text-base sm:text-lg">어떤 친구와 함께 공부할까요?</p>
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                {CHARACTER_OPTIONS.map(char => (
                  <button
                    key={char.id}
                    onClick={() => handleSelectCharacter(char.id)}
                    className="p-4 sm:p-6 bg-slate-50 rounded-2xl sm:rounded-3xl hover:bg-pastel-pink-50 hover:scale-105 transition-all group border-2 border-transparent hover:border-pastel-pink-200"
                  >
                    <div className="flex justify-center mb-3 sm:mb-4">
                       <PetCharacter character={char.id} stage="adult" />
                    </div>
                    <span className="text-sm sm:text-base font-black text-slate-700 group-hover:text-pastel-pink-600">{char.name}</span>
                  </button>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="max-w-4xl w-full">
         <header className="flex justify-between items-center mb-6 sm:mb-8 no-print">
            <button onClick={onBack} className="p-2 sm:p-3 bg-white rounded-2xl border border-slate-100 shadow-sm hover:bg-slate-50 transition-all">
              <ChevronLeft size={20} className="sm:size-[24px] text-slate-500" />
            </button>
            <div className="flex items-center gap-2 sm:gap-3 bg-white px-4 sm:px-6 py-2 sm:py-3 rounded-2xl shadow-sm border border-slate-100">
               <div className="w-8 h-8 sm:w-10 sm:h-10 bg-amber-100 rounded-xl flex items-center justify-center text-lg sm:text-xl">💰</div>
               <div>
                  <div className="text-[8px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">보유 포인트</div>
                  <div className="text-lg sm:text-xl font-black text-slate-900 leading-none">{state.points}P</div>
               </div>
            </div>
         </header>

         <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 flex flex-col">
               <div ref={petViewRef} className={`relative flex-1 min-h-[250px] sm:min-h-[300px] md:min-h-[400px] aspect-square md:aspect-video rounded-[2.5rem] sm:rounded-[3rem] border-4 border-white shadow-2xl overflow-hidden flex items-center justify-center group ${
                 state.background === 'star_room' ? 'bg-gradient-to-br from-indigo-900 via-purple-900 to-slate-900' :
                 state.background === 'bed' ? 'bg-blue-50' :
                 state.background === 'pink_cushion' ? 'bg-rose-50' :
                 'bg-gradient-to-br from-slate-100 to-white'
               }`}>
                  {/* Decorative Elements */}
                  {state.background === 'star_room' && (
                    <div className="absolute inset-0 overflow-hidden">
                       {[...Array(20)].map((_, i) => (
                         <div 
                           key={i} 
                           className="absolute rounded-full bg-white animate-pulse"
                           style={{ 
                             width: Math.random() * 3, 
                             height: Math.random() * 3, 
                             top: `${Math.random() * 100}%`, 
                             left: `${Math.random() * 100}%`,
                             animationDelay: `${Math.random() * 5}s`
                           }} 
                         />
                       ))}
                    </div>
                  )}

                  {/* Character Space */}
                  <motion.div 
                    whileHover={{ scale: 1.05 }}
                    onClick={handlePetAction}
                    className="cursor-pointer relative z-10"
                  >
                     <PetCharacter 
                       character={currentPet.character} 
                       stage={PetService.getStage(currentPet.level)} 
                       clothing={state.clothing}
                       accessory={state.accessory}
                       background={state.background}
                     />
                     <AnimatePresence>
                        {teachFeedback && (
                          <motion.div 
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                            className="absolute bottom-10 left-1/2 -translate-x-1/2 px-4 py-2 rounded-xl shadow-md border border-slate-100 whitespace-nowrap text-sm font-bold text-slate-600 z-50 text-center bg-white"
                          >
                             {teachFeedback}
                          </motion.div>
                        )}
                     </AnimatePresence>
                     <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-4 bg-white px-4 py-2 rounded-2xl shadow-sm border border-slate-50 text-xs font-bold text-slate-400 italic min-w-[120px] max-w-[200px] text-center">
                        {currentSpeech}
                     </div>
                  </motion.div>

                  {/* Heart effects */}
                  {hearts.map(h => (
                    <motion.div
                      key={h.id}
                      initial={{ opacity: 1, y: h.y - 100, x: h.x - 50 }}
                      animate={{ opacity: 0, y: h.y - 200 }}
                      className="fixed z-50 pointer-events-none"
                    >
                      <Heart className="text-rose-500 fill-rose-500" size={24} />
                    </motion.div>
                  ))}
               </div>

               <div className="mt-6 sm:mt-8 space-y-4 sm:space-y-6">
                  {/* Status Bar - Moved Here */}
                  <div className="bg-white/90 backdrop-blur-md p-4 sm:p-5 rounded-[2rem] sm:rounded-[2.5rem] shadow-xl border border-white flex flex-wrap items-center justify-between gap-4 sm:gap-6">
                     <div className="flex items-center gap-3 sm:gap-4">
                        <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-pastel-pink-400 to-pastel-pink-600 text-white rounded-xl sm:rounded-2xl flex items-center justify-center font-black text-lg sm:text-xl shadow-lg shadow-pastel-pink-200 ring-4 ring-white">
                           {currentPet.level}
                        </div>
                        <div>
                           <div className="text-[9px] sm:text-[10px] font-black text-pastel-pink-400 uppercase tracking-widest leading-none mb-1">LV.{currentPet.level}</div>
                           <div className="flex items-center gap-2">
                              {isEditingName ? (
                                <div className="flex items-center gap-1">
                                  <input
                                    type="text"
                                    value={newName}
                                    onChange={(e) => setNewName(e.target.value)}
                                    autoFocus
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') handleRename();
                                      if (e.key === 'Escape') setIsEditingName(false);
                                    }}
                                    className="text-base sm:text-lg font-black text-slate-900 leading-none bg-slate-50 border-b-2 border-pastel-pink-300 outline-none w-24 sm:w-32 px-1"
                                    maxLength={10}
                                  />
                                  <button onClick={handleRename} className="p-1 text-emerald-500 hover:bg-emerald-50 rounded-full transition-colors">
                                    <Check size={14} />
                                  </button>
                                  <button onClick={() => setIsEditingName(false)} className="p-1 text-rose-500 hover:bg-rose-50 rounded-full transition-colors">
                                    <X size={14} />
                                  </button>
                                </div>
                              ) : (
                                <>
                                  <div className="text-lg sm:text-xl font-black text-slate-900 leading-none">{currentPet.name}</div>
                                  <button onClick={startEditing} className="p-1 text-slate-300 hover:text-pastel-pink-400 transition-colors">
                                    <Pencil size={12} />
                                  </button>
                                </>
                              )}
                           </div>
                        </div>
                     </div>
                     
                     <div className="flex-1 min-w-[180px] sm:min-w-[200px] flex gap-4 sm:gap-6">
                        <div className="flex-1">
                           <div className="flex justify-between items-center text-[8px] sm:text-[9px] font-black text-slate-400 uppercase mb-2">
                              <span>XP</span>
                              <span>{Math.round((currentPet.xp / PetService.getXpNeeded(currentPet.level)) * 100)}%</span>
                           </div>
                           <div className="w-full h-2 sm:h-3 bg-slate-100 rounded-full overflow-hidden border border-slate-50">
                              <motion.div 
                                initial={{ width: 0 }}
                                animate={{ width: `${(currentPet.xp / PetService.getXpNeeded(currentPet.level)) * 100}%` }}
                                className="h-full bg-pastel-pink-500 rounded-full"
                              />
                           </div>
                        </div>
                        <div className="flex-1">
                           <div className="flex justify-between items-center text-[8px] sm:text-[9px] font-black text-slate-400 uppercase mb-2">
                              <span>ENERGY</span>
                              <span className={currentPet.energy < 20 ? 'text-rose-500 animate-pulse' : ''}>{currentPet.energy}%</span>
                           </div>
                           <div className="w-full h-2 sm:h-3 bg-slate-100 rounded-full overflow-hidden border border-slate-50">
                              <motion.div 
                                initial={{ width: 0 }}
                                animate={{ width: `${(currentPet.energy / currentPet.maxEnergy) * 100}%` }}
                                className="h-full bg-amber-400 rounded-full shadow-[inset_0_1px_2px_rgba(0,0,0,0.1)]"
                              />
                           </div>
                        </div>
                     </div>
                  </div>

                  <div className="grid grid-cols-4 gap-2 sm:gap-4">
                     <ActionButton icon="🍪" label="간식" active={activeTab === 'snacks'} onClick={() => setActiveTab('snacks')} />
                     <ActionButton icon="👗" label="옷장" active={activeTab === 'outfit'} onClick={() => setActiveTab('outfit')} />
                     <ActionButton icon="💬" label="말하기" active={activeTab === 'teach'} onClick={() => setActiveTab('teach')} />
                     <ActionButton icon="🛍️" label="상점" active={activeTab === 'shop'} onClick={() => setActiveTab('shop')} />
                  </div>
               </div>
            </div>

            <div ref={interactionRef} className="bg-white rounded-[2rem] sm:rounded-[3rem] border border-slate-100 shadow-xl overflow-hidden flex flex-col h-fit lg:h-auto">
               <div className="p-4 sm:p-6 border-b border-slate-50">
                  <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                     {activeTab === 'shop' && <ShoppingBag className="text-pastel-pink-500" size={20} />}
                     {activeTab === 'snacks' && <Sparkles className="text-pastel-pink-500" size={20} />}
                     {activeTab === 'outfit' && <Shirt className="text-pastel-pink-500" size={20} />}
                     {activeTab === 'teach' && <MessageCircle className="text-pastel-pink-500" size={20} />}
                     {activeTab === 'main' && <Sparkles className="text-pastel-pink-500" size={20} />}
                     {activeTab === 'shop' ? '펫 상점' : activeTab === 'snacks' ? '간식 & 회복' : activeTab === 'outfit' ? '내 옷장' : activeTab === 'teach' ? '말 가르치기' : '알림'}
                  </h3>
               </div>
               
               <div className="flex-1 overflow-y-auto p-6 max-h-[500px] scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
                  {activeTab === 'snacks' && (
                    <div className="space-y-8">
                       <section>
                          <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">맛있는 간식 & 에너지 회복</h4>
                          <div className="space-y-2">
                             {SHOP_ITEMS.consumables.map(item => (
                               <ShopItem key={item.id} item={item} onBuy={() => handlePurchase(item, 'consumable')} />
                             ))}
                          </div>
                          <p className="mt-4 text-[10px] text-slate-400 font-medium italic">* 커피와 에너지드링크는 펫의 체력을 회복시켜주며, 하루에 1번만 먹일 수 있습니다.</p>
                       </section>
                    </div>
                  )}

                  {activeTab === 'shop' && (
                    <div className="space-y-8">
                       <section>
                          <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">의상</h4>
                          <div className="space-y-2">
                             {SHOP_ITEMS.outfits.map(item => (
                               <ShopItem key={item.id} item={item} onBuy={() => handlePurchase(item, item.category)} isOwned={state.inventory.includes(item.id)} />
                             ))}
                          </div>
                       </section>
                       <section>
                          <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">액세서리</h4>
                          <div className="space-y-2">
                             {SHOP_ITEMS.accessories.map(item => (
                               <ShopItem key={item.id} item={item} onBuy={() => handlePurchase(item, item.category)} isOwned={state.inventory.includes(item.id)} />
                             ))}
                          </div>
                       </section>
                       <section>
                          <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">보금자리</h4>
                          <div className="space-y-2">
                             {SHOP_ITEMS.backgrounds.map(item => (
                               <ShopItem key={item.id} item={item} onBuy={() => handlePurchase(item, item.category)} isOwned={state.inventory.includes(item.id) || item.price === 0} />
                             ))}
                          </div>
                       </section>
                    </div>
                  )}

                  {activeTab === 'outfit' && (
                    <div className="space-y-4">
                      {state.inventory.length === 0 ? (
                        <div className="text-center py-12 text-slate-400 text-sm font-medium">상점에서 아이템을 구매해보세요!</div>
                      ) : (
                        <div className="grid grid-cols-2 gap-4">
                          {state.inventory.map(id => {
                            const clothing = SHOP_ITEMS.outfits.find(i => i.id === id);
                            const accessory = SHOP_ITEMS.accessories.find(i => i.id === id);
                            const bg = SHOP_ITEMS.backgrounds.find(i => i.id === id);
                            const item = clothing || accessory || bg;
                            if (!item) return null;
                            
                            const isEquipped = state.clothing === id || state.accessory === id || state.background === id;
                            
                            return (
                              <button
                                key={id}
                                onClick={() => {
                                  if (!user) return;
                                  const newState = PetService.applyItem(id, item.category as any, user.uid);
                                  setState({ ...newState });
                                }}
                                className={`p-4 rounded-2xl border-2 transition-all flex flex-col items-center ${
                                  isEquipped 
                                    ? 'border-pastel-pink-300 bg-pastel-pink-50' 
                                    : 'border-slate-100 bg-slate-50 hover:border-slate-200'
                                }`}
                              >
                                <div className="text-3xl mb-2">{item.icon}</div>
                                <div className="text-xs font-bold text-slate-700">{item.name}</div>
                                {isEquipped && (
                                  <div className="mt-2 text-[10px] font-black text-pastel-pink-500">장착중</div>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {activeTab === 'teach' && (
                    <form onSubmit={handleTeach} className="space-y-6">
                       <div>
                          <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">따라할 말 가르치기</label>
                          <input 
                            type="text" 
                            value={teachInput}
                            onChange={(e) => setTeachInput(e.target.value)}
                            placeholder="예: 오늘도 화이팅!"
                            className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-pastel-pink-200 outline-none text-sm font-bold"
                          />
                       </div>
                       <button 
                          type="submit"
                          disabled={isTeaching}
                          className="w-full py-4 bg-pastel-pink-500 text-white rounded-2xl font-black shadow-lg shadow-pastel-pink-100 flex flex-col items-center leading-tight disabled:opacity-50"
                        >
                           <span>{isTeaching ? '배우는 중...' : '가르치기 (+20 XP)'}</span>
                           <span className="text-[10px] font-bold opacity-80 mt-1">체력 20 소모</span>
                        </button>
                    </form>
                  )}

                  {activeTab === 'main' && (
                    <div className="space-y-4">
                       <div className="bg-emerald-50 p-6 rounded-3xl border border-emerald-100">
                          <div className="flex items-center gap-3 mb-2">
                             <CheckCircle2 className="text-emerald-500" size={18} />
                             <span className="font-black text-emerald-800">성장 가이드</span>
                          </div>
                          <p className="text-xs text-emerald-700 font-medium leading-relaxed">
                            학습 문제를 풀면 경험치와 포인트를 얻을 수 있어요! 정답 하나당 10 XP를 얻고, 오답 노트를 복습하면 15 XP를 얻습니다.
                          </p>
                       </div>
                       <div className="bg-blue-50 p-6 rounded-3xl border border-blue-100">
                          <div className="flex items-center gap-3 mb-2">
                             <Trophy className="text-blue-500" size={18} />
                             <span className="font-black text-blue-800">만렙 혜택</span>
                          </div>
                          <p className="text-xs text-blue-700 font-medium leading-relaxed">
                            100레벨을 달성하면 새로운 친구를 분양받을 수 있는 슬롯이 해금됩니다!
                          </p>
                       </div>
                    </div>
                  )}
               </div>

               {activeTab !== 'main' && (
                 <div className="p-4 bg-slate-50 border-t border-slate-100">
                    <button 
                      onClick={() => setActiveTab('main')}
                      className="w-full py-2 text-xs font-bold text-slate-400 hover:text-slate-600 transition-colors"
                    >
                      ← 돌아가기
                    </button>
                 </div>
               )}
            </div>
         </div>
      </div>
    </div>
  );
}

function ActionButton({ icon, label, onClick, active }: any) {
  return (
    <button 
      onClick={onClick}
      className={`p-3 sm:p-4 rounded-2xl sm:rounded-3xl transition-all shadow-sm flex flex-col items-center gap-1 sm:gap-2 group flex-1 ${
        active ? 'bg-pastel-pink-500 text-white shadow-pastel-pink-200' : 'bg-white text-slate-600 border border-slate-100 hover:bg-slate-50'
      }`}
    >
      <div className="text-xl sm:text-2xl group-hover:scale-110 transition-transform">{icon}</div>
      <span className="text-[8px] sm:text-[10px] font-black uppercase tracking-tighter text-center">{label}</span>
    </button>
  );
}

function ShopItem({ item, onBuy, isOwned }: any) {
  return (
    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-xl shadow-sm">{item.icon}</div>
        <div>
          <div className="text-sm font-bold text-slate-700">{item.name}</div>
          <div className="text-[10px] font-black text-emerald-500">{item.price}P</div>
        </div>
      </div>
      <button 
        onClick={onBuy}
        disabled={isOwned}
        className={`px-4 py-2 rounded-xl text-[10px] font-black transition-all ${
          isOwned ? 'bg-slate-200 text-slate-400' : 'bg-pastel-pink-500 text-white shadow-sm hover:bg-pastel-pink-600'
        }`}
      >
        {isOwned ? '보유함' : '구매하기'}
      </button>
    </div>
  );
}
