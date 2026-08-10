import { collection, addDoc, Timestamp, query, where, getDocs, doc, setDoc, writeBatch } from 'firebase/firestore';
import { db } from './firebase';

export interface ComparativeItem {
  base: string;
  comparative: string;
  superlative: string;
  meaning: string;
}

export const comparativeData: ComparativeItem[] = [
  { base: 'close', comparative: 'closer', superlative: 'closest', meaning: '가까운' },
  { base: 'fine', comparative: 'finer', superlative: 'finest', meaning: '좋은, 미세한' },
  { base: 'large', comparative: 'larger', superlative: 'largest', meaning: '큰' },
  { base: 'wide', comparative: 'wider', superlative: 'widest', meaning: '넓은' },
  { base: 'wise', comparative: 'wiser', superlative: 'wisest', meaning: '현명한' },
  { base: 'beautiful', comparative: 'more beautiful', superlative: 'most beautiful', meaning: '아름다운' },
  { base: 'difficult', comparative: 'more difficult', superlative: 'most difficult', meaning: '어려운' },
  { base: 'expensive', comparative: 'more expensive', superlative: 'most expensive', meaning: '비싼' },
  { base: 'famous', comparative: 'more famous', superlative: 'most famous', meaning: '유명한' },
  { base: 'important', comparative: 'more important', superlative: 'most important', meaning: '중요한' },
  { base: 'interesting', comparative: 'more interesting', superlative: 'most interesting', meaning: '흥미로운' },
  { base: 'slowly', comparative: 'more slowly', superlative: 'most slowly', meaning: '느리게' },
  { base: 'useful', comparative: 'more useful', superlative: 'most useful', meaning: '유용한' },
  { base: 'useless', comparative: 'more useless', superlative: 'most useless', meaning: '쓸모없는' },
  { base: 'busy', comparative: 'busier', superlative: 'busiest', meaning: '바쁜' },
  { base: 'early', comparative: 'earlier', superlative: 'earliest', meaning: '이른, 일찍' },
  { base: 'easy', comparative: 'easier', superlative: 'easiest', meaning: '쉬운' },
  { base: 'happy', comparative: 'happier', superlative: 'happiest', meaning: '행복한' },
  { base: 'heavy', comparative: 'heavier', superlative: 'heaviest', meaning: '무거운' },
  { base: 'pretty', comparative: 'prettier', superlative: 'prettiest', meaning: '예쁜' },
  { base: 'bright', comparative: 'brighter', superlative: 'brightest', meaning: '밝은' },
  { base: 'cheap', comparative: 'cheaper', superlative: 'cheapest', meaning: '값이 싼' },
  { base: 'clever', comparative: 'cleverer', superlative: 'cleverest', meaning: '영리한' },
  { base: 'cold', comparative: 'colder', superlative: 'coldest', meaning: '추운, 차가운' },
  { base: 'cool', comparative: 'cooler', superlative: 'coolest', meaning: '시원한, 멋진' },
  { base: 'dark', comparative: 'darker', superlative: 'darkest', meaning: '어두운' },
  { base: 'deep', comparative: 'deeper', superlative: 'deepest', meaning: '깊은' },
  { base: 'fast', comparative: 'faster', superlative: 'fastest', meaning: '빠른, 빨리' },
  { base: 'few', comparative: 'fewer', superlative: 'fewest', meaning: '적은 (셀 수 있는 명사/수)' },
  { base: 'hard', comparative: 'harder', superlative: 'hardest', meaning: '열심히, 어려운, 단단한' },
  { base: 'high', comparative: 'higher', superlative: 'highest', meaning: '높은' },
  { base: 'light', comparative: 'lighter', superlative: 'lightest', meaning: '가벼운, 밝은' },
  { base: 'long', comparative: 'longer', superlative: 'longest', meaning: '길이가 긴' },
  { base: 'low', comparative: 'lower', superlative: 'lowest', meaning: '낮은' },
  { base: 'narrow', comparative: 'narrower', superlative: 'narrowest', meaning: '좁은' },
  { base: 'new', comparative: 'newer', superlative: 'newest', meaning: '새로운' },
  { base: 'old', comparative: 'older', superlative: 'oldest', meaning: '낡은, 늙은' },
  { base: 'short', comparative: 'shorter', superlative: 'shortest', meaning: '짧은' },
  { base: 'slow', comparative: 'slower', superlative: 'slowest', meaning: '느린' },
  { base: 'small', comparative: 'smaller', superlative: 'smallest', meaning: '작은' },
  { base: 'smart', comparative: 'smarter', superlative: 'smartest', meaning: '영리한, 똑똑한' },
  { base: 'strong', comparative: 'stronger', superlative: 'strongest', meaning: '힘이 센, 강한' },
  { base: 'tall', comparative: 'taller', superlative: 'tallest', meaning: '키가 큰' },
  { base: 'warm', comparative: 'warmer', superlative: 'warmest', meaning: '따뜻한' },
  { base: 'weak', comparative: 'weaker', superlative: 'weakest', meaning: '약한' },
  { base: 'young', comparative: 'younger', superlative: 'youngest', meaning: '어린, 젊은' },
  { base: 'bad', comparative: 'worse', superlative: 'worst', meaning: '나쁜' },
  { base: 'badly', comparative: 'worse', superlative: 'worst', meaning: '나쁘게, 서투르게' },
  { base: 'ill', comparative: 'worse', superlative: 'worst', meaning: '아픈, 나쁜' },
  { base: 'far', comparative: 'farther', superlative: 'farthest', meaning: '먼 (거리)' },
  { base: 'far', comparative: 'further', superlative: 'furthest', meaning: '심화된 (정도/깊이)' },
  { base: 'good', comparative: 'better', superlative: 'best', meaning: '좋은' },
  { base: 'well', comparative: 'better', superlative: 'best', meaning: '잘, 건강한' },
  { base: 'little', comparative: 'less', superlative: 'least', meaning: '적은 (셀 수 없는 명사/양)' },
  { base: 'many', comparative: 'more', superlative: 'most', meaning: '많은 (셀 수 있는 명사/수)' },
  { base: 'much', comparative: 'more', superlative: 'most', meaning: '많은 (셀 수 없는 명사/양)' },
  { base: 'old', comparative: 'elder', superlative: 'eldest', meaning: '손위의, 형제의' },
  { base: 'late', comparative: 'later', superlative: 'latest', meaning: '늦은, 느지막이 (시간)' },
  { base: 'late', comparative: 'latter', superlative: 'last', meaning: '늦은, 후자의 (순서)' },
  { base: 'big', comparative: 'bigger', superlative: 'biggest', meaning: '큰' },
  { base: 'fat', comparative: 'fatter', superlative: 'fattest', meaning: '뚱뚱한' },
  { base: 'hot', comparative: 'hotter', superlative: 'hottest', meaning: '더운, 뜨거운' },
  { base: 'thin', comparative: 'thinner', superlative: 'thinnest', meaning: '마른, 얇은' },
];

