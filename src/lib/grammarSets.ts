import { collection, addDoc, Timestamp, query, where, getDocs, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from './firebase';

export interface GrammarWord {
  word: string;
  meaning: string;
  pattern: string;
}

const objectPatternData: GrammarWord[] = [
  // to부정사만 (to-only)
  { word: 'want', meaning: '원하다', pattern: 'to부정사만 목적어로 오는 동사' },
  { word: 'promise', meaning: '약속하다', pattern: 'to부정사만 목적어로 오는 동사' },
  { word: 'fail', meaning: '실패하다', pattern: 'to부정사만 목적어로 오는 동사' },
  { word: 'wish', meaning: '바라다', pattern: 'to부정사만 목적어로 오는 동사' },
  { word: 'plan', meaning: '계획하다', pattern: 'to부정사만 목적어로 오는 동사' },
  { word: 'choose', meaning: '선택하다', pattern: 'to부정사만 목적어로 오는 동사' },
  { word: 'decide', meaning: '결정하다', pattern: 'to부정사만 목적어로 오는 동사' },
  { word: 'agree', meaning: '동의하다', pattern: 'to부정사만 목적어로 오는 동사' },
  { word: 'learn', meaning: '배우다', pattern: 'to부정사만 목적어로 오는 동사' },
  { word: 'need', meaning: '필요로 하다', pattern: 'to부정사만 목적어로 오는 동사' },
  { word: 'hope', meaning: '희망하다', pattern: 'to부정사만 목적어로 오는 동사' },
  { word: 'expect', meaning: '기대하다', pattern: 'to부정사만 목적어로 오는 동사' },
  { word: 'refuse', meaning: '거절하다', pattern: 'to부정사만 목적어로 오는 동사' },
  { word: 'aim', meaning: '목표로 하다', pattern: 'to부정사만 목적어로 오는 동사' },
  { word: 'manage', meaning: '가까스로 해내다', pattern: 'to부정사만 목적어로 오는 동사' },

  // 동명사만 (ing-only)
  { word: 'enjoy', meaning: '즐기다', pattern: '동명사만 목적어로 오는 동사' },
  { word: 'avoid', meaning: '피하다', pattern: '동명사만 목적어로 오는 동사' },
  { word: 'finish', meaning: '끝내다', pattern: '동명사만 목적어로 오는 동사' },
  { word: 'keep', meaning: '계속하다', pattern: '동명사만 목적어로 오는 동사' },
  { word: 'mind', meaning: '꺼려하다', pattern: '동명사만 목적어로 오는 동사' },
  { word: 'admit', meaning: '인정하다', pattern: '동명사만 목적어로 오는 동사' },
  { word: 'practice', meaning: '연습하다', pattern: '동명사만 목적어로 오는 동사' },
  { word: 'suggest', meaning: '제안하다', pattern: '동명사만 목적어로 오는 동사' },
  { word: 'quit', meaning: '그만두다', pattern: '동명사만 목적어로 오는 동사' },
  { word: 'deny', meaning: '부인하다', pattern: '동명사만 목적어로 오는 동사' },
  { word: 'imagine', meaning: '상상하다', pattern: '동명사만 목적어로 오는 동사' },
  { word: 'resist', meaning: '저항하다', pattern: '동명사만 목적어로 오는 동사' },
  { word: 'dislike', meaning: '싫어하다', pattern: '동명사만 목적어로 오는 동사' },
  { word: 'postpone', meaning: '연기하다', pattern: '동명사만 목적어로 오는 동사' },
  { word: 'consider', meaning: '고려하다', pattern: '동명사만 목적어로 오는 동사' },
  { word: 'recommend', meaning: '추천하다', pattern: '동명사만 목적어로 오는 동사' },

  // 둘다 (의미 같음)
  { word: 'start', meaning: '시작하다', pattern: '둘다 목적어로 오고 의미도 같은 동사' },
  { word: 'begin', meaning: '시작하다', pattern: '둘다 목적어로 오고 의미도 같은 동사' },
  { word: 'love', meaning: '사랑하다', pattern: '둘다 목적어로 오고 의미도 같은 동사' },
  { word: 'like', meaning: '좋아하다', pattern: '둘다 목적어로 오고 의미도 같은 동사' },
  { word: 'hate', meaning: '싫어하다', pattern: '둘다 목적어로 오고 의미도 같은 동사' },
  { word: 'continue', meaning: '계속하다', pattern: '둘다 목적어로 오고 의미도 같은 동사' },
  { word: 'prefer', meaning: '선호하다', pattern: '둘다 목적어로 오고 의미도 같은 동사' },
  { word: 'intend', meaning: '의도하다', pattern: '둘다 목적어로 오고 의미도 같은 동사' },

  // 둘다 (의미 다름)
  { word: 'forget', meaning: '잊다', pattern: '둘다 오지만 의미는 다른 동사' },
  { word: 'remember', meaning: '기억하다', pattern: '둘다 오지만 의미는 다른 동사' },
  { word: 'regret', meaning: '후회하다/유감이다', pattern: '둘다 오지만 의미는 다른 동사' },
  { word: 'try', meaning: '시도하다/노력하다', pattern: '둘다 오지만 의미는 다른 동사' },
];

export async function seedObjectPatternGrammar() {
  if ((window as any)._grammarSeeded) return;
  (window as any)._grammarSeeded = true;

  const wordbooksRef = collection(db, 'wordbooks');
  // Query by type instead of title to allow renaming
  const q = query(wordbooksRef, where('type', '==', 'to-ing-grammar'));
  const snapshot = await getDocs(q);

  let wordbookId: string;

  if (snapshot.empty) {
    const docRef = await addDoc(wordbooksRef, {
      title: 'to부정사와 동명사 목적어',
      description: '목적어로 to부정사가 오는지 동명사가 오는지 학습합니다.',
      createdBy: 'system',
      isPublic: true,
      type: 'to-ing-grammar',
      category: 'grammar',
      createdAt: Timestamp.now(),
      order: 0
    });
    wordbookId = docRef.id;
  } else {
    wordbookId = snapshot.docs[0].id;
    // Update missing fields but keep existing title if user renamed it
    await setDoc(doc(db, 'wordbooks', wordbookId), { 
      type: 'to-ing-grammar',
      category: 'grammar',
      createdBy: 'system',
      description: '목적어로 to부정사가 오는지 동명사가 오는지 학습합니다.'
    }, { merge: true });
  }

  const wordsRef = collection(db, `wordbooks/${wordbookId}/words`);
  const existingWords = await getDocs(wordsRef);
  
  if (existingWords.empty) {
    for (let i = 0; i < objectPatternData.length; i++) {
      const item = objectPatternData[i];
      await addDoc(wordsRef, {
        word: item.word,
        meaning: item.meaning,
        pattern: item.pattern,
        order: i
      });
    }
  }
}

export const COMPLEMENT_QUIZ_DATA = [
  { verb: "call", type: "명형", label: "call O 명사/형용사", desc: "~를 -이라고 부르다" },
  { verb: "make", type: "명형+사역", label: "make O 명사/형용사 또는 동사원형", desc: "둘 다 가능 (의미 다름)" },
  { verb: "keep", type: "명형", label: "keep O 명사/형용사", desc: "~을 -한 상태로 유지하다" },
  { verb: "think", type: "명형", label: "think O 명사/형용사", desc: "~를 -이라고 생각하다" },
  { verb: "believe", type: "명형", label: "believe O 명사/형용사", desc: "~를 -라고 믿다" },
  { verb: "consider", type: "명형", label: "consider O 명사/형용사", desc: "~을 -이라고 여기다" },
  { verb: "find", type: "명형", label: "find O 명사/형용사", desc: "~가 -이라는 것을 알게 되다" },
  { verb: "want", type: "to V", label: "want O to V", desc: "~가 -하기를 원하다" },
  { verb: "ask", type: "to V", label: "ask O to V", desc: "~에게 -하라고 요청하다" },
  { verb: "encourage", type: "to V", label: "encourage O to V", desc: "~가 -하는 것을 격려하다" },
  { verb: "tell", type: "to V", label: "tell O to V", desc: "~에게 -하라고 말하다" },
  { verb: "expect", type: "to V", label: "expect O to V", desc: "~가 -하는 것을 기대하다" },
  { verb: "permit", type: "to V", label: "permit O to V", desc: "~가 -하는 것을 허락하다" },
  { verb: "advise", type: "to V", label: "advise O to V", desc: "~에게 -하라고 조언하다" },
  { verb: "allow", type: "to V", label: "allow O to V", desc: "~가 -하는 것을 허락하다" },
  { verb: "force", type: "to V", label: "force O to V", desc: "~가 -하도록 강요하다" },
  { verb: "get", type: "to V", label: "get O to V", desc: "~가 -하게 시키다 (준사역)" },
  { verb: "have", type: "동사원형", label: "have O 동사원형", desc: "사역동사: ~에게 -하게 하다" },
  { verb: "let", type: "동사원형", label: "let O 동사원형", desc: "사역동사: ~가 -하도록 허락하다" },
  { verb: "help", type: "동사원형/to V", label: "help O 동사원형 / to V 둘 다 가능", desc: "준사역동사: 의미 차이 없음" },
  { verb: "see", type: "동사원형/V-ing", label: "see O 동사원형 / V-ing 둘 다 가능", desc: "지각동사: 완료 vs 진행 의미 차이" },
  { verb: "watch", type: "동사원형/V-ing", label: "watch O 동사원형 / V-ing 둘 다 가능", desc: "지각동사" },
  { verb: "hear", type: "동사원형/V-ing", label: "hear O 동사원형 / V-ing 둘 다 가능", desc: "지각동사" },
  { verb: "listen to", type: "동사원형/V-ing", label: "listen to O 동사원형 / V-ing 둘 다 가능", desc: "지각동사" },
  { verb: "smell", type: "동사원형/V-ing", label: "smell O 동사원형 / V-ing 둘 다 가능", desc: "지각동사" },
  { verb: "feel", type: "동사원형/V-ing", label: "feel O 동사원형 / V-ing 둘 다 가능", desc: "지각동사" }
];

export async function seedComplementGrammar() {
  if ((window as any)._complementSeeded) return;
  (window as any)._complementSeeded = true;

  const wordbooksRef = collection(db, 'wordbooks');
  // Query by type instead of title to allow renaming
  const q = query(wordbooksRef, where('type', '==', 'complement-grammar'));
  const snapshot = await getDocs(q);

  let wordbookId: string;

  if (snapshot.empty) {
    // Check if it exists with old title but no type (for transitional period)
    const oldTitleQ = query(wordbooksRef, where('title', '==', '5형식 목적격 보어 퀴즈'));
    const oldSnapshot = await getDocs(oldTitleQ);

    if (!oldSnapshot.empty) {
      wordbookId = oldSnapshot.docs[0].id;
      await setDoc(doc(db, 'wordbooks', wordbookId), {
        type: 'complement-grammar',
        category: 'grammar',
        createdBy: 'system'
      }, { merge: true });
    } else {
      const docRef = await addDoc(wordbooksRef, {
        title: '5형식 목적격 보어 퀴즈',
        description: '동사별로 어떤 목적격 보어가 오는지 학습합니다.',
        createdBy: 'system',
        isPublic: true,
        type: 'complement-grammar',
        category: 'grammar',
        createdAt: Timestamp.now(),
        order: -1
      });
      wordbookId = docRef.id;
    }
  } else {
    wordbookId = snapshot.docs[0].id;
    await setDoc(doc(db, 'wordbooks', wordbookId), { 
      type: 'complement-grammar',
      category: 'grammar',
      createdBy: 'system',
      description: '동사별로 어떤 목적격 보어가 오는지 학습합니다.'
    }, { merge: true });
  }

  const wordsRef = collection(db, `wordbooks/${wordbookId}/words`);
  const existingWords = await getDocs(wordsRef);
  
  if (existingWords.empty) {
    for (let i = 0; i < COMPLEMENT_QUIZ_DATA.length; i++) {
      const item = COMPLEMENT_QUIZ_DATA[i];
      await addDoc(wordsRef, {
        word: item.verb,
        meaning: item.desc,
        pattern: item.type,
        distractors: [item.label],
        order: i
      });
    }
  }
}

export const CONVERSION_GRAMMAR_DATA = [
  { word: 'give', meaning: '주다', pattern: 'to' },
  { word: 'send', meaning: '보내다', pattern: 'to' },
  { word: 'bring', meaning: '가져오다', pattern: 'to' },
  { word: 'pass', meaning: '건네주다', pattern: 'to' },
  { word: 'show', meaning: '보여주다', pattern: 'to' },
  { word: 'teach', meaning: '가르치다', pattern: 'to' },
  { word: 'tell', meaning: '말해주다', pattern: 'to' },
  { word: 'write', meaning: '써주다', pattern: 'to' },
  { word: 'read', meaning: '읽어주다', pattern: 'to' },
  { word: 'lend', meaning: '빌려주다', pattern: 'to' },
  { word: 'sell', meaning: '팔다', pattern: 'to' },
  { word: 'pay', meaning: '지불하다', pattern: 'to' },
  { word: 'offer', meaning: '제공하다', pattern: 'to' },
  { word: 'buy', meaning: '사다', pattern: 'for' },
  { word: 'cook', meaning: '요리해주다', pattern: 'for' },
  { word: 'find', meaning: '찾아주다', pattern: 'for' },
  { word: 'make', meaning: '만들어주다', pattern: 'for' },
  { word: 'get', meaning: '가져다주다', pattern: 'for' },
  { word: 'build', meaning: '지어주다', pattern: 'for' },
  { word: 'ask', meaning: '묻다', pattern: 'of' },
  { word: 'cost', meaning: '비용이 들게 하다', pattern: 'impossible' },
  { word: 'save', meaning: '덜어주다', pattern: 'impossible' },
  { word: 'envy', meaning: '부러워하다', pattern: 'impossible' },
  { word: 'forgive', meaning: '용서하다', pattern: 'impossible' },
  { word: 'pardon', meaning: '용서하다', pattern: 'impossible' },
  { word: 'spare', meaning: '할애하다', pattern: 'impossible' },
  { word: 'take', meaning: '시간이 걸리게 하다', pattern: 'impossible' },
];

export const MODAL_GRAMMAR_DATA = [
  // POINT 5 — 조동사 + have + p.p.
  { word: 'may[might] + have p.p.', meaning: '~했을 수도 있다', pattern: '조동사 + have p.p.', distractors: ['~했음이 틀림없다', '~했을 리가 없다', '~했어야 했다'] },
  { word: 'must + have p.p.', meaning: '~했음이 틀림없다', pattern: '조동사 + have p.p.', distractors: ['~했을 수도 있다', '~했을 리가 없다', '~했을 수도 있었다'] },
  { word: 'can\'t + have p.p.', meaning: '~했을 리가 없다', pattern: '조동사 + have p.p.', distractors: ['~했음이 틀림없다', '~했을 수도 있다', '~하는 것이 낫다'] },
  { word: 'should + have p.p.', meaning: '~했어야 했다 (하지만 하지 않았다)', pattern: '조동사 + have p.p.', distractors: ['~했을 수도 있었다', '~했음이 틀림없다', '~했을 수도 있다'] },
  { word: 'could + have p.p.', meaning: '~했을 수도 있었다 (하지만 하지 않았다)', pattern: '조동사 + have p.p.', distractors: ['~했어야 했다', '~했을 리가 없다', '~했음이 틀림없다'] },
  
  // POINT 6 — 조동사 관용 표현
  { word: 'would like + 명사', meaning: '~을 원하다', pattern: '조동사 관용 표현', distractors: ['~하고 싶다', '(차라리) ~하겠다', '~하는 편이 좋다'] },
  { word: 'would like to + 동사원형', meaning: '~하고 싶다', pattern: '조동사 관용 표현', distractors: ['~을 원하다', '~하는 것이 낫다', '~하는 것도 당연하다'] },
  { word: 'would rather + 동사원형', meaning: '(차라리) ~하겠다', pattern: '조동사 관용 표현', distractors: ['~하고 싶다', '~하는 편이 좋다', '~하는 것이 낫다'] },
  { word: 'may well + 동사원형', meaning: '(~하는 것도) 당연하다', pattern: '조동사 관용 표현', distractors: ['~하는 편이 좋다', '(차라리) ~하겠다', '~하고 싶다'] },
  { word: 'may as well + 동사원형', meaning: '~하는 편이 좋다', pattern: '조동사 관용 표현', distractors: ['(~하는 것도) 당연하다', '~하는 것이 낫다', '~을 원하다'] },
  { word: 'had better + 동사원형', meaning: '~하는 것이 낫다', pattern: '조동사 관용 표현', distractors: ['~하는 편이 좋다', '~하고 싶다', '(차라리) ~하겠다'] },
];

export async function seedModalGrammar() {
  if ((window as any)._modalSeeded) return;
  (window as any)._modalSeeded = true;

  const wordbooksRef = collection(db, 'wordbooks');
  const q = query(wordbooksRef, where('type', '==', 'modal-grammar'));
  const snapshot = await getDocs(q);

  let wordbookId: string;

  if (snapshot.empty) {
    const docRef = await addDoc(wordbooksRef, {
      title: '조동사',
      description: '조동사 + have p.p. 및 관용 표현을 학습합니다.',
      createdBy: 'system',
      isPublic: true,
      type: 'modal-grammar',
      category: 'grammar',
      createdAt: Timestamp.now(),
      order: 2
    });
    wordbookId = docRef.id;
  } else {
    wordbookId = snapshot.docs[0].id;
    await setDoc(doc(db, 'wordbooks', wordbookId), { 
      type: 'modal-grammar',
      category: 'grammar',
      createdBy: 'system',
      description: '조동사 + have p.p. 및 관용 표현을 학습합니다.'
    }, { merge: true });
  }

  const wordsRef = collection(db, `wordbooks/${wordbookId}/words`);
  const existingWords = await getDocs(wordsRef);
  
  if (existingWords.empty) {
    for (let i = 0; i < MODAL_GRAMMAR_DATA.length; i++) {
      const item = MODAL_GRAMMAR_DATA[i];
      await addDoc(wordsRef, {
        word: item.word,
        meaning: item.meaning,
        pattern: item.pattern,
        distractors: item.distractors,
        order: i
      });
    }
  }
}

export async function seedConversionGrammar() {
  if ((window as any)._conversionSeeded) return;
  (window as any)._conversionSeeded = true;

  const wordbooksRef = collection(db, 'wordbooks');
  // Query by type instead of title to allow renaming
  const q = query(wordbooksRef, where('type', '==', 'conversion-grammar'));
  const snapshot = await getDocs(q);

  let wordbookId: string;

  if (snapshot.empty) {
    const docRef = await addDoc(wordbooksRef, {
      title: '4형식의 3형식 전환',
      description: '4형식 동사의 3형식 전환을 학습합니다.',
      createdBy: 'system',
      isPublic: true,
      type: 'conversion-grammar',
      category: 'grammar',
      createdAt: Timestamp.now(),
      order: 1
    });
    wordbookId = docRef.id;
  } else {
    wordbookId = snapshot.docs[0].id;
    await setDoc(doc(db, 'wordbooks', wordbookId), { 
      type: 'conversion-grammar',
      category: 'grammar',
      createdBy: 'system',
      description: '4형식 동사의 3형식 전환을 학습합니다.'
    }, { merge: true });
  }

  const wordsRef = collection(db, `wordbooks/${wordbookId}/words`);
  const existingWords = await getDocs(wordsRef);
  
  if (existingWords.empty) {
    for (let i = 0; i < CONVERSION_GRAMMAR_DATA.length; i++) {
      const item = CONVERSION_GRAMMAR_DATA[i];
      await addDoc(wordsRef, {
        word: item.word,
        meaning: item.meaning,
        pattern: item.pattern,
        order: i
      });
    }
  }
}

export const RELATIVE_GRAMMAR_CONCEPTS = [
  { 
    word: "관계대명사", 
    meaning: "선행사 O + 불완전한 절 (주어/목적어 생략)", 
    pattern: "rel-pronoun",
    examples: [
      {
        sentence: "The smartphone (___) I bought yesterday has a very high-quality camera.",
        explanation: "선행사: The smartphone (사물) / 뒤 절: bought의 목적어가 빠짐 / 정답 이유: 목적격 관계대명사 which (또는 that)",
        type: "A",
        choices: ["which", "where", "when", "how"]
      },
      {
        sentence: "The house (___) has a red roof belongs to the famous novelist.",
        explanation: "선행사: The house (사물) / 뒤 절: 주어가 빠진 불완전한 절 / 정답 이유: 주격 관계대명사 that (또는 which)",
        type: "A",
        choices: ["that", "where", "when", "why"]
      },
      {
        sentence: "The wonderful day (___) we spent together in Jeju Island will be a great memory.",
        explanation: "선행사: The wonderful day (시간 명사) / 뒤 절: spent의 목적어가 없는 불완전한 절 / 정답 이유: 목적격 관계대명사 that/which",
        type: "A",
        choices: ["that", "when", "where", "why"]
      },
      {
        sentence: "I really enjoyed the novel [that] you lent me for my long flight.",
        explanation: "선행사: the novel (사물) / 뒤 절: lent의 목적어 빠짐 / 정답 이유: 목적격 관계대명사",
        type: "B",
        choices: ["관계대명사 (선행사 O + 불완전한 절)", "관계부사 (선행사 O + 완전한 절)", "동격 that (선행사 O + 완전한 절)", "접속사 that (선행사 X + 완전한 절)"]
      },
      {
        sentence: "The girl [whom] you met at the cafe yesterday is my cousin from Seoul.",
        explanation: "선행사: The girl (사람) / 뒤 절: met의 목적어가 빠짐 / 정답 이유: 목적격 관계대명사 whom",
        type: "B",
        choices: ["관계대명사 (선행사 O + 불완전한 절)", "관계부사 (선행사 O + 완전한 절)", "동격 that (선행사 O + 완전한 절)", "접속사 that (선행사 X + 완전한 절)"]
      },
      {
        sentence: "The city (___) I want to visit most during this summer vacation is Paris.",
        explanation: "선행사: The city (장소 명사) / 뒤 절: visit의 목적어가 빠진 불완전한 절 / 정답 이유: 목적격 관계대명사 which (where와 혼동 주의)",
        type: "A",
        choices: ["which", "where", "when", "that"]
      },
      {
        sentence: "The rumors (___) were spreading quickly around the school turned out to be false.",
        explanation: "선행사: The rumors (사물) / 뒤 절: 주어가 빠진 불완전한 절 / 정답 이유: 주격 관계대명사 that (또는 which)",
        type: "A",
        choices: ["that", "where", "when", "how"]
      },
      {
        sentence: "The boy [who] lives next door to my grandmother is a very talented piano player.",
        explanation: "선행사: The boy (사람) / 뒤 절: 주어가 빠진 불완전한 절 / 정답 이유: 주격 관계대명사 who",
        type: "B",
        choices: ["관계대명사 (선행사 O + 불완전한 절)", "관계부사 (선행사 O + 완전한 절)", "동격 that (선행사 O + 완전한 절)", "접속사 that (선행사 X + 완전한 절)"]
      },
      {
        sentence: "The novel (___) was written by the famous author became a bestseller instantly.",
        explanation: "선행사: The novel (사물) / 뒤 절: 주어가 빠짐 / 정답 이유: 주격 관계대명사 which (또는 that)",
        type: "A",
        choices: ["which", "who", "where", "when"]
      },
      {
        sentence: "I know a boy (___) father is a world-class professional soccer player.",
        explanation: "선행사: a boy / 뒤 절: 주어(father)의 소유주가 선행사 / 정답 이유: 소유격 관계대명사 whose",
        type: "A",
        choices: ["whose", "who", "whom", "which"]
      },
      {
        sentence: "The people (___) volunteered for the community service were very kind.",
        explanation: "선행사: The people (사람) / 뒤 절: 주어가 빠짐 / 정답 이유: 주격 관계대명사 who",
        type: "A",
        choices: ["who", "which", "when", "where"]
      },
      {
        sentence: "The documentary [that] we watched in class yesterday was very educational.",
        explanation: "선행사: the documentary (사물) / 뒤 절: watched의 목적어가 빠짐 / 정답 이유: 관계대명사 that (목적격)",
        type: "B",
        choices: ["관계대명사 (선행사 O + 불완전한 절)", "관계부사 (선행사 O + 완전한 절)", "동격 that (선행사 O + 완전한 절)", "접속사 that (선행사 X + 완전한 절)"]
      },
      {
        sentence: "This is the only way [that] I can solve this complicated math problem.",
        explanation: "선행사: the only way / 뒤 절: solve의 목적어 빠짐 / 정답 이유: 관계대명사 that (the way how는 불가하므로 that/in which 사용)",
        type: "B",
        choices: ["관계대명사 (선행사 O + 불완전한 절)", "관계부사 (선행사 O + 완전한 절)", "동격 that (선행사 O + 완전한 절)", "접속사 that (선행사 X + 완전한 절)"]
      },
      {
        sentence: "The smartphone (___) has a cracked screen belongs to my younger sister.",
        explanation: "선행사: The smartphone (사물) / 뒤 절: 주어가 빠진 불완전한 절 / 정답 이유: 주격 관계대명사 that (또는 which)",
        type: "A",
        choices: ["that", "where", "when", "how"]
      },
      {
        sentence: "The tourists [who] visited the national park yesterday were amazed by the scenery.",
        explanation: "선행사: The tourists (사람) / 뒤 절: 주어 빠짐 / 정답 이유: 주격 관계대명사 who",
        type: "B",
        choices: ["관계대명사 (선행사 O + 불완전한 절)", "관계부사 (선행사 O + 완전한 절)", "동격 that (선행사 O + 완전한 절)", "접속사 that (선행사 X + 완전한 절)"]
      },
      {
        sentence: "The project [which] we've been working on for three months is finally complete.",
        explanation: "선행사: The project (사물) / 뒤 절: on의 목적어가 빠짐 / 정답 이유: 목적격 관계대명사 which",
        type: "B",
        choices: ["관계대명사 (선행사 O + 불완전한 절)", "관계부사 (선행사 O + 완전한 절)", "동격 that (선행사 O + 완전한 절)", "접속사 that (선행사 X + 완전한 절)"]
      },
      {
        sentence: "I saw a stray dog (___) tail was injured and called the animal rescue center.",
        explanation: "선행사: a stray dog / 뒤 절: 주어(tail)의 소유주가 선행사 / 정답 이유: 소유격 관계대명사 whose",
        type: "A",
        choices: ["whose", "who", "which", "whom"]
      },
      {
        sentence: "The ingredients (___) you need to make the pasta are already in the kitchen.",
        explanation: "선행사: The ingredients (사물) / 뒤 절: need의 목적어가 빠짐 / 정답 이유: 목적격 관계대명사 that (또는 which)",
        type: "A",
        choices: ["that", "where", "when", "why"]
      },
      {
        sentence: "The scientist (___) won the Nobel Prize is giving a lecture tomorrow.",
        explanation: "선행사: The scientist (사람) / 뒤 절: 주어가 빠짐 / 정답 이유: 주격 관계대명사 who",
        type: "A",
        choices: ["who", "which", "where", "whom"]
      },
      {
        sentence: "I finally found the key [which] I thought I had lost forever.",
        explanation: "선행사: the key (사물) / 뒤 절: lost의 목적어가 빠짐 / 정답 이유: 목적격 관계대명사 which",
        type: "B",
        choices: ["관계대명사 (선행사 O + 불완전한 절)", "관계부사 (선행사 O + 완전한 절)", "동격 that (선행사 O + 완전한 절)", "접속사 that (선행사 X + 완전한 절)"]
      },
      {
        sentence: "The dress (___) she wore to the party was designed by a famous artist.",
        explanation: "선행사: The dress (사물) / 뒤 절: wore의 목적어 빠짐 / 정답 이유: 목적격 관계대명사 that (또는 which)",
        type: "A",
        choices: ["that", "who", "where", "when"]
      },
      {
        sentence: "People [who] exercise regularly tend to live longer and healthier lives.",
        explanation: "선행사: People (사람) / 뒤 절: 주어 빠짐 / 정답 이유: 주격 관계대명사 who",
        type: "B",
        choices: ["관계대명사 (선행사 O + 불완전한 절)", "관계부사 (선행사 O + 완전한 절)", "동격 that (선행사 O + 완전한 절)", "접속사 that (선행사 X + 완전한 절)"]
      },
      {
        sentence: "The company (___) CEO resigned last month is facing a financial crisis.",
        explanation: "선행사: The company / 뒤 절: 주어(CEO)의 소유주가 선행사 / 정답 이유: 소유격 관계대명사 whose",
        type: "A",
        choices: ["whose", "who", "which", "whom"]
      },
      {
        sentence: "The book (___) I borrowed from the library was very interesting.",
        explanation: "선행사: The book (사물) / 뒤 절: borrowed의 목적어가 빠짐 / 정답 이유: 목적격 관계대명사 which (또는 that)",
        type: "A",
        choices: ["which", "where", "when", "how"]
      },
      {
        sentence: "The children [who] are playing in the backyard are my neighbor's kids.",
        explanation: "선행사: The children (사람) / 뒤 절: 주어가 빠짐 / 정답 이유: 주격 관계대명사 who",
        type: "B",
        choices: ["관계대명사 (선행사 O + 불완전한 절)", "관계부사 (선행사 O + 완전한 절)", "동격 that (선행사 O + 완전한 절)", "접속사 that (선행사 X + 완전한 절)"]
      },
      {
        sentence: "I know a scientist (___) research is about artificial intelligence.",
        explanation: "선행사: a scientist / 뒤 절: 주어(research)의 소유주가 선행사 / 정답 이유: 소유격 관계대명사 whose",
        type: "A",
        choices: ["whose", "who", "whom", "which"]
      },
      {
        sentence: "The apartment [which] he lives in is quite small but cozy.",
        explanation: "선행사: The apartment (사물) / 뒤 절: in의 목적어가 빠짐 / 정답 이유: 목적격 관계대명사 which",
        type: "B",
        choices: ["관계대명사 (선행사 O + 불완전한 절)", "관계부사 (선행사 O + 완전한 절)", "동격 that (선행사 O + 완전한 절)", "접속사 that (선행사 X + 완전한 절)"]
      },
      {
        sentence: "Workers [who] are diligent will be rewarded by the company.",
        explanation: "선행사: Workers (사람) / 뒤 절: 주어 빠짐 / 정답 이유: 주격 관계대명사 who",
        type: "B",
        choices: ["관계대명사 (선행사 O + 불완전한 절)", "관계부사 (선행사 O + 완전한 절)", "동격 that (선행사 O + 완전한 절)", "접속사 that (선행사 X + 완전한 절)"]
      },
      {
        sentence: "The mountain (___) we climbed last summer was very steep and challenging.",
        explanation: "선행사: The mountain (사물) / 뒤 절: climbed의 목적어가 빠짐 / 정답 이유: 목적격 관계대명사 which (또는 that)",
        type: "A",
        choices: ["which", "who", "where", "how"]
      },
      {
        sentence: "I met a traveler [whose] stories about India were absolutely fascinating.",
        explanation: "선행사: a traveler / 뒤 절: 주어(stories)의 소유주가 선행사 / 정답 이유: 소유격 관계대명사 whose",
        type: "B",
        choices: ["관계대명사 (선행사 O + 불완전한 절)", "관계부사 (선행사 O + 완전한 절)", "동격 that (선행사 O + 완전한 절)", "접속사 that (선행사 X + 완전한 절)"]
      },
      {
        sentence: "The actors (___) performed in the play received a standing ovation.",
        explanation: "선행사: The actors (사람) / 뒤 절: 주어가 빠진 불완전한 절 / 정답 이유: 주격 관계대명사 who",
        type: "A",
        choices: ["who", "which", "whose", "when"]
      },
      {
        sentence: "This is the artist [whom] the critics praised for her innovative style.",
        explanation: "선행사: the artist (사람) / 뒤 절: praised의 목적어가 빠짐 / 정답 이유: 목적격 관계대명사 whom (who/that 가능)",
        type: "B",
        choices: ["관계대명사 (선행사 O + 불완전한 절)", "관계부사 (선행사 O + 완전한 절)", "동격 that (선행사 O + 완전한 절)", "접속사 that (선행사 X + 완전한 절)"]
      },
      {
        sentence: "The email (___) you sent me this morning went straight to my spam folder.",
        explanation: "선행사: The email (사물) / 뒤 절: sent의 목적어가 빠짐 / 정답 이유: 목적격 관계대명사 that (또는 which)",
        type: "A",
        choices: ["that", "who", "whose", "why"]
      },
      {
        sentence: "The cake (___) was on the table has disappeared.",
        explanation: "선행사: The cake (사물) / 뒤 절: 주어가 빠진 불완전한 절 / 정답 이유: 주격 관계대명사 that (또는 which)",
        type: "A",
        choices: ["that", "where", "when", "how"]
      },
      {
        sentence: "I finally saw the movie [that] all my friends had been talking about.",
        explanation: "선행사: the movie (사물) / 뒤 절: about의 목적어가 빠진 불완전한 절 / 정답 이유: 목적격 관계대명사",
        type: "B",
        choices: ["관계대명사 (선행사 O + 불완전한 절)", "관계부사 (선행사 O + 완전한 절)", "동격 that (선행사 O + 완전한 절)", "접속사 that (선행사 X + 완전한 절)"]
      },
      {
        sentence: "The students (___) scores were the highest received a scholarship.",
        explanation: "선행사: The students / 뒤 절: 주어(scores)의 소유주가 선행사 / 정답 이유: 소유격 관계대명사 whose",
        type: "A",
        choices: ["whose", "who", "which", "whom"]
      },
      {
        sentence: "Do you know the boy [who] is standing by the entrance?",
        explanation: "선행사: the boy (사람) / 뒤 절: 주어가 빠진 불완전한 절 / 정답 이유: 주격 관계대명사 who",
        type: "B",
        choices: ["관계대명사 (선행사 O + 불완전한 절)", "관계부사 (선행사 O + 완전한 절)", "동격 that (선행사 O + 완전한 절)", "접속사 that (선행사 X + 완전한 절)"]
      },
      {
        sentence: "The car (___) engine was making a strange noise broke down.",
        explanation: "선행사: The car / 뒤 절: 주어(engine)의 소유주가 선행사 / 정답 이유: 소유격 관계대명사 whose",
        type: "A",
        choices: ["whose", "who", "which", "that"]
      }
    ]
  },
  { 
    word: "관계부사", 
    meaning: "선행사 O + 완전한 절 (장소/시간/이유/방법)", 
    pattern: "rel-adverb",
    examples: [
      {
        sentence: "I still remember the winter (___) it snowed so much that we couldn't leave the house.",
        explanation: "선행사: the winter (시간) / 뒤 절: it snowed (완전한 절) / 정답 이유: 관계부사 when",
        type: "A",
        choices: ["when", "where", "which", "how"]
      },
      {
        sentence: "Could you please explain to me (___) you fixed the broken computer by yourself?",
        explanation: "선행사: 없음 / 뒤 절: 완전한 절 / 정답 이유: 방법을 나타내는 관계부사 how (the way와 함께 쓸 수 없음)",
        type: "A",
        choices: ["how", "where", "which", "the way how"]
      },
      {
        sentence: "Is this the reason (___) you were so upset with me yesterday?",
        explanation: "선행사: the reason (이유) / 뒤 절: 완전한 절 / 정답 이유: 이유의 관계부사 why (that으로 대체 가능)",
        type: "A",
        choices: ["that", "which", "how", "who"]
      },
      {
        sentence: "The guide will explain (___) we can reach the top of the mountain safely.",
        explanation: "선행사: 없음 / 뒤 절: 완전한 절 / 정답 이유: '방법'의 의미를 나타내는 관계부사 how",
        type: "A",
        choices: ["how", "where", "which", "when"]
      },
      {
        sentence: "I clearly remember the year [that] the world changed forever due to the event.",
        explanation: "선행사: the year (시간) / 뒤 절: 완전한 절 / 정답 이유: 관계부사 that (when 대용)",
        type: "B",
        choices: ["관계부사 (선행사 O + 완전한 절)", "관계대명사 (선행사 O + 불완전한 절)", "동격 that (선행사 O + 완전한 절)", "접속사 that (선행사 X + 완전한 절)"]
      },
      {
        sentence: "This is the town (___) I was born and raised by my grandparents.",
        explanation: "선행사: the town (장소) / 뒤 절: I was born and raised (완전한 절) / 정답 이유: 장소를 나타내는 관계부사 where",
        type: "A",
        choices: ["where", "when", "which", "that"]
      },
      {
        sentence: "I cannot understand the reason (___) she suddenly decided to leave the company.",
        explanation: "선행사: the reason (이유) / 뒤 절: 완전한 절 / 정답 이유: 이유를 나타내는 관계부사 why",
        type: "A",
        choices: ["why", "which", "where", "how"]
      },
      {
        sentence: "The museum [where] we saw the ancient artifacts was closed for renovation.",
        explanation: "선행사: The museum (장소) / 뒤 절: 완전한 절 / 정답 이유: 관계부사 where",
        type: "B",
        choices: ["관계부사 (선행사 O + 완전한 절)", "관계대명사 (선행사 O + 불완전한 절)", "동격 that (선행사 O + 완전한 절)", "접속사 that (선행사 X + 완전한 절)"]
      },
      {
        sentence: "Autumn is the season [when] the leaves turn red and yellow beautifully.",
        explanation: "선행사: the season (시간) / 뒤 절: 완전한 절 / 정답 이유: 관계부사 when",
        type: "B",
        choices: ["관계부사 (선행사 O + 완전한 절)", "관계대명사 (선행사 O + 불완전한 절)", "동격 that (선행사 O + 완전한 절)", "접속사 that (선행사 X + 완전한 절)"]
      },
      {
        sentence: "Do you know the exact time (___) the school festival is scheduled to start?",
        explanation: "선행사: the exact time (시간) / 뒤 절: 완전한 절 / 정답 이유: 관계부사 when",
        type: "A",
        choices: ["when", "where", "which", "why"]
      },
      {
        sentence: "The developer explained (___) they improved the user interface of the application.",
        explanation: "선행사: 없음 / 뒤 절: 완전한 절 / 정답 이유: '방법'을 나타내는 관계부사 how",
        type: "A",
        choices: ["how", "the way", "which", "where"]
      },
      {
        sentence: "The studio [where] the band recorded their legendary album is now a museum.",
        explanation: "선행사: The studio (장소) / 뒤 절: 완전한 절 / 정답 이유: 관계부사 where",
        type: "B",
        choices: ["관계부사 (선행사 O + 완전한 절)", "관계대명사 (선행사 O + 불완전한 절)", "동격 that (선행사 O + 완전한 절)", "접속사 that (선행사 X + 완전한 절)"]
      },
      {
        sentence: "This is the park (___) my friends and I used to play soccer every weekend.",
        explanation: "선행사: the park (장소) / 뒤 절: 완전한 절 / 정답 이유: 장소를 나타내는 관계부사 where",
        type: "A",
        choices: ["where", "when", "which", "why"]
      },
      {
        sentence: "I can't forget the day (___) I first met my best friend in middle school.",
        explanation: "선행사: the day (시간) / 뒤 절: 완전한 절 / 정답 이유: 시간을 나타내는 관계부사 when",
        type: "A",
        choices: ["when", "where", "who", "which"]
      },
      {
        sentence: "Do you understand the reason [why] he was so late for the important meeting?",
        explanation: "선행사: the reason (이유) / 뒤 절: 완전한 절 / 정답 이유: 관계부사 why",
        type: "B",
        choices: ["관계부사 (선행사 O + 완전한 절)", "관계대명사 (선행사 O + 불완전한 절)", "동격 that (선행사 O + 완전한 절)", "접속사 that (선행사 X + 완전한 절)"]
      },
      {
        sentence: "I want to live in a country [where] the weather is warm all year round.",
        explanation: "선행사: a country (장소) / 뒤 절: 완전한 절 / 정답 이유: 관계부사 where",
        type: "B",
        choices: ["관계부사 (선행사 O + 완전한 절)", "관계대명사 (선행사 O + 불완전한 절)", "동격 that (선행사 O + 완전한 절)", "접속사 that (선행사 X + 완전한 절)"]
      },
      {
        sentence: "Saturday is the day [when] most people enjoy their free time with family.",
        explanation: "선행사: Saturday (시간) / 뒤 절: 완전한 절 / 정답 이유: 관계부사 when",
        type: "B",
        choices: ["관계부사 (선행사 O + 완전한 절)", "관계대명사 (선행사 O + 불완전한 절)", "동격 that (선행사 O + 완전한 절)", "접속사 that (선행사 X + 완전한 절)"]
      },
      {
        sentence: "The library (___) I used to study late at night has been moved across the street.",
        explanation: "선행사: The library (장소) / 뒤 절: I used to study (완전한 절) / 정답 이유: 장소를 나타내는 관계부사 where",
        type: "A",
        choices: ["where", "which", "when", "who"]
      },
      {
        sentence: "The reason [why] some birds migrate to warmer countries in winter is quite complex.",
        explanation: "선행사: The reason (이유) / 뒤 절: 완전한 절 / 정답 이유: 이유의 관계부사 why",
        type: "B",
        choices: ["관계부사 (선행사 O + 완전한 절)", "관계대명사 (선행사 O + 불완전한 절)", "동격 that (선행사 O + 완전한 절)", "접속사 that (선행사 X + 완전한 절)"]
      },
      {
        sentence: "I'll never forget the moment [when] I finally received the acceptance letter.",
        explanation: "선행사: the moment (시간) / 뒤 절: 완전한 절 / 정답 이유: 시간의 관계부사 when",
        type: "B",
        choices: ["관계부사 (선행사 O + 완전한 절)", "관계대명사 (선행사 O + 불완전한 절)", "동격 that (선행사 O + 완전한 절)", "접속사 that (선행사 X + 완전한 절)"]
      },
      {
        sentence: "This is the small town (___) my parents held their wedding ceremony thirty years ago.",
        explanation: "선행사: the small town (장소) / 뒤 절: 완전한 절 / 정답 이유: 장소의 관계부사 where",
        type: "A",
        choices: ["where", "when", "which", "why"]
      },
      {
        sentence: "Could you tell me (___) you managed to solve the mystery so quickly?",
        explanation: "선행사: 없음 / 뒤 절: 완전한 절 / 정답 이유: 방법을 나타내는 관계부사 how",
        type: "A",
        choices: ["how", "the way", "which", "where"]
      },
      {
        sentence: "Tell me the reason (___) you decided to change your major so late.",
        explanation: "선행사: the reason (이유) / 뒤 절: 완전한 절 / 정답 이유: 이유의 관계부사 why",
        type: "A",
        choices: ["why", "where", "which", "who"]
      },
      {
        sentence: "This is the spot [where] our ancestors first settled hundreds of years ago.",
        explanation: "선행사: the spot (장소) / 뒤 절: 완전한 절 / 정답 이유: 장소의 관계부사 where",
        type: "B",
        choices: ["관계부사 (선행사 O + 완전한 절)", "관계대명사 (선행사 O + 불완전한 절)", "동격 that (선행사 O + 완전한 절)", "접속사 that (선행사 X + 완전한 절)"]
      },
      {
        sentence: "I can't wait for the day (___) we can travel to other planets for vacation.",
        explanation: "선행사: the day (시간) / 뒤 절: 완전한 절 / 정답 이유: 시간의 관계부사 when",
        type: "A",
        choices: ["when", "where", "which", "why"]
      },
      {
        sentence: "The way [that] he solved the problem was truly creative and efficient.",
        explanation: "선행사: the way / 뒤 절: 완전한 절 / 정답 이유: 관계부사 that (how 대용)",
        type: "B",
        choices: ["관계부사 (선행사 O + 완전한 절)", "관계대명사 (선행사 O + 불완전한 절)", "동격 that (선행사 O + 완전한 절)", "접속사 that (선행사 X + 완전한 절)"]
      },
      {
        sentence: "The house (___) I spent my childhood has been completely renovated.",
        explanation: "선행사: The house (장소) / 뒤 절: 완전한 절 / 정답 이유: 장소를 나타내는 관계부사 where",
        type: "A",
        choices: ["where", "which", "when", "that"]
      },
      {
        sentence: "Do you remember the night (___) we saw the shooting star?",
        explanation: "선행사: the night (시간) / 뒤 절: 완전한 절 / 정답 이유: 시간의 관계부사 when",
        type: "A",
        choices: ["when", "where", "which", "why"]
      },
      {
        sentence: "This is the restaurant [where] I first met my wife ten years ago.",
        explanation: "선행사: the restaurant (장소) / 뒤 절: 완전한 절 / 정답 이유: 장소의 관계부사 where",
        type: "B",
        choices: ["관계부사 (선행사 O + 완전한 절)", "관계대명사 (선행사 O + 불완전한 절)", "동격 that (선행사 O + 완전한 절)", "접속사 that (선행사 X + 완전한 절)"]
      },
      {
        sentence: "I don't know the reason (___) the meeting was cancelled so suddenly.",
        explanation: "선행사: the reason (이유) / 뒤 절: 완전한 절 / 정답 이유: 이유의 관계부사 why",
        type: "A",
        choices: ["why", "where", "which", "how"]
      },
      {
        sentence: "She showed me (___) she makes this delicious chocolate cake.",
        explanation: "선행사: 없음 / 뒤 절: 완전한 절 / 정답 이유: 방법을 나타내는 관계부사 how",
        type: "A",
        choices: ["how", "the way", "which", "where"]
      },
      {
        sentence: "The island [where] they spent their honeymoon is very peaceful.",
        explanation: "선행사: the island (장소) / 뒤 절: 완전한 절 / 정답 이유: 장소의 관계부사 where",
        type: "B",
        choices: ["관계부사 (선행사 O + 완전한 절)", "관계대명사 (선행사 O + 불완전한 절)", "동격 that (선행사 O + 완전한 절)", "접속사 that (선행사 X + 완전한 절)"]
      },
      {
        sentence: "Can you suggest a place (___) I can find fresh organic vegetables?",
        explanation: "선행사: a place (장소) / 뒤 절: 완전한 절 / 정답 이유: 장소를 나타내는 관계부사 where",
        type: "A",
        choices: ["where", "when", "which", "why"]
      },
      {
        sentence: "I still remember the era [when] people didn't have smartphones or high-speed internet.",
        explanation: "선행사: the era (시간) / 뒤 절: 완전한 절 / 정답 이유: 시간의 관계부사 when",
        type: "B",
        choices: ["관계부사 (선행사 O + 완전한 절)", "관계대명사 (선행사 O + 불완전한 절)", "동격 that (선행사 O + 완전한 절)", "접속사 that (선행사 X + 완전한 절)"]
      },
      {
        sentence: "The reason (___) the prices of goods are rising is due to inflation.",
        explanation: "선행사: the reason (이유) / 뒤 절: 완전한 절 / 정답 이유: 이유의 관계부사 why",
        type: "A",
        choices: ["why", "where", "which", "how"]
      },
      {
        sentence: "Scientists are studying the way [that] dolphins communicate with each other.",
        explanation: "선행사: the way / 뒤 절: 완전한 절 / 정답 이유: 관계부사 that (how 대신 사용)",
        type: "B",
        choices: ["관계부사 (선행사 O + 완전한 절)", "관계대명사 (선행사 O + 불완전한 절)", "동격 that (선행사 O + 완전한 절)", "접속사 that (선행사 X + 완전한 절)"]
      },
      {
        sentence: "This is the hospital (___) my grandfather worked as a surgeon for thirty years.",
        explanation: "선행사: the hospital (장소) / 뒤 절: 완전한 절 / 정답 이유: 장소의 관계부사 where",
        type: "A",
        choices: ["where", "which", "when", "that"]
      },
      {
        sentence: "I'll never forget the house (___) I grew up.",
        explanation: "선행사: the house (장소) / 뒤 절: I grew up (완전한 절) / 정답 이유: 장소의 관계부사 where",
        type: "A",
        choices: ["where", "which", "when", "why"]
      },
      {
        sentence: "Sunday is the day [when] I usually clean my entire apartment.",
        explanation: "선행사: Sunday (시간) / 뒤 절: 완전한 절 / 정답 이유: 시간의 관계부사 when",
        type: "B",
        choices: ["관계부사 (선행사 O + 완전한 절)", "관계대명사 (선행사 O + 불완전한 절)", "동격 that (선행사 O + 완전한 절)", "접속사 that (선행사 X + 완전한 절)"]
      },
      {
        sentence: "The reason (___) he didn't call remains a mystery.",
        explanation: "선행사: The reason (이유) / 뒤 절: 완전한 절 / 정답 이유: 이유의 관계부사 why",
        type: "A",
        choices: ["why", "where", "which", "how"]
      },
      {
        sentence: "Scientists are exploring the way [that] dolphins communicate with each other.",
        explanation: "선행사: the way / 뒤 절: 완전한 절 / 정답 이유: 관계부사 that (how 대용)",
        type: "B",
        choices: ["관계부사 (선행사 O + 완전한 절)", "관계대명사 (선행사 O + 불완전한 절)", "동격 that (선행사 O + 완전한 절)", "접속사 that (선행사 X + 완전한 절)"]
      },
      {
        sentence: "This is the office (___) my father has worked for twenty years.",
        explanation: "선행사: the office (장소) / 뒤 절: 완전한 절 / 정답 이유: 장소의 관계부사 where",
        type: "A",
        choices: ["where", "which", "when", "that"]
      }
    ]
  },
  { 
    word: "동격 that", 
    meaning: "선행사(추상명사) O + 완전한 절", 
    pattern: "appositive",
    examples: [
      {
        sentence: "The news (___) he had successfully climbed Mt. Everest surprised the world.",
        explanation: "선행사: The news (추상명사) / 뒤 절: he had successfully climbed Mt. Everest (완전한 절) / 정답 이유: 내용을 설명하는 동격의 that",
        type: "A",
        choices: ["that", "which", "where", "when"]
      },
      {
        sentence: "The possibility [that] life exists on other planets has always fascinated scientists.",
        explanation: "선행사: The possibility (추상명사) / 뒤 절: 완전한 절 / 정답 이유: 동격의 that",
        type: "B",
        choices: ["동격 that (선행사 O + 완전한 절)", "관계대명사 (선행사 O + 불완전한 절)", "관계부사 (선행사 O + 완전한 절)", "접속사 that (선행사 X + 완전한 절)"]
      },
      {
        sentence: "We need more evidence (___) the global temperature is rising every year.",
        explanation: "선행사: evidence (추상명사) / 뒤 절: 완전한 절 / 정답 이유: 사실을 보충 설명하는 동격의 that",
        type: "A",
        choices: ["that", "which", "where", "what"]
      },
      {
        sentence: "The fact [that] everyone arrived on time for the meeting was quite a relief.",
        explanation: "선행사: The fact (추상명사) / 뒤 절: 완전한 절 / 정답 이유: 동격의 that",
        type: "B",
        choices: ["동격 that (선행사 O + 완전한 절)", "관계대명사 (선행사 O + 불완전한 절)", "관계부사 (선행사 O + 완전한 절)", "접속사 that (선행사 X + 완전한 절)"]
      },
      {
        sentence: "The idea (___) we should work together on this environmentally friendly project is great.",
        explanation: "선행사: The idea (추상명사) / 뒤 절: 완전한 절 / 정답 이유: 내용을 설명하는 동격의 that",
        type: "A",
        choices: ["that", "which", "where", "how"]
      },
      {
        sentence: "The belief [that] hard work eventually pays off is common among successful athletes.",
        explanation: "선행사: The belief (추상명사) / 뒤 절: 완전한 절 / 정답 이유: 동격의 that",
        type: "B",
        choices: ["동격 that (선행사 O + 완전한 절)", "관계대명사 (선행사 O + 불완전한 절)", "관계부사 (선행사 O + 완전한 절)", "접속사 that (선행사 X + 완전한 절)"]
      },
      {
        sentence: "I mentioned the fact [that] I would be away from the office for a few days.",
        explanation: "선행사: the fact (추상명사) / 뒤 절: 완전한 절 / 정답 이유: 동격의 that",
        type: "B",
        choices: ["동격 that (선행사 O + 완전한 절)", "관계대명사 (선행사 O + 불완전한 절)", "관계부사 (선행사 O + 완전한 절)", "접속사 that (선행사 X + 완전한 절)"]
      },
      {
        sentence: "There is no doubt (___) she will pass the final exam with flying colors.",
        explanation: "선행사: doubt (추상명사) / 뒤 절: 완전한 절 / 정답 이유: 동격의 that",
        type: "A",
        choices: ["that", "which", "where", "whether"]
      },
      {
        sentence: "I was surprised by the news [that] the concert had been canceled suddenly.",
        explanation: "선행사: the news (추상명사) / 뒤 절: 완전한 절 / 정답 이유: 동격의 that",
        type: "B",
        choices: ["동격 that (선행사 O + 완전한 절)", "관계대명사 (선행사 O + 불완전한 절)", "관계부사 (선행사 O + 완전한 절)", "접속사 that (선행사 X + 완전한 절)"]
      },
      {
        sentence: "He didn't lose his hope (___) his team would eventually win the championship.",
        explanation: "선행사: hope (추상명사) / 뒤 절: 완전한 절 / 정답 이유: 동격의 that",
        type: "A",
        choices: ["that", "which", "how", "where"]
      },
      {
        sentence: "The rumor [that] the famous actor would visit our school was actually true.",
        explanation: "선행사: the rumor (추상명사) / 뒤 절: 완전한 절 / 정답 이유: 동격의 that",
        type: "B",
        choices: ["동격 that (선행사 O + 완전한 절)", "관계대명사 (선행사 O + 불완전한 절)", "관계부사 (선행사 O + 완전한 절)", "접속사 that (선행사 X + 완전한 절)"]
      },
      {
        sentence: "We reached a conclusion [that] we should start the project as soon as possible.",
        explanation: "선행사: conclusion (추상명사) / 뒤 절: 완전한 절 / 정답 이유: 동격의 that",
        type: "B",
        choices: ["동격 that (선행사 O + 완전한 절)", "관계대명사 (선행사 O + 불완전한 절)", "관계부사 (선행사 O + 완전한 절)", "접속사 that (선행사 X + 완전한 절)"]
      },
      {
        sentence: "The suggestion [that] we should go on a picnic this weekend was accepted by all.",
        explanation: "선행사: The suggestion (추상명사) / 뒤 절: 완전한 절 / 정답 이유: 동격의 that",
        type: "B",
        choices: ["동격 that (선행사 O + 완전한 절)", "관계대명사 (선행사 O + 불완전한 절)", "관계부사 (선행사 O + 완전한 절)", "접속사 that (선행사 X + 완전한 절)"]
      },
      {
        sentence: "There is constant pressure (___) students should achieve top grades in all subjects.",
        explanation: "선행사: pressure (추상명사) / 뒤 절: 완전한 절 / 정답 이유: 동격의 that",
        type: "A",
        choices: ["that", "which", "whether", "how"]
      },
      {
        sentence: "The impression [that] he was not fully prepared for the interview was very strong.",
        explanation: "선행사: The impression (추상명사) / 뒤 절: 완전한 절 / 정답 이유: 동격의 that",
        type: "B",
        choices: ["동격 that (선행사 O + 완전한 절)", "관계대명사 (선행사 O + 불완전한 절)", "관계부사 (선행사 O + 완전한 절)", "접속사 that (선행사 X + 완전한 절)"]
      },
      {
        sentence: "We must ignore the rumors (___) the famous company will shut down next month.",
        explanation: "선행사: rumors (추상명사) / 뒤 절: 완전한 절 / 정답 이유: 동격의 that",
        type: "A",
        choices: ["that", "which", "where", "why"]
      },
      {
        sentence: "The concept [that] time is relative changed our fundamental understanding of physics.",
        explanation: "선행사: The concept (추상명사) / 뒤 절: 완전한 절 / 정답 이유: 동격의 that",
        type: "B",
        choices: ["동격 that (선행사 O + 완전한 절)", "관계대명사 (선행사 O + 불완전한 절)", "관계부사 (선행사 O + 완전한 절)", "접속사 that (선행사 X + 완전한 절)"]
      },
      {
        sentence: "The belief [that] everyone is equal regardless of their background is central to democracy.",
        explanation: "선행사: The belief (추상명사) / 뒤 절: 완전한 절 / 정답 이유: 동격의 that",
        type: "B",
        choices: ["동격 that (선행사 O + 완전한 절)", "관계대명사 (선행사 O + 불완전한 절)", "관계부사 (선행사 O + 완전한 절)", "접속사 that (선행사 X + 완전한 절)"]
      },
      {
        sentence: "The news (___) the missing plane was found brought great relief to the families.",
        explanation: "선행사: The news (추상명사) / 뒤 절: 완전한 절 / 정답 이유: 동격의 that",
        type: "A",
        choices: ["that", "which", "where", "when"]
      },
      {
        sentence: "The warning [that] a major earthquake might occur soon was taken very seriously.",
        explanation: "선행사: The warning (추상명사) / 뒤 절: 완전한 절 / 정답 이유: 동격의 that",
        type: "B",
        choices: ["동격 that (선행사 O + 완전한 절)", "관계대명사 (선행사 O + 불완전한 절)", "관계부사 (선행사 O + 완전한 절)", "접속사 that (선행사 X + 완전한 절)"]
      },
      {
        sentence: "The fact (___) water freezes at zero degrees Celsius is a basic scientific principle.",
        explanation: "선행사: The fact (추상명사) / 뒤 절: 완전한 절 / 정답 이유: 동격의 that",
        type: "A",
        choices: ["that", "which", "how", "what"]
      },
      {
        sentence: "The rumor [that] the company is planning a massive layoff spread quickly.",
        explanation: "선행사: the rumor (추상명사) / 뒤 절: 완전한 절 / 정답 이유: 동격의 that",
        type: "B",
        choices: ["동격 that (선행사 O + 완전한 절)", "관계대명사 (선행사 O + 불완전한 절)", "관계부사 (선행사 O + 완전한 절)", "접속사 that (선행사 X + 완전한 절)"]
      },
      {
        sentence: "The possibility (___) oil prices will drop soon is very low.",
        explanation: "선행사: The possibility (추상명사) / 뒤 절: 완전한 절 / 정답 이유: 동격의 that",
        type: "A",
        choices: ["that", "which", "where", "whether"]
      },
      {
        sentence: "We share the common belief [that] education can change one's life.",
        explanation: "선행사: the belief (추상명사) / 뒤 절: 완전한 절 / 정답 이유: 동격의 that",
        type: "B",
        choices: ["동격 that (선행사 O + 완전한 절)", "관계대명사 (선행사 O + 불완전한 절)", "관계부사 (선행사 O + 완전한 절)", "접속사 that (선행사 X + 완전한 절)"]
      },
      {
        sentence: "The news [that] the war had finally ended spread like wildfire.",
        explanation: "선행사: the news (추상명사) / 뒤 절: 완전한 절 / 정답 이유: 동격의 that",
        type: "B",
        choices: ["동격 that (선행사 O + 완전한 절)", "관계대명사 (선행사 O + 불완전한 절)", "관계부사 (선행사 O + 완전한 절)", "접속사 that (선행사 X + 완전한 절)"]
      },
      {
        sentence: "Scientists are investigating the fact (___) global warming is accelerating.",
        explanation: "선행사: the fact (추상명사) / 뒤 절: 완전한 절 / 정답 이유: 동격의 that",
        type: "A",
        choices: ["that", "which", "how", "what"]
      },
      {
        sentence: "The suggestion [that] we should delay the project was rejected.",
        explanation: "선행사: the suggestion (추상명사) / 뒤 절: 완전한 절 / 정답 이유: 동격의 that",
        type: "B",
        choices: ["동격 that (선행사 O + 완전한 절)", "관계대명사 (선행사 O + 불완전한 절)", "관계부사 (선행사 O + 완전한 절)", "접속사 that (선행사 X + 완전한 절)"]
      },
      {
        sentence: "The assumption (___) money alone can bring happiness is often proven wrong.",
        explanation: "선행사: The assumption (추상명사) / 뒤 절: 완전한 절 / 정답 이유: 동격의 that",
        type: "A",
        choices: ["that", "which", "where", "how"]
      },
      {
        sentence: "I was moved by the story [that] he gave all his savings to the orphanage.",
        explanation: "선행사: the story (추상명사) / 뒤 절: 완전한 절 / 정답 이유: 동격의 that",
        type: "B",
        choices: ["동격 that (선행사 O + 완전한 절)", "관계대명사 (선행사 O + 불완전한 절)", "관계부사 (선행사 O + 완전한 절)", "접속사 that (선행사 X + 완전한 절)"]
      },
      {
        sentence: "There is a general consensus (___) we need to reduce carbon emissions immediately.",
        explanation: "선행사: consensus (추상명사) / 뒤 절: 완전한 절 / 정답 이유: 동격의 that",
        type: "A",
        choices: ["that", "which", "whether", "why"]
      },
      {
        sentence: "The evidence [that] the suspect was at the scene of the crime was undeniable.",
        explanation: "선행사: The evidence (추상명사) / 뒤 절: 완전한 절 / 정답 이유: 동격의 that",
        type: "B",
        choices: ["동격 that (선행사 O + 완전한 절)", "관계대명사 (선행사 O + 불완전한 절)", "관계부사 (선행사 O + 완전한 절)", "접속사 that (선행사 X + 완전한 절)"]
      },
      {
        sentence: "My father never lost his faith (___) justice would eventually prevail in the case.",
        explanation: "선행사: faith (추상명사) / 뒤 절: 완전한 절 / 정답 이유: 동격의 that",
        type: "A",
        choices: ["that", "which", "how", "where"]
      },
      {
        sentence: "The belief (___) the soul is immortal is found in many cultures.",
        explanation: "선행사: The belief (추상명사) / 뒤 절: 완전한 절 / 정답 이유: 동격의 that",
        type: "A",
        choices: ["that", "which", "where", "how"]
      },
      {
        sentence: "I cannot ignore the feeling [that] something is not quite right.",
        explanation: "선행사: the feeling (추상명사) / 뒤 절: 완전한 절 / 정답 이유: 동격의 that",
        type: "B",
        choices: ["동격 that (선행사 O + 완전한 절)", "관계대명사 (선행사 O + 불완전한 절)", "관계부사 (선행사 O + 완전한 절)", "접속사 that (선행사 X + 완전한 절)"]
      },
      {
        sentence: "The news (___) the missing child was found safe brought tears to my eyes.",
        explanation: "선행사: The news (추상명사) / 뒤 절: 완전한 절 / 정답 이유: 동격의 that",
        type: "A",
        choices: ["that", "which", "where", "when"]
      },
      {
        sentence: "He was motivated by the hope [that] he could make a difference in the world.",
        explanation: "선행사: the hope (추상명사) / 뒤 절: 완전한 절 / 정답 이유: 동격의 that",
        type: "B",
        choices: ["동격 that (선행사 O + 완전한 절)", "관계대명사 (선행사 O + 불완전한 절)", "관계부사 (선행사 O + 완전한 절)", "접속사 that (선행사 X + 완전한 절)"]
      },
      {
        sentence: "The fact (___) she apologized doesn't mean I have to forgive her.",
        explanation: "선행사: the fact (추상명사) / 뒤 절: 완전한 절 / 정답 이유: 동격의 that",
        type: "A",
        choices: ["that", "which", "how", "what"]
      }
    ]
  },
  { 
    word: "접속사 that", 
    meaning: "선행사 X + 완전한 절", 
    pattern: "conjunction",
    examples: [
      {
        sentence: "I strongly believe [that] practicing English every day is the best way to improve.",
        explanation: "선행사: 없음 (believe의 목적어) / 뒤 절: 완전한 절 / 정답 이유: 접속사 that",
        type: "B",
        choices: ["접속사 that (선행사 X + 완전한 절)", "관계대명사 (선행사 O + 불완전한 절)", "관계부사 (선행사 O + 완전한 절)", "동격 that (선행사 O + 완전한 절)"]
      },
      {
        sentence: "I truly hope [that] your dream of becoming a scientist comes true.",
        explanation: "선행사: 없음 (hope의 목적어) / 뒤 절: 완전한 절 / 정답 이유: 접속사 that",
        type: "B",
        choices: ["접속사 that (선행사 X + 완전한 절)", "관계대명사 (선행사 O + 불완전한 절)", "관계부사 (선행사 O + 완전한 절)", "동격 that (선행사 O + 완전한 절)"]
      },
      {
        sentence: "I was so glad [that] you and your family could come to my birthday party.",
        explanation: "선행사: 없음 (형용사 glad 뒤) / 뒤 절: 완전한 절 / 정답 이유: 접속사 that",
        type: "B",
        choices: ["접속사 that (선행사 X + 완전한 절)", "관계대명사 (선행사 O + 불완전한 절)", "관계부사 (선행사 O + 완전한 절)", "동격 that (선행사 O + 완전한 절)"]
      },
      {
        sentence: "Our teacher said (___) we should submit the report by next Friday.",
        explanation: "선행사: 없음 (said의 목적어) / 뒤 절: 완전한 절 / 정답 이유: 접속사 that",
        type: "A",
        choices: ["that", "which", "who", "whose"]
      },
      {
        sentence: "It is true (___) regular exercise is essential for maintaining good health.",
        explanation: "선행사: 없음 (가주어 It의 진주어 절) / 뒤 절: 완전한 절 / 정답 이유: 접속사 that",
        type: "A",
        choices: ["that", "which", "whether", "where"]
      },
      {
        sentence: "Scientists found [that] small changes in habits can lead to great results.",
        explanation: "선행사: 없음 (found의 목적어) / 뒤 절: 완전한 절 / 정답 이유: 접속사 that",
        type: "B",
        choices: ["접속사 that (선행사 X + 완전한 절)", "관계대명사 (선행사 O + 불완전한 절)", "관계부사 (선행사 O + 완전한 절)", "동격 that (선행사 O + 완전한 절)"]
      },
      {
        sentence: "My parents promised [that] they would take me to the amusement park.",
        explanation: "선행사: 없음 (promised의 목적어) / 뒤 절: 완전한 절 / 정답 이유: 접속사 that",
        type: "B",
        choices: ["접속사 that (선행사 X + 완전한 절)", "관계대명사 (선행사 O + 불완전한 절)", "관계부사 (선행사 O + 완전한 절)", "동격 that (선행사 O + 완전한 절)"]
      },
      {
        sentence: "I am very certain [that] technology will continue to change our lives.",
        explanation: "선행사: 없음 (certain 뒤 목적절) / 뒤 절: 완전한 절 / 정답 이유: 접속사 that",
        type: "B",
        choices: ["접속사 that (선행사 X + 완전한 절)", "관계대명사 (선행사 O + 불완전한 절)", "관계부사 (선행사 O + 완전한 절)", "동격 that (선행사 O + 완전한 절)"]
      },
      {
        sentence: "The teacher noticed [that] several students were not focusing on the lesson.",
        explanation: "선행사: 없음 (noticed의 목적어) / 뒤 절: 완전한 절 / 정답 이유: 접속사 that",
        type: "B",
        choices: ["접속사 that (선행사 X + 완전한 절)", "관계대명사 (선행사 O + 불완전한 절)", "관계부사 (선행사 O + 완전한 절)", "동격 that (선행사 O + 완전한 절)"]
      },
      {
        sentence: "It was quite obvious (___) the team had practiced very hard for the match.",
        explanation: "선행사: 없음 (가주어 It의 진주어 절) / 뒤 절: 완전한 절 / 정답 이유: 접속사 that",
        type: "A",
        choices: ["that", "which", "what", "whether"]
      },
      {
        sentence: "My dream is [that] I will eventually build a peaceful house in the countryside.",
        explanation: "선행사: 없음 (be동사 is의 보어절) / 뒤 절: 완전한 절 / 정답 이유: 접속사 that",
        type: "B",
        choices: ["접속사 that (선행사 X + 완전한 절)", "관계대명사 (선행사 O + 불완전한 절)", "관계부사 (선행사 O + 완전한 절)", "동격 that (선행사 O + 완전한 절)"]
      },
      {
        sentence: "The report suggests (___) we should increase our efficiency next year.",
        explanation: "선행사: 없음 (suggests의 목적어) / 뒤 절: 완전한 절 / 정답 이유: 접속사 that",
        type: "A",
        choices: ["that", "which", "where", "how"]
      },
      {
        sentence: "We found out [that] the restaurant we wanted to visit is closed today.",
        explanation: "선행사: 없음 (found out의 목적어) / 뒤 절: 완전한 절 / 정답 이유: 접속사 that",
        type: "B",
        choices: ["접속사 that (선행사 X + 완전한 절)", "관계대명사 (선행사 O + 불완전한 절)", "관계부사 (선행사 O + 완전한 절)", "동격 that (선행사 O + 완전한 절)"]
      },
      {
        sentence: "I believe [that] honesty is the best policy in any relationship.",
        explanation: "선행사: 없음 (believe의 목적어) / 뒤 절: 완전한 절 / 정답 이유: 접속사 that",
        type: "B",
        choices: ["접속사 that (선행사 X + 완전한 절)", "관계대명사 (선행사 O + 불완전한 절)", "관계부사 (선행사 O + 완전한 절)", "동격 that (선행사 O + 완전한 절)"]
      },
      {
        sentence: "The teacher suggested (___) we should read at least one English book a month.",
        explanation: "선행사: 없음 (목적어 절) / 뒤 절: 완전한 절 / 정답 이유: 접속사 that",
        type: "A",
        choices: ["that", "which", "where", "how"]
      },
      {
        sentence: "Most people think [that] AI will significantly change the way we work.",
        explanation: "선행사: 없음 (think의 목적어) / 뒤 절: 완전한 절 / 정답 이유: 접속사 that",
        type: "B",
        choices: ["접속사 that (선행사 X + 완전한 절)", "관계대명사 (선행사 O + 불완전한 절)", "관계부사 (선행사 O + 완전한 절)", "동격 that (선행사 O + 완전한 절)"]
      },
      {
        sentence: "It is important (___) you keep your personal information safe online.",
        explanation: "선행사: 없음 (가주어 It의 진주어 절) / 뒤 절: 완전한 절 / 정답 이유: 접속사 that",
        type: "A",
        choices: ["that", "which", "whether", "what"]
      },
      {
        sentence: "I forgot [that] I had an appointment with the dentist this afternoon.",
        explanation: "선행사: 없음 (forgot의 목적어) / 뒤 절: 완전한 절 / 정답 이유: 접속사 that",
        type: "B",
        choices: ["접속사 that (선행사 X + 완전한 절)", "관계대명사 (선행사 O + 불완전한 절)", "관계부사 (선행사 O + 완전한 절)", "동격 that (선행사 O + 완전한 절)"]
      },
      {
        sentence: "I am sure (___) you will find a way to overcome this challenge.",
        explanation: "선행사: 없음 (형용사 sure 뒤 목적절) / 뒤 절: 완전한 절 / 정답 이유: 접속사 that",
        type: "A",
        choices: ["that", "which", "how", "what"]
      },
      {
        sentence: "The doctor advised [that] he should take a rest for at least a week.",
        explanation: "선행사: 없음 (advised의 목적어) / 뒤 절: 완전한 절 / 정답 이유: 접속사 that",
        type: "B",
        choices: ["접속사 that (선행사 X + 완전한 절)", "관계대명사 (선행사 O + 불완전한 절)", "관계부사 (선행사 O + 완전한 절)", "동격 that (선행사 O + 완전한 절)"]
      },
      {
        sentence: "It is surprising [that] she finished such a huge project in a day.",
        explanation: "선행사: 없음 (가주어 It의 진주어 절) / 뒤 절: 완전한 절 / 정답 이유: 접속사 that",
        type: "B",
        choices: ["접속사 that (선행사 X + 완전한 절)", "관계대명사 (선행사 O + 불완전한 절)", "관계부사 (선행사 O + 완전한 절)", "동격 that (선행사 O + 완전한 절)"]
      },
      {
        sentence: "I hope (___) everyone enjoys the party tonight.",
        explanation: "선행사: 없음 (hope의 목적어) / 뒤 절: 완전한 절 / 정답 이유: 접속사 that",
        type: "A",
        choices: ["that", "which", "where", "how"]
      },
      {
        sentence: "He admitted [that] he had made a serious mistake in the report.",
        explanation: "선행사: 없음 (admitted의 목적어) / 뒤 절: 완전한 절 / 정답 이유: 접속사 that",
        type: "B",
        choices: ["접속사 that (선행사 X + 완전한 절)", "관계대명사 (선행사 O + 불완전한 절)", "관계부사 (선행사 O + 완전한 절)", "동격 that (선행사 O + 완전한 절)"]
      },
      {
        sentence: "My manager promised (___) the new project would be funded by next month.",
        explanation: "선행사: 없음 (promised의 목적어) / 뒤 절: 완전한 절 / 정답 이유: 접속사 that",
        type: "A",
        choices: ["that", "which", "where", "what"]
      },
      {
        sentence: "It is vital [that] medical equipment is sterilized properly before use.",
        explanation: "선행사: 없음 (가주어 It의 진주어 절) / 뒤 절: 완전한 절 / 정답 이유: 접속사 that",
        type: "B",
        choices: ["접속사 that (선행사 X + 완전한 절)", "관계대명사 (선행사 O + 불완전한 절)", "관계부사 (선행사 O + 완전한 절)", "동격 that (선행사 O + 완전한 절)"]
      },
      {
        sentence: "I am convinced (___) we have made the right decision for the company.",
        explanation: "선행사: 없음 (형용사 convinced 뒤 절) / 뒤 절: 완전한 절 / 정답 이유: 접속사 that",
        type: "A",
        choices: ["that", "which", "how", "what"]
      },
      {
        sentence: "The weather forecast predicted [that] it would rain heavily throughout the weekend.",
        explanation: "선행사: 없음 (predicted의 목적어) / 뒤 절: 완전한 절 / 정답 이유: 접속사 that",
        type: "B",
        choices: ["접속사 that (선행사 X + 완전한 절)", "관계대명사 (선행사 O + 불완전한 절)", "관계부사 (선행사 O + 완전한 절)", "동격 that (선행사 O + 완전한 절)"]
      },
      {
        sentence: "I really regret (___) I didn't take that job offer when I had the chance.",
        explanation: "선행사: 없음 (regret의 목적어) / 뒤 절: 완전한 절 / 정답 이유: 접속사 that",
        type: "A",
        choices: ["that", "which", "where", "how"]
      },
      {
        sentence: "I believe (___) everyone has a unique talent to share.",
        explanation: "선행사: 없음 (believe의 목적어) / 뒤 절: 완전한 절 / 정답 이유: 접속사 that",
        type: "A",
        choices: ["that", "which", "where", "how"]
      },
      {
        sentence: "It is natural [that] parents worry about their children's future.",
        explanation: "선행사: 없음 (가주어 It의 진주어 절) / 뒤 절: 완전한 절 / 정답 이유: 접속사 that",
        type: "B",
        choices: ["접속사 that (선행사 X + 완전한 절)", "관계대명사 (선행사 O + 불완전한 절)", "관계부사 (선행사 O + 완전한 절)", "동격 that (선행사 O + 완전한 절)"]
      },
      {
        sentence: "She mentioned (___) she would be late for the dinner.",
        explanation: "선행사: 없음 (목적어 절) / 뒤 절: 완전한 절 / 정답 이유: 접속사 that",
        type: "A",
        choices: ["that", "which", "where", "how"]
      },
      {
        sentence: "I am so glad [that] the weather finally cleared up for our trip.",
        explanation: "선행사: 없음 (형용사 glad 뒤 부사절) / 뒤 절: 완전한 절 / 정답 이유: 접속사 that",
        type: "B",
        choices: ["접속사 that (선행사 X + 완전한 절)", "관계대명사 (선행사 O + 불완전한 절)", "관계부사 (선행사 O + 완전한 절)", "동격 that (선행사 O + 완전한 절)"]
      },
      {
        sentence: "The study suggests (___) getting enough sleep is crucial for memory.",
        explanation: "선행사: 없음 (suggests의 목적어) / 뒤 절: 완전한 절 / 정답 이유: 접속사 that",
        type: "A",
        choices: ["that", "which", "where", "what"]
      }
    ]
  }
];

export async function seedRelativeGrammar() {
  if ((window as any)._relativeSeeded) return;
  (window as any)._relativeSeeded = true;

  const wordbooksRef = collection(db, 'wordbooks');
  const q = query(wordbooksRef, where('type', '==', 'relative-grammar'));
  const snapshot = await getDocs(q);

  let wordbookId: string;

  if (snapshot.empty) {
    const docRef = await addDoc(wordbooksRef, {
      title: '관계사(that/which/관계부사)',
      description: '관계대명사, 관계부사, 동격/접속사 that의 쓰임을 구별합니다.',
      createdBy: 'system',
      isPublic: true,
      type: 'relative-grammar',
      category: 'grammar',
      createdAt: Timestamp.now(),
      order: 2
    });
    wordbookId = docRef.id;
  } else {
    wordbookId = snapshot.docs[0].id;
  }

  const wordsRef = collection(db, `wordbooks/${wordbookId}/words`);
  const existingWordsSnap = await getDocs(wordsRef);
  
  // 1. Delete outdated concepts (words that are not in the new RELATIVE_GRAMMAR_CONCEPTS list)
  const currentConceptNames = RELATIVE_GRAMMAR_CONCEPTS.map(c => c.word);
  for (const docSnap of existingWordsSnap.docs) {
    const wordData = docSnap.data();
    if (!currentConceptNames.includes(wordData.word)) {
      // In a real production app we might archive instead of delete, 
      // but here we sync to the code definitions.
      await deleteDoc(doc(db, `wordbooks/${wordbookId}/words`, docSnap.id));
    }
  }

  // 2. Update/Add the current main concepts and their examples
  for (let i = 0; i < RELATIVE_GRAMMAR_CONCEPTS.length; i++) {
    const concept = RELATIVE_GRAMMAR_CONCEPTS[i];
    const conceptQuery = query(wordsRef, where('word', '==', concept.word));
    const conceptSnap = await getDocs(conceptQuery);
    
    let conceptId: string;
    if (conceptSnap.empty) {
      const docRef = await addDoc(wordsRef, {
        word: concept.word,
        meaning: concept.meaning,
        pattern: concept.pattern,
        order: i
      });
      conceptId = docRef.id;
    } else {
      conceptId = conceptSnap.docs[0].id;
      await setDoc(doc(db, `wordbooks/${wordbookId}/words`, conceptId), {
        word: concept.word,
        meaning: concept.meaning,
        pattern: concept.pattern,
        order: i
      }, { merge: true });
    }

    // Add examples to subcollection if they don't exist
    const examplesRef = collection(db, `wordbooks/${wordbookId}/words/${conceptId}/examples`);
    
    for (const ex of concept.examples) {
      const exQuery = query(examplesRef, where('sentence', '==', ex.sentence));
      const exSnap = await getDocs(exQuery);
      
      if (exSnap.empty) {
        await addDoc(examplesRef, {
          sentence: ex.sentence,
          explanation: ex.explanation,
          type: ex.type, // A or B
          choices: ex.choices,
          createdAt: Timestamp.now()
        });
      }
    }
  }
}
