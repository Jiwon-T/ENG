import { collection, addDoc, Timestamp, query, where, getDocs, doc, setDoc, writeBatch } from 'firebase/firestore';
import { db } from './firebase';

export interface IrregularVerb {
  base: string;
  past: string;
  pastParticiple: string;
  meaning: string;
  pattern: 'A-A-A' | 'A-B-A' | 'A-B-B' | 'A-B-C';
  distractors?: string[];
}

export const irregularVerbsData: IrregularVerb[] = [
  // A-A-A
  { base: 'cost', past: 'cost', pastParticiple: 'cost', meaning: '비용이 들다', pattern: 'A-A-A', distractors: ['costed', 'cast', 'cust'] },
  { base: 'cut', past: 'cut', pastParticiple: 'cut', meaning: '베다, 자르다', pattern: 'A-A-A', distractors: ['cutted', 'cat', 'cuts'] },
  { base: 'hit', past: 'hit', pastParticiple: 'hit', meaning: '치다', pattern: 'A-A-A', distractors: ['hited', 'hot', 'hat'] },
  { base: 'hurt', past: 'hurt', pastParticiple: 'hurt', meaning: '다치게 하다', pattern: 'A-A-A', distractors: ['hurted', 'hart', 'hurts'] },
  { base: 'put', past: 'put', pastParticiple: 'put', meaning: '놓다', pattern: 'A-A-A', distractors: ['putted', 'pat', 'pot'] },
  { base: 'read', past: 'read', pastParticiple: 'read', meaning: '읽다', pattern: 'A-A-A', distractors: ['readed', 'red', 'reads'] },
  { base: 'set', past: 'set', pastParticiple: 'set', meaning: '놓다', pattern: 'A-A-A', distractors: ['setted', 'sat', 'sot'] },
  { base: 'spread', past: 'spread', pastParticiple: 'spread', meaning: '펼치다', pattern: 'A-A-A', distractors: ['spreaded', 'sprad', 'sprod'] },
  
  // A-B-A
  { base: 'become', past: 'became', pastParticiple: 'become', meaning: '~이 되다', pattern: 'A-B-A', distractors: ['becomed', 'becomen', 'becam'] },
  { base: 'come', past: 'came', pastParticiple: 'come', meaning: '오다', pattern: 'A-B-A', distractors: ['comed', 'comen', 'cam'] },
  { base: 'run', past: 'ran', pastParticiple: 'run', meaning: '달리다', pattern: 'A-B-A', distractors: ['runned', 'raned', 'runnen'] },

  // A-B-B
  { base: 'bring', past: 'brought', pastParticiple: 'brought', meaning: '가져오다', pattern: 'A-B-B', distractors: ['brang', 'brung', 'bringed'] },
  { base: 'build', past: 'built', pastParticiple: 'built', meaning: '짓다', pattern: 'A-B-B', distractors: ['builded', 'builted', 'builden'] },
  { base: 'buy', past: 'bought', pastParticiple: 'bought', meaning: '사다', pattern: 'A-B-B', distractors: ['buyed', 'boughted', 'buying'] },
  { base: 'catch', past: 'caught', pastParticiple: 'caught', meaning: '잡다', pattern: 'A-B-B', distractors: ['catched', 'caughted', 'catcht'] },
  { base: 'find', past: 'found', pastParticiple: 'found', meaning: '찾다', pattern: 'A-B-B', distractors: ['finded', 'founden', 'fined'] },
  { base: 'get', past: 'got', pastParticiple: 'got', meaning: '얻다', pattern: 'A-B-B', distractors: ['getted', 'gotten', 'gotted'] },
  { base: 'hear', past: 'heard', pastParticiple: 'heard', meaning: '듣다', pattern: 'A-B-B', distractors: ['heared', 'hered', 'hearen'] },
  { base: 'keep', past: 'kept', pastParticiple: 'kept', meaning: '유지하다', pattern: 'A-B-B', distractors: ['keeped', 'kepted', 'keepen'] },
  { base: 'leave', past: 'left', pastParticiple: 'left', meaning: '떠나다', pattern: 'A-B-B', distractors: ['leaved', 'lefted', 'leaven'] },
  { base: 'lose', past: 'lost', pastParticiple: 'lost', meaning: '잃다, 지다', pattern: 'A-B-B', distractors: ['losed', 'losted', 'losen'] },
  { base: 'make', past: 'made', pastParticiple: 'made', meaning: '만들다', pattern: 'A-B-B', distractors: ['maked', 'maden', 'makes'] },
  { base: 'say', past: 'said', pastParticiple: 'said', meaning: '말하다', pattern: 'A-B-B', distractors: ['sayed', 'saiden', 'says'] },
  { base: 'send', past: 'sent', pastParticiple: 'sent', meaning: '보내다', pattern: 'A-B-B', distractors: ['sended', 'sented', 'senden'] },
  { base: 'sleep', past: 'slept', pastParticiple: 'slept', meaning: '자다', pattern: 'A-B-B', distractors: ['sleeped', 'slepted', 'sleepen'] },
  { base: 'teach', past: 'taught', pastParticiple: 'taught', meaning: '가르치다', pattern: 'A-B-B', distractors: ['teached', 'taughten', 'teaching'] },
  { base: 'tell', past: 'told', pastParticiple: 'told', meaning: '말하다', pattern: 'A-B-B', distractors: ['telled', 'tolen', 'telling'] },
  { base: 'think', past: 'thought', pastParticiple: 'thought', meaning: '생각하다', pattern: 'A-B-B', distractors: ['thinked', 'thoughten', 'thinking'] },
  { base: 'win', past: 'won', pastParticiple: 'won', meaning: '이기다', pattern: 'A-B-B', distractors: ['winned', 'wonned', 'winning'] },

  // A-B-C
  { base: 'begin', past: 'began', pastParticiple: 'begun', meaning: '시작하다', pattern: 'A-B-C', distractors: ['begined', 'begannen', 'begunned'] },
  { base: 'break', past: 'broke', pastParticiple: 'broken', meaning: '깨다', pattern: 'A-B-C', distractors: ['breaked', 'brokened', 'broken'] },
  { base: 'do', past: 'did', pastParticiple: 'done', meaning: '하다', pattern: 'A-B-C', distractors: ['doed', 'diden', 'doneed'] },
  { base: 'drink', past: 'drank', pastParticiple: 'drunk', meaning: '마시다', pattern: 'A-B-C', distractors: ['drinked', 'dranken', 'drunkken'] },
  { base: 'eat', past: 'ate', pastParticiple: 'eaten', meaning: '먹다', pattern: 'A-B-C', distractors: ['eated', 'aten', 'eatened'] },
  { base: 'fall', past: 'fell', pastParticiple: 'fallen', meaning: '떨어지다, 넘어지다', pattern: 'A-B-C', distractors: ['falled', 'fallen', 'feeled'] },
  { base: 'fly', past: 'flew', pastParticiple: 'flown', meaning: '날다', pattern: 'A-B-C', distractors: ['flyed', 'flown', 'flewd'] },
  { base: 'give', past: 'gave', pastParticiple: 'given', meaning: '주다', pattern: 'A-B-C', distractors: ['gived', 'given', 'gaven'] },
  { base: 'go', past: 'went', pastParticiple: 'gone', meaning: '가다', pattern: 'A-B-C', distractors: ['goed', 'wenten', 'goneed'] },
  { base: 'know', past: 'knew', pastParticiple: 'known', meaning: '알다', pattern: 'A-B-C', distractors: ['knowed', 'known', 'knewed'] },
  { base: 'see', past: 'saw', pastParticiple: 'seen', meaning: '보다', pattern: 'A-B-C', distractors: ['seed', 'sawed', 'seen'] },
  { base: 'sing', past: 'sang', pastParticiple: 'sung', meaning: '노래하다', pattern: 'A-B-C', distractors: ['singed', 'sanged', 'sunged'] },
  { base: 'swim', past: 'swam', pastParticiple: 'swum', meaning: '수영하다', pattern: 'A-B-C', distractors: ['swimmed', 'swammed', 'swummed'] },
  { base: 'write', past: 'wrote', pastParticiple: 'written', meaning: '쓰다', pattern: 'A-B-C', distractors: ['writed', 'wroteed', 'written'] },
];