export async function seedComparativeGrammar() {
  if ((window as any)._comparativeGrammarSeeded) return;
  (window as any)._comparativeGrammarSeeded = true;

  try {
    const wordbooksRef = collection(db, 'wordbooks');
    const q = query(wordbooksRef, where('type', '==', 'comparative-grammar'));
    const snapshot = await getDocs(q);

    let wordbookId: string;

    if (snapshot.empty) {
      const docRef = await addDoc(wordbooksRef, {
        title: '형용사/부사의 3단 변화 (비교급/최상급)',
        description: '형용사 및 부사의 원급, 비교급, 최상급 3단 변화와 의미를 학습합니다.',
        createdBy: 'system',
        isPublic: true,
        type: 'comparative-grammar',
        category: 'grammar',
        createdAt: Timestamp.now(),
        order: 1
      });
      wordbookId = docRef.id;
    } else {
      wordbookId = snapshot.docs[0].id;
      await setDoc(doc(db, 'wordbooks', wordbookId), {
        type: 'comparative-grammar',
        category: 'grammar',
        createdBy: 'system',
        isPublic: true
      }, { merge: true });
    }

    const wordsRef = collection(db, `wordbooks/${wordbookId}/words`);
    const existingWordsSnap = await getDocs(wordsRef);

    if (existingWordsSnap.empty) {
      const batchSize = 400;
      for (let i = 0; i < comparativeData.length; i += batchSize) {
        const batch = writeBatch(db);
        const chunk = comparativeData.slice(i, i + batchSize);

        chunk.forEach((item, index) => {
          const newDocRef = doc(wordsRef);
          batch.set(newDocRef, {
            word: item.base,
            meaning: item.meaning,
            comparative: item.comparative,
            superlative: item.superlative,
            past: item.comparative, // for backward compatibility with 3-step tables
            pastParticiple: item.superlative,
            order: i + index,
            createdAt: Timestamp.now()
          });
        });

        await batch.commit();
      }
      console.log('Comparative grammar wordbook seeded successfully.');
    }
  } catch (error) {
    console.error('Error seeding comparative grammar:', error);
  }
}
