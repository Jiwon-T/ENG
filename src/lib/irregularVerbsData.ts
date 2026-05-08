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
  { base: 'let', past: 'let', pastParticiple: 'let', meaning: '하게 하다', pattern: 'A-A-A', distractors: ['letted', 'lat', 'luts'] },
  { base: 'shut', past: 'shut', pastParticiple: 'shut', meaning: '닫다', pattern: 'A-A-A', distractors: ['shutted', 'shot', 'shat'] },
  { base: 'split', past: 'split', pastParticiple: 'split', meaning: '찢다, 쪼개다', pattern: 'A-A-A', distractors: ['splitted', 'splat', 'splot'] },
  { base: 'quit', past: 'quit', pastParticiple: 'quit', meaning: '그만두다', pattern: 'A-A-A', distractors: ['quitted', 'quat', 'quits'] },
  { base: 'burst', past: 'burst', pastParticiple: 'burst', meaning: '터뜨리다', pattern: 'A-A-A', distractors: ['bursted', 'barst', 'borst'] },
  { base: 'cast', past: 'cast', pastParticiple: 'cast', meaning: '던지다', pattern: 'A-A-A', distractors: ['casted', 'cost', 'cust'] },
  { base: 'bid', past: 'bid', pastParticiple: 'bid', meaning: '명령하다, 입찰하다', pattern: 'A-A-A', distractors: ['bidded', 'bad', 'bod'] },
  { base: 'upset', past: 'upset', pastParticiple: 'upset', meaning: '당황하게 하다', pattern: 'A-A-A', distractors: ['upsetted', 'upsat', 'upsot'] },
  
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
  { base: 'bend', past: 'bent', pastParticiple: 'bent', meaning: '구부리다', pattern: 'A-B-B', distractors: ['bended', 'benten', 'band'] },
  { base: 'dig', past: 'dug', pastParticiple: 'dug', meaning: '파다', pattern: 'A-B-B', distractors: ['digged', 'dag', 'dugen'] },
  { base: 'feed', past: 'fed', pastParticiple: 'fed', meaning: '먹여 주다', pattern: 'A-B-B', distractors: ['feeded', 'food', 'feden'] },
  { base: 'feel', past: 'felt', pastParticiple: 'felt', meaning: '느끼다', pattern: 'A-B-B', distractors: ['feeled', 'felten', 'feeling'] },
  { base: 'fight', past: 'fought', pastParticiple: 'fought', meaning: '싸우다', pattern: 'A-B-B', distractors: ['fighted', 'fate', 'foughten'] },
  { base: 'hang', past: 'hung', pastParticiple: 'hung', meaning: '걸다, 매달다', pattern: 'A-B-B', distractors: ['hanged', 'hangen', 'hunged'] },
  { base: 'hold', past: 'held', pastParticiple: 'held', meaning: '잡다, 유지하다', pattern: 'A-B-B', distractors: ['holded', 'helden', 'holden'] },
  { base: 'lead', past: 'led', pastParticiple: 'led', meaning: '이끌다', pattern: 'A-B-B', distractors: ['leaded', 'laden', 'leaden'] },
  { base: 'lend', past: 'lent', pastParticiple: 'lent', meaning: '빌려주다', pattern: 'A-B-B', distractors: ['lended', 'lenten', 'land'] },
  { base: 'mean', past: 'meant', pastParticiple: 'meant', meaning: '의미하다', pattern: 'A-B-B', distractors: ['meaned', 'meanten', 'moant'] },
  { base: 'meet', past: 'met', pastParticiple: 'met', meaning: '만나다', pattern: 'A-B-B', distractors: ['meeted', 'metten', 'meetened'] },
  { base: 'pay', past: 'paid', pastParticiple: 'paid', meaning: '지불하다', pattern: 'A-B-B', distractors: ['payed', 'paidened', 'pays'] },
  { base: 'sell', past: 'sold', pastParticiple: 'sold', meaning: '팔다', pattern: 'A-B-B', distractors: ['selled', 'solden', 'sells'] },
  { base: 'shoot', past: 'shot', pastParticiple: 'shot', meaning: '쏘다', pattern: 'A-B-B', distractors: ['shooted', 'shotten', 'shat'] },
  { base: 'sit', past: 'sat', pastParticiple: 'sat', meaning: '앉다', pattern: 'A-B-B', distractors: ['sitted', 'saten', 'sitten'] },
  { base: 'spend', past: 'spent', pastParticiple: 'spent', meaning: '소비하다', pattern: 'A-B-B', distractors: ['spended', 'spenten', 'spand'] },
  { base: 'stand', past: 'stood', pastParticiple: 'stood', meaning: '서다', pattern: 'A-B-B', distractors: ['standed', 'stooden', 'stonden'] },
  { base: 'stick', past: 'stuck', pastParticiple: 'stuck', meaning: '찌르다, 붙이다', pattern: 'A-B-B', distractors: ['sticked', 'stack', 'stucken'] },
  { base: 'strike', past: 'struck', pastParticiple: 'struck', meaning: '치다, 때리다', pattern: 'A-B-B', distractors: ['striked', 'strok', 'strucken'] },
  { base: 'sweep', past: 'swept', pastParticiple: 'swept', meaning: '쓸다, 소탕하다', pattern: 'A-B-B', distractors: ['sweeped', 'swepten', 'swap'] },
  { base: 'understand', past: 'understood', pastParticiple: 'understood', meaning: '이해하다', pattern: 'A-B-B', distractors: ['understanded', 'understooden', 'understands'] },
  { base: 'weep', past: 'wept', pastParticiple: 'wept', meaning: '울다', pattern: 'A-B-B', distractors: ['weeped', 'wepten', 'wap'] },

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
  { base: 'bite', past: 'bit', pastParticiple: 'bitten', meaning: '물다', pattern: 'A-B-C', distractors: ['bited', 'biten', 'bitted'] },
  { base: 'blow', past: 'blew', pastParticiple: 'blown', meaning: '불다', pattern: 'A-B-C', distractors: ['blowed', 'blown', 'blewd'] },
  { base: 'choose', past: 'chose', pastParticiple: 'chosen', meaning: '선택하다', pattern: 'A-B-C', distractors: ['choosed', 'chosen', 'chosened'] },
  { base: 'draw', past: 'drew', pastParticiple: 'drawn', meaning: '그리다', pattern: 'A-B-C', distractors: ['drawed', 'drawn', 'drewed'] },
  { base: 'drive', past: 'drove', pastParticiple: 'driven', meaning: '운전하다', pattern: 'A-B-C', distractors: ['drived', 'driven', 'droven'] },
  { base: 'forbid', past: 'forbade', pastParticiple: 'forbidden', meaning: '금지하다', pattern: 'A-B-C', distractors: ['forbided', 'forbiden', 'forbad'] },
  { base: 'forget', past: 'forgot', pastParticiple: 'forgotten', meaning: '잊다', pattern: 'A-B-C', distractors: ['forgeted', 'forgoten', 'forgottened'] },
  { base: 'forgive', past: 'forgave', pastParticiple: 'forgiven', meaning: '용서하다', pattern: 'A-B-C', distractors: ['forgived', 'forgiven', 'forgaven'] },
  { base: 'freeze', past: 'froze', pastParticiple: 'frozen', meaning: '얼다', pattern: 'A-B-C', distractors: ['freezed', 'frozen', 'frozed'] },
  { base: 'grow', past: 'grew', pastParticiple: 'grown', meaning: '자라다', pattern: 'A-B-C', distractors: ['growed', 'grown', 'grewed'] },
  { base: 'hide', past: 'hid', pastParticiple: 'hidden', meaning: '숨다', pattern: 'A-B-C', distractors: ['hided', 'hidden', 'hiden'] },
  { base: 'lie', past: 'lay', pastParticiple: 'lain', meaning: '눕다', pattern: 'A-B-C', distractors: ['lied', 'lain', 'layed'] },
  { base: 'mistake', past: 'mistook', pastParticiple: 'mistaken', meaning: '실수하다', pattern: 'A-B-C', distractors: ['mistaked', 'mistaken', 'mistooked'] },
  { base: 'ride', past: 'rode', pastParticiple: 'ridden', meaning: '타다', pattern: 'A-B-C', distractors: ['rided', 'ridden', 'roden'] },
  { base: 'rise', past: 'rose', pastParticiple: 'risen', meaning: '오르다', pattern: 'A-B-C', distractors: ['rised', 'risen', 'rosen'] },
  { base: 'shake', past: 'shook', pastParticiple: 'shaken', meaning: '흔들다', pattern: 'A-B-C', distractors: ['shaked', 'shaken', 'shooked'] },
  { base: 'show', past: 'showed', pastParticiple: 'shown', meaning: '보여주다', pattern: 'A-B-C', distractors: ['showed', 'shown', 'showened'] },
  { base: 'speak', past: 'spoke', pastParticiple: 'spoken', meaning: '말하다', pattern: 'A-B-C', distractors: ['speaked', 'spoken', 'spokened'] },
  { base: 'steal', past: 'stole', pastParticiple: 'stolen', meaning: '훔치다', pattern: 'A-B-C', distractors: ['stealed', 'stolen', 'stolened'] },
  { base: 'strive', past: 'strove', pastParticiple: 'striven', meaning: '노력하다', pattern: 'A-B-C', distractors: ['strived', 'striven', 'stroven'] },
  { base: 'take', past: 'took', pastParticiple: 'taken', meaning: '잡다, 취하다', pattern: 'A-B-C', distractors: ['taked', 'taken', 'token'] },
  { base: 'throw', past: 'threw', pastParticiple: 'thrown', meaning: '던지다', pattern: 'A-B-C', distractors: ['throwed', 'thrown', 'threwed'] },
  { base: 'wake', past: 'woke', pastParticiple: 'woken', meaning: '깨다', pattern: 'A-B-C', distractors: ['waked', 'woken', 'woked'] },
  { base: 'wear', past: 'wore', pastParticiple: 'worn', meaning: '입다, 착용하다', pattern: 'A-B-C', distractors: ['weared', 'worn', 'woren'] },
  { base: 'weave', past: 'wove', pastParticiple: 'woven', meaning: '지어내다, 짜다', pattern: 'A-B-C', distractors: ['weaved', 'woven', 'wovened'] },
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
    // Check for old titles (for transitional period)
    const oldTitleQ1 = query(wordbooksRef, where('title', '==', '불규칙 변화 동사'));
    const oldTitleQ2 = query(wordbooksRef, where('title', '==', '불규칙 변화 동사 (수동태)'));
    const oldSnapshot1 = await getDocs(oldTitleQ1);
    const oldSnapshot2 = await getDocs(oldTitleQ2);

    if (!oldSnapshot1.empty) {
      wordbookId = oldSnapshot1.docs[0].id;
      await setDoc(doc(db, 'wordbooks', wordbookId), {
        type: 'irregular',
        category: 'grammar',
        createdBy: 'system'
      }, { merge: true });
    } else if (!oldSnapshot2.empty) {
      wordbookId = oldSnapshot2.docs[0].id;
      await setDoc(doc(db, 'wordbooks', wordbookId), {
        type: 'irregular',
        category: 'grammar',
        createdBy: 'system'
      }, { merge: true });
    } else {
      const docRef = await addDoc(wordbooksRef, {
        title: '불규칙 변화 동사 (수동태)',
        description: '원형-과거형-과거분사형 변화를 학습합니다. (수동태 핵심)',
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
  const existingSnapshot = await getDocs(wordsRef);
  
  // Only re-sync if the count is strictly less than our new comprehensive list
  // This avoids wiping manual changes IF they somehow survived or if it's already updated.
  // Actually, we want to RESTORE the lost data, so we SHOULD re-sync to the full list once.
  // We'll use a specific flag to only do this huge sync if needed.
  if (existingSnapshot.size < irregularVerbsData.length) {
    const deleteBatch = writeBatch(db);
    for (const d of existingSnapshot.docs) {
      deleteBatch.delete(doc(db, `wordbooks/${wordbookId}/words`, d.id));
    }
    await deleteBatch.commit();
    
    // Split addBatch if it exceeds 500 limit (though 98 is fine)
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
    console.log('Irregular verbs restored and synced successfully');
  }
}