export async function seedIrregularVerbs() {
  // Simple session-level cache to avoid repeated seeding checks
  if ((window as any)._irregularVerbsSeeded) return;
  (window as any)._irregularVerbsSeeded = true;

  const wordbooksRef = collection(db, 'wordbooks');
  // Query by type instead of title to allow renaming
  const q = query(wordbooksRef, where('type', '==', 'irregular'));
  const snapshot = await getDocs(q);

  let wordbookId: string;

  if (snapshot.empty) {
    // Check for old title (for transitional period)
    const oldTitleQ = query(wordbooksRef, where('title', '==', '불규칙 변화 동사'));
    const oldSnapshot = await getDocs(oldTitleQ);

    if (!oldSnapshot.empty) {
      wordbookId = oldSnapshot.docs[0].id;
      await setDoc(doc(db, 'wordbooks', wordbookId), {
        type: 'irregular',
        category: 'grammar',
        createdBy: 'system'
      }, { merge: true });
    } else {
      const docRef = await addDoc(wordbooksRef, {
        title: '불규칙 변화 동사',
        description: '원형-과거형-과거분사형 변화를 학습합니다.',
        createdBy: 'system',
        isPublic: true,
        type: 'irregular',
        category: 'grammar',
        createdAt: Timestamp.now(),
        order: -1, // Always at the top
        customDistractors: [
          'brang', 'brung', 'bringed', 'buyed', 'catched', 'foughted', 'teached', 'teaching',
          'goed', 'wenten', 'gwn', 'breaked', 'brokened', 'doed', 'diden', 'eated', 'aten',
          'runned', 'raned', 'comed', 'becomed', 'costed', 'cutted', 'hited', 'hurted',
          'putted', 'readed', 'spreaded', 'seed', 'sawed', 'sinked', 'sanked', 'swimmed',
          'swammed', 'singed', 'sanged', 'knowed', 'knowen', 'writed', 'wroteed'
        ]
      });
      wordbookId = docRef.id;
    }
  } else {
    wordbookId = snapshot.docs[0].id;
    // Update type, category and distractors
    await setDoc(doc(db, 'wordbooks', wordbookId), { 
      type: 'irregular',
      category: 'grammar',
      createdBy: 'system',
      customDistractors: [
        'brang', 'brung', 'bringed', 'buyed', 'catched', 'foughted', 'teached', 'teaching',
        'goed', 'wenten', 'gwn', 'breaked', 'brokened', 'doed', 'diden', 'eated', 'aten',
        'runned', 'raned', 'comed', 'becomed', 'costed', 'cutted', 'hited', 'hurted',
        'putted', 'readed', 'spreaded', 'seed', 'sawed', 'sinked', 'sanked', 'swimmed',
        'swammed', 'singed', 'sanged', 'knowed', 'knowen', 'writed', 'wroteed'
      ]
    }, { merge: true });
  }

  // Add/Sync words
  const wordsRef = collection(db, `wordbooks/${wordbookId}/words`);
  const existingWords = await getDocs(wordsRef);
  
  // Skip if already has words (unless force sync requested or empty)
  if (!existingWords.empty && !(window as any)._forceGrammarSync) {
    return;
  }

  // If force sync or empty, proceed with re-sync
  const deleteBatch = writeBatch(db);
  for (const d of existingWords.docs) {
    deleteBatch.delete(doc(db, `wordbooks/${wordbookId}/words`, d.id));
  }
  await deleteBatch.commit();
  
  const addBatch = writeBatch(db);
  for (let i = 0; i < irregularVerbsData.length; i++) {
    const verb = irregularVerbsData[i];
    const newDocRef = doc(collection(db, `wordbooks/${wordbookId}/words`));
    addBatch.set(newDocRef, {
      word: verb.base,
      past: verb.past,
      pastParticiple: verb.pastParticiple,
      meaning: verb.meaning,
      pattern: verb.pattern,
      distractors: verb.distractors || [],
      order: i
    });
  }
  await addBatch.commit();
  console.log('Irregular verbs sync successful');
}
