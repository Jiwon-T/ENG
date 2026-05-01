
export interface GrammarQuizItem {
  id: number;
  set: number; // 1: 1-2형식, 2: 3-4형식, 3: 5형식, 4: 준동사, 5: 분사구문, 6: 시제/기타
  category: string;
  sentence: string;
  question: string;
  choices: string[];
  answer: number;
  explanation: string;
}

export const GRAMMAR_CRAMMING_POOL: GrammarQuizItem[] = [
  // --- SET 1: 1-2형식 ---
  {
    id: 1, set: 1, category: "1형식",
    sentence: "This suit will ___ for the party.",
    question: "이 정장은 파티에 '적합할 것이다'라는 의미로 알맞은 것은?",
    choices: ["make", "do", "take", "run"],
    answer: 1,
    explanation: "교안 p.1: do가 1형식으로 쓰이면 '충분하다, 적합하다'는 의미입니다."
  },
  {
    id: 2, set: 1, category: "1형식",
    sentence: "Your opinion doesn't ___ much in this project.",
    question: "빈칸에 알맞은 '중요하다' 의미의 1형식 동사는?",
    choices: ["matter", "happen", "occur", "stay"],
    answer: 0,
    explanation: "교안 p.1: matter와 count는 1형식에서 '중요하다'는 의미를 가집니다."
  },
  {
    id: 3, set: 1, category: "1형식",
    sentence: "The project will ___ well in the end.",
    question: "빈칸에 알맞은 '이익이 되다'라는 의미의 1형식 동사는?",
    choices: ["pay", "spend", "cost", "lose"],
    answer: 0,
    explanation: "교안 p.1: pay는 1형식으로 쓰일 때 '이익이 되다'라는 뜻입니다."
  },
  {
    id: 4, set: 1, category: "1형식",
    sentence: "The rain ___ suddenly.",
    question: "1형식 자동사의 올바른 형태는? (수동태 불가)",
    choices: ["stopped", "was stopped", "has been stopped", "stopping"],
    answer: 0,
    explanation: "교안 p.1: 1형식 동사는 절대 수동태로 쓸 수 없습니다."
  },
  {
    id: 5, set: 1, category: "2형식",
    sentence: "Good medicine ___ bitter.",
    question: "감각동사 뒤에 올바른 보어의 형태는?",
    choices: ["tastes", "tastes bitterly", "is tasted", "tasting"],
    answer: 0,
    explanation: "교안 p.2: 2형식 감각동사 뒤에는 부사가 아닌 형용사 보어가 와야 합니다."
  },
  {
    id: 6, set: 1, category: "2형식",
    sentence: "She remained ___ despite the news.",
    question: "상태유지 동사(remain) 뒤에 올바른 보어의 형태는?",
    choices: ["calm", "calmly", "in calm", "to be calmly"],
    answer: 0,
    explanation: "교안 p.2: remain, stay, keep 등 상태유지 동사 뒤에는 형용사 보어가 옵니다."
  },
  {
    id: 7, set: 1, category: "2형식",
    sentence: "The student ___ nervous about the interview.",
    question: "빈칸에 알맞은 인식동사(seem류)의 형태는?",
    choices: ["seems", "is seemed", "seeming", "to seem"],
    answer: 0,
    explanation: "교안 p.2: seem, appear 등 인식동사는 2형식 문장을 만듭니다."
  },
  {
    id: 8, set: 1, category: "2형식",
    sentence: "The tree ___ bigger.",
    question: "상태의 변화(~이 되다)를 나타내는 변화동사의 형태는?",
    choices: ["grew", "stayed", "remained", "stood"],
    answer: 0,
    explanation: "교안 p.2: get, grow, turn, run 등은 '~이 되다'라는 의미의 변화동사입니다."
  },
  {
    id: 9, set: 1, category: "2형식",
    sentence: "The house stood ___ for a long time.",
    question: "빈칸에 알맞은 보어의 형태는?",
    choices: ["empty", "emptily", "in empty", "emptiness"],
    answer: 0,
    explanation: "교안 p.2: stand도 2형식 상태동사로 쓰여 뒤에 형용사 보어를 취할 수 있습니다."
  },
  {
    id: 10, set: 1, category: "1형식",
    sentence: "Every minute ___.",
    question: "교안 p.1: 빈칸에 알맞은 '중요하다' 의미의 1형식 동사는?",
    choices: ["counts", "makes", "takes", "gives"],
    answer: 0,
    explanation: "교안 p.1: count는 1형식에서 '중요하다'는 뜻으로 쓰입니다."
  },
  {
    id: 11, set: 1, category: "1형식",
    sentence: "This new method ___ well for us.",
    question: "교안 p.1: 빈칸에 알맞은 '효과가 있다'라는 의미의 동사는?",
    choices: ["works", "does", "pays", "lasts"],
    answer: 0,
    explanation: "교안 p.1: work는 1형식에서 '효과가 있다'는 뜻을 가집니다."
  },
  {
    id: 12, set: 1, category: "1형식",
    sentence: "The meeting ___ for three hours.",
    question: "교안 p.1: 빈칸에 알맞은 '계속하다'라는 의미의 1형식 동사는?",
    choices: ["lasted", "stayed", "stood", "remained"],
    answer: 0,
    explanation: "교안 p.1: last는 1형식으로 쓰일 때 '계속하다'라는 뜻입니다."
  },
  {
    id: 13, set: 1, category: "1형식",
    sentence: "The committee ___ of ten members.",
    question: "교안 p.1: '~으로 구성되다'라는 의미로 1형식 동사와 함께 쓰이는 전치사는?",
    choices: ["consists at", "consists in", "consists of", "consists with"],
    answer: 2,
    explanation: "교안 p.1: consist of는 '~으로 구성되다'라는 뜻의 자동사 구문입니다."
  },
  {
    id: 14, set: 1, category: "2형식",
    sentence: "The flowers ___ sweet.",
    question: "교안 p.2: 감각동사의 보어로 알맞은 형태는?",
    choices: ["smell", "smells sweetly", "are smelled", "smelling"],
    answer: 0,
    explanation: "교안 p.2: 감각동사(smell) 뒤에는 부사가 아닌 형용사 보어가 와야 합니다."
  },
  {
    id: 15, set: 1, category: "2형식",
    sentence: "She looks ___ an angel.",
    question: "교안 p.2: 감각동사 뒤에 명사 보어가 올 때 필요한 전치사는?",
    choices: ["as", "like", "at", "to"],
    answer: 1,
    explanation: "교안 p.2: 감각동사 뒤에 명사가 올 때는 like를 함께 써야 합니다."
  },
  {
    id: 16, set: 1, category: "2형식",
    sentence: "The weather kept ___.",
    question: "교안 p.2: 상태유지 동사 keep의 보어로 알맞은 형태는?",
    choices: ["cold", "coldly", "to be cold", "in cold"],
    answer: 0,
    explanation: "교안 p.2: stay, remain, keep 등 상태유지 동사 뒤에는 형용사 보어가 옵니다."
  },
  {
    id: 17, set: 1, category: "1형식",
    sentence: "There ___ two cats under the table.",
    question: "교안 p.1: There is/are 구문의 1형식 동사 수 일치로 알맞은 것은?",
    choices: ["are", "is", "be", "being"],
    answer: 0,
    explanation: "교안 p.1: There is/are는 1형식이며 뒤에 오는 주어(two cats)에 수를 일치시킵니다."
  },
  {
    id: 18, set: 1, category: "1형식",
    sentence: "The Egyptian never ___ up.",
    question: "교안 p.1: '나타나다'의 의미로 쓰인 1형식 구동사는?",
    choices: ["showed", "appeared", "happened", "occurred"],
    answer: 0,
    explanation: "교안 p.1: 'show up'은 '나타나다'라는 의미의 1형식 표현입니다."
  },

  // --- SET 2: 3-4형식 ---
  {
    id: 101, set: 2, category: "3형식",
    sentence: "She ___ Tom last year.",
    question: "교안 p.3의 DREAM 동사 중 '결혼하다'의 올바른 3형식 사용법은?",
    choices: ["married with", "married to", "married", "was married with"],
    answer: 2,
    explanation: "교안 p.3: marry는 전치사를 쓰지 않는 타동사입니다."
  },
  {
    id: 102, set: 2, category: "3형식",
    sentence: "We should ___ the problem seriously.",
    question: "교안 p.3: '토론하다'의 의미로 알맞은 타동사는?",
    choices: ["discuss", "discuss about", "talk", "mention about"],
    answer: 0,
    explanation: "교안 p.3: discuss, mention은 전치사(about)를 쓰지 않는 대표적 타동사입니다."
  },
  {
    id: 103, set: 2, category: "3형식",
    sentence: "He ___ her mother in many ways.",
    question: "교안 p.3: '~와 닮다'의 올바른 표현은?",
    choices: ["resembles with", "resembles to", "resembles", "is resembled"],
    answer: 2,
    explanation: "교안 p.3: resemble은 전치사 없이 목적어를 취하며 수동태로 쓰지 않습니다."
  },
  {
    id: 104, set: 2, category: "3형식",
    sentence: "He ___ the room without permission.",
    question: "교안 p.3: '~에 들어가다'의 의미로 전치사 없이 쓰이는 동사는?",
    choices: ["entered", "entered into", "entered to", "entered at"],
    answer: 0,
    explanation: "교안 p.3: enter가 장소에 들어갈 때는 타동사로 전치사를 쓰지 않습니다."
  },
  {
    id: 105, set: 2, category: "4형식",
    sentence: "He gave the girl ___.",
    question: "4형식 문장(S+V+I.O+D.O)의 올바른 해석 순서는?",
    choices: ["a doll", "to a doll", "for a doll", "with a doll"],
    answer: 0,
    explanation: "교안 p.4: 4형식은 '간목(~에게) 직목(~을)'의 순서로 명사를 나열합니다."
  },
  {
    id: 106, set: 2, category: "4형식",
    sentence: "I bought a gift ___ my sister.",
    question: "교안 p.4: buy를 3형식으로 전환할 때 알맞은 전치사는?",
    choices: ["to", "for", "of", "with"],
    answer: 1,
    explanation: "교안 p.4: buy, make, get, find 등은 전치사 for를 사용하여 3형식으로 전환합니다."
  },
  {
    id: 107, set: 2, category: "4형식",
    sentence: "He asked a question ___ me.",
    question: "교안 p.4: ask를 3형식으로 전환할 때 알맞은 전치사는?",
    choices: ["to", "for", "with", "of"],
    answer: 3,
    explanation: "교안 p.4: ask, inquire 등은 전치사 of를 사용하여 3형식으로 전환합니다."
  },
  {
    id: 108, set: 2, category: "4형식",
    sentence: "Jay teaches ___ English.",
    question: "수여동사 teach의 4형식 목적어 어순으로 알맞은 것은?",
    choices: ["us", "to us", "for us", "with us"],
    answer: 0,
    explanation: "교안 p.4: 4형식 수여동사 뒤에는 간접목적어가 바로 옵니다."
  },
  {
    id: 109, set: 2, category: "3형식",
    sentence: "We finally ___ the destination.",
    question: "교안 p.3: DREAM 동사 중 '~에 도달하다'의 올바른 표현은?",
    choices: ["reached at", "reached into", "reached", "reached to"],
    answer: 2,
    explanation: "교안 p.3: reach는 전치사 없이 목적어를 취하는 타동사입니다."
  },
  {
    id: 110, set: 2, category: "3형식",
    sentence: "Don't ___ the building without a pass.",
    question: "교안 p.3: '~에 접근하다'의 올바른 표현은?",
    choices: ["approach to", "approach", "arrive at", "get to"],
    answer: 1,
    explanation: "교안 p.3: approach는 전치사(to)를 쓰지 않는 타동사입니다."
  },
  {
    id: 111, set: 2, category: "3형식",
    sentence: "Did he ___ the plan to you?",
    question: "교안 p.3: '~에 대해 언급하다'의 올바른 표현은?",
    choices: ["mention", "mention about", "talk about", "speak about"],
    answer: 0,
    explanation: "교안 p.3: mention은 전치사(about)를 쓰지 않는 타동사입니다."
  },
  {
    id: 112, set: 2, category: "4형식",
    sentence: "She chose a nice tie ___ her husband.",
    question: "교안 p.4: choose를 3형식으로 전환할 때 알맞은 전치사는?",
    choices: ["to", "for", "of", "with"],
    answer: 1,
    explanation: "교안 p.4: choose는 '정성'이 들어가는 동사로 3형식 전환 시 for를 씁니다."
  },
  {
    id: 113, set: 2, category: "4형식",
    sentence: "I'll cook a delicious dinner ___ you.",
    question: "교안 p.4: cook을 3형식으로 전환할 때 알맞은 전치사는?",
    choices: ["for", "to", "of", "at"],
    answer: 0,
    explanation: "교안 p.4: cook은 3형식 전환 시 전치사 for를 사용하는 동사입니다."
  },
  {
    id: 114, set: 2, category: "4형식",
    sentence: "He inquired the time ___ the clerk.",
    question: "교안 p.4: inquire를 3형식으로 전환할 때 알맞은 전치사는?",
    choices: ["to", "for", "at", "of"],
    answer: 3,
    explanation: "교안 p.4: inquire, ask 등은 3형식 전환 시 전치사 of를 사용합니다."
  },

  // --- SET 3: 5형식 ---
  {
    id: 201, set: 3, category: "5형식",
    sentence: "The ecology made the lines ___ artificial.",
    question: "교안 p.5: 사역동사가 포함된 5형식 문장에서 목적격 보어로 알맞은 행태는?",
    choices: ["appear", "to appear", "appearing", "appeared"],
    answer: 0,
    explanation: "교안 p.5: 사역동사(make, have, let)는 목적격 보어로 동사원형을 취합니다."
  },
  {
    id: 202, set: 3, category: "5형식",
    sentence: "These colors make people ___ to eat more.",
    question: "교안 p.5: 빈칸에 들어갈 수 없는 형태는?",
    choices: ["want", "desire", "to want", "feel (wanting)"],
    answer: 2,
    explanation: "교안 p.5: 사역동사 make의 목적격 보어로는 to부정사를 쓸 수 없습니다."
  },
  {
    id: 203, set: 3, category: "5형식",
    sentence: "He had the mechanic ___ his car.",
    question: "교안 p.5: 사역동사 have가 목적어와 능동 관계일 때 알맞은 보어 형태는?",
    choices: ["repair", "to repair", "repairing", "repaired"],
    answer: 0,
    explanation: "교안 p.5: 사역동사 have + 목적어 + 동사원형(능동) 구조입니다."
  },
  {
    id: 204, set: 3, category: "5형식",
    sentence: "I saw a cute girl ___ at me.",
    question: "교안 p.5: 지각동사 see 뒤에 진행의 의미를 강조할 때 쓰는 보어 형태는?",
    choices: ["smiling", "to smile", "smiled", "be smiling"],
    answer: 0,
    explanation: "교안 p.5: 지각동사 뒤에는 동사원형이나 현재분사(-ing)가 올 수 있습니다."
  },
  {
    id: 205, set: 3, category: "5형식",
    sentence: "I'll get the work ___ by tonight.",
    question: "교안 p.5: 목적어(work)와 보어의 관계가 수동일 때 알맞은 형태는?",
    choices: ["finished", "finish", "to finish", "finishing"],
    answer: 0,
    explanation: "교안 p.5: get + 목적어 + p.p.(수동) 구조입니다."
  },
  {
    id: 206, set: 3, category: "5형식",
    sentence: "He ___ me to come to the front.",
    question: "교안 p.6: 목적격 보어로 to부정사를 취하는 want류 동사는?",
    choices: ["asked", "made", "let", "had"],
    answer: 0,
    explanation: "교안 p.6: ask, want, tell, allow 등은 목적격 보어로 to부정사를 취합니다."
  },
  {
    id: 207, set: 3, category: "5형식",
    sentence: "Tom helped me ___ my homework.",
    question: "교안 p.6: 준사역동사 help의 목적격 보어로 가능한 것은?",
    choices: ["do (to do)", "doing", "done", "will do"],
    answer: 0,
    explanation: "교안 p.6: help는 목적격 보어로 동사원형과 to부정사 모두 가능합니다."
  },
  {
    id: 208, set: 3, category: "5형식",
    sentence: "The teacher ___ me to study harder.",
    question: "교안 p.6: 빈칸에 가장 적절한 '권고/격려' 동사는?",
    choices: ["encouraged", "let", "made", "watched"],
    answer: 0,
    explanation: "교안 p.6: encourage는 목적격 보어로 to부정사를 취하는 대표적 동사입니다."
  },
  {
    id: 209, set: 3, category: "5형식",
    sentence: "Modern technology has made many jobs ___.",
    question: "교안 p.6: 5형식 문장에서 목적격 보어로 알맞은 형태는?",
    choices: ["easier", "easily", "more easily", "to be easy"],
    answer: 0,
    explanation: "교안 p.6: make + 목적어 + 형용사(보어) 구조입니다."
  },
  {
    id: 210, set: 3, category: "5형식",
    sentence: "The doctor ___ me to go to bed early.",
    question: "교안 p.6: 목적격 보어로 to부정사를 취하며 '충고하다'의 의미를 가진 동사는?",
    choices: ["advised", "made", "let", "had"],
    answer: 0,
    explanation: "교안 p.6: advise는 목적격 보어로 to부정사를 취하는 'want류' 동사입니다."
  },
  {
    id: 211, set: 3, category: "5형식",
    sentence: "I heard my name ___ in the crowd.",
    question: "교안 p.6: 지각동사 hear의 목적어와 보어의 관계가 수동일 때 알맞은 형태는?",
    choices: ["called", "calling", "to call", "call"],
    answer: 0,
    explanation: "교안 p.6: '이름이 불리는 것'이므로 수동의 의미인 과거분사(called)를 씁니다."
  },
  {
    id: 212, set: 3, category: "5형식",
    sentence: "My mom ___ me wash the dishes.",
    question: "교안 p.6: 사역동사가 사용된 문장에서 빈칸에 알맞은 것은?",
    choices: ["had", "allowed", "encouraged", "wanted"],
    answer: 0,
    explanation: "교안 p.6: 보어가 동사원형(wash)이므로 사역동사 have(had)가 적절합니다."
  },
  {
    id: 213, set: 3, category: "5형식",
    sentence: "The law ___ them to pay the fine.",
    question: "교안 p.6: 목적격 보어로 to부정사를 취하는 want류 동사는?",
    choices: ["forced", "made", "let", "had"],
    answer: 0,
    explanation: "교안 p.6: force는 목적격 보어로 to부정사를 취하는 대표적인 동사입니다."
  },
  {
    id: 214, set: 3, category: "5형식",
    sentence: "We ___ someone call for help.",
    question: "교안 p.6: 지각동사 뒤에 동사원형 보어가 온 올바른 형태는?",
    choices: ["heard", "told", "asked", "advised"],
    answer: 0,
    explanation: "교안 p.6: hear는 지각동사로 목적격 보어에 동사원형(call)이 올 수 있습니다."
  },
  {
    id: 215, set: 3, category: "5형식",
    sentence: "He ___ me a book as a gift.",
    question: "교안 p.4: 4형식 목적어 어순(간목+직목)으로 알맞은 것은?",
    choices: ["gave", "is given", "was given", "gives to"],
    answer: 0,
    explanation: "교안 p.4: give 뒤에는 간접목적어(me)와 직접목적어(a book)가 바로 옵니다."
  },
  {
    id: 216, set: 3, category: "5형식",
    sentence: "The technician got the machine ___ again.",
    question: "교안 p.6: 준사역동사 get의 목적어와 보어의 관계가 능동일 때 알맞은 형태는?",
    choices: ["to work", "work", "working", "worked"],
    answer: 0,
    explanation: "교안 p.6: get은 목적격 보어로 to부정사를 취하며, '능동'의 의미를 가집니다."
  },
  {
    id: 217, set: 3, category: "5형식",
    sentence: "I had my hair ___ at the salon.",
    question: "교안 p.6: 사역동사가 사용된 문장에서 목적어와 보어의 관계가 수동일 때 형태는?",
    choices: ["cut", "to cut", "be cut", "cutting"],
    answer: 0,
    explanation: "교안 p.6: '머리카락이 잘리는 것'이므로 사역동사 have의 보어로 과거분사(cut)를 씁니다."
  },

  // --- SET 4: 준동사 ---
  {
    id: 301, set: 4, category: "목적어",
    sentence: "I finished ___ my room.",
    question: "finish의 목적어로 알맞은 형태는?",
    choices: ["to clean", "cleaning", "clean", "to be cleaned"],
    answer: 1,
    explanation: "finish, quit, stop, give up, enjoy, avoid 등은 동명사(-ing)만을 목적어로 취합니다."
  },
  {
    id: 302, set: 4, category: "목적어",
    sentence: "I hope ___ you again soon.",
    question: "hope의 목적어로 알맞은 형태는?",
    choices: ["seeing", "to see", "see", "to be seen"],
    answer: 1,
    explanation: "hope, want, decide, plan, promise 등 미래지향적인 동사는 to부정사를 목적어로 취합니다."
  },
  {
    id: 303, set: 4, category: "목적어",
    sentence: "I remember ___ him before.",
    question: "'전에 만났던 것을 기억하다'의 의미로 알맞은 것은?",
    choices: ["meeting", "to meet", "meet", "met"],
    answer: 0,
    explanation: "remember/forget 뒤에 -ing는 과거의 일, to V는 미래(해야 할 일)를 의미합니다."
  },
  {
    id: 304, set: 4, category: "목적어",
    sentence: "I regret ___ you that you failed.",
    question: "'~하게 되어 유감이다'의 의미로 알맞은 것은?",
    choices: ["telling", "to tell", "tell", "having told"],
    answer: 1,
    explanation: "regret -ing는 했던 일을 후회하는 것, regret to V는 하게 되어 유감인 것을 의미합니다."
  },
  {
    id: 305, set: 4, category: "관용표현",
    sentence: "I'm looking forward to ___ you.",
    question: "빈칸에 알맞은 형태는?",
    choices: ["meet", "meeting", "to meet", "be met"],
    answer: 1,
    explanation: "look forward to의 to는 전치사이므로 뒤에 동명사(-ing)가 와야 합니다."
  },
  {
    id: 306, set: 4, category: "동명사 관용",
    sentence: "I couldn't help ___ at the joke.",
    question: "빈칸에 알맞은 '~하지 않을 수 없었다'는 의미의 표현은?",
    choices: ["laugh", "laughing", "to laugh", "laughed"],
    answer: 1,
    explanation: "cannot help -ing는 '~하지 않을 수 없다'는 의미의 관용표현입니다."
  },
  {
    id: 307, set: 4, category: "준동사 시제",
    sentence: "He seems ___ a famous star in his youth.",
    question: "주절의 시제보다 '이전의 일'을 나타내는 알맞은 형태는?",
    choices: ["to be", "being", "to have been", "having been"],
    answer: 2,
    explanation: "주절의 시제(seems)보다 과거의 일(~이었던 것 같다)을 나타낼 때는 완료부정사(to have p.p.)를 씁니다."
  },
  {
    id: 308, set: 4, category: "to부정사 용법",
    sentence: "He is rich enough ___ a sports car.",
    question: "빈칸에 알맞은 형태는?",
    choices: ["buy", "buying", "to buy", "to be bought"],
    answer: 2,
    explanation: "형용사 + enough + to V 구문은 '~할 만큼 충분히 ...하다'라는 뜻입니다."
  },
  {
    id: 309, set: 4, category: "의미상 주어",
    sentence: "It was very kind ___ you to help me.",
    question: "사람의 성품을 나타내는 형용사(kind)와 함께 쓰이는 의미상 주어 형태는?",
    choices: ["for", "of", "to", "by"],
    answer: 1,
    explanation: "사람의 성격/태도를 나타내는 형용사(kind, nice, brave 등) 뒤에는 'of + 목적격'으로 의미상 주어를 나타냅니다."
  },
  {
    id: 310, set: 4, category: "목적어",
    sentence: "He stopped ___ a cigarette.",
    question: "'담배를 피우기 위해서 멈추다'의 의미로 알맞은 것은?",
    choices: ["smoking", "to smoke", "smoke", "smoked"],
    answer: 1,
    explanation: "stop -ing는 하던 일을 멈추는 것, stop to V는 ~하기 위해 (가던 길을) 멈추는 것을 뜻합니다."
  },
  {
    id: 311, set: 4, category: "동명사 부정",
    sentence: "He is ashamed of ___ rich.",
    question: "'부자가 아닌 것'을 부끄러워한다는 의미로 알맞은 것은?",
    choices: ["not being", "being not", "to not be", "not to be"],
    answer: 0,
    explanation: "준동사(to부정사, 동명사, 분사)의 부정어(not/never)는 항상 준동사 바로 앞에 위치합니다."
  },
  {
    id: 312, set: 4, category: "동명사 관용",
    sentence: "It is no use ___ over spilt milk.",
    question: "이미 엎질러진 물이다(~해도 소용없다)는 의미의 관용구는?",
    choices: ["to cry", "crying", "cry", "cried"],
    answer: 1,
    explanation: "It is no use -ing는 '~해도 소용없다'는 의미의 동명사 관용 표현입니다."
  },
  {
    id: 313, set: 4, category: "to부정사 결과",
    sentence: "He woke up ___ himself famous.",
    question: "부정어의 결과(자고 일어나서 ~임을 알게 되다)를 나타내는 알맞은 형태는?",
    choices: ["to find", "finding", "found", "to have found"],
    answer: 0,
    explanation: "woke up to find, grew up to be 등은 to부정사의 부사적 용법 중 '결과'를 나타냅니다."
  },
  {
    id: 314, set: 4, category: "목적어",
    sentence: "He tried ___ the door, but it was locked.",
    question: "'시험 삼아 ~해보다'라는 의미로 알맞은 것은?",
    choices: ["to open", "opening", "open", "be opened"],
    answer: 1,
    explanation: "try -ing는 시험 삼아 한 번 해보다, try to V는 ~하려고 노력하다(애쓰다)는 뜻입니다."
  },
  {
    id: 315, set: 4, category: "to부정사 형용사",
    sentence: "I have many things ___ today.",
    question: "빈칸에 알맞은 형용사적 용법의 형태는?",
    choices: ["do", "doing", "to do", "done"],
    answer: 2,
    explanation: "명사(things)를 뒤에서 수식하여 '~할 것'이라는 의미를 나타내는 to부정사의 형용사적 용법입니다."
  },
  {
    id: 316, set: 4, category: "전치사의 to",
    sentence: "What do you say to ___ for a walk?",
    question: "'~하는 게 어때?'라는 관용 표현에 알맞은 형태는?",
    choices: ["go", "going", "to go", "being gone"],
    answer: 1,
    explanation: "What do you say to -ing의 to는 전치사이므로 뒤에 동명사가 와야 합니다."
  },

  // --- SET 5: 분사구문 ---
  {
    id: 401, set: 5, category: "분사구문",
    sentence: "___ along the street, I met a friend of mine.",
    question: "교안 p.10: '길을 따라 걸을 때'를 뜻하는 알맞은 분사구문 형태는?",
    choices: ["Walking", "Walked", "To walk", "In walk"],
    answer: 0,
    explanation: "교안 p.10: 시간의 의미를 담아 현재분사(-ing)로 시작하는 분사구문입니다."
  },
  {
    id: 402, set: 5, category: "분사구문",
    sentence: "___ sick, he couldn't attend the meeting.",
    question: "교안 p.10: '아팠기 때문에'를 뜻하는 알맞은 분사구문 형태는?",
    choices: ["Being", "Been", "To be", "Was"],
    answer: 0,
    explanation: "교안 p.10: 이유의 의미를 담은 분사구문으로 Being은 생략 가능하기도 하지만 여기선 필수 성분입니다."
  },
  {
    id: 403, set: 5, category: "분사구문",
    sentence: "___ he is right, I cannot forgive him.",
    question: "교안 p.10: '그가 옳다는 것을 인정하지만'을 뜻하는 분사구문 형태는?",
    choices: ["Admitting", "Admitted", "To admit", "With admitting"],
    answer: 0,
    explanation: "교안 p.10: 양보의 의미를 담은 분사구문입니다."
  },
  {
    id: 404, set: 5, category: "부대상황",
    sentence: "He sat there ___ his eyes closed.",
    question: "교안 p.8/10: '눈을 감은 채로'를 뜻하는 부대상황의 전치사는?",
    choices: ["with", "by", "in", "as"],
    answer: 0,
    explanation: "교안 p.8: with + 목적어 + 분사는 '~한 채로'라는 부대상황을 나타냅니다."
  },
  {
    id: 405, set: 5, category: "독립분사구문",
    sentence: "___ coming on, we left for home.",
    question: "교안 p.12: 주어가 다를 때 남겨두는 의미상의 주어가 포함된 형태는?",
    choices: ["Night", "As night", "It", "There"],
    answer: 0,
    explanation: "교안 p.12: Night coming on은 '밤이 와서'라는 독립분사구문입니다."
  },
  {
    id: 406, set: 5, category: "분사구문 시제",
    sentence: "___ the work, I went to bed.",
    question: "교안 p.12: '일을 마쳤을 때'처럼 주절보다 앞선 시제를 나타내는 분사구문은?",
    choices: ["Having finished", "Finishing", "Finished", "To finish"],
    answer: 0,
    explanation: "교안 p.12: 주절보다 과거인 완료 시제는 Having p.p. 형태를 씁니다."
  },
  {
    id: 407, set: 5, category: "분사구문 수동",
    sentence: "___ from the plane, the island was beautiful.",
    question: "교안 p.12: '비행기에서 보였을 때'와 같이 수동의 의미인 분사 형태는?",
    choices: ["Seen", "Seeing", "To see", "Having seen"],
    answer: 0,
    explanation: "교안 p.12: Being이 생략된 과거분사(p.p.) 형태의 수동 분사구문입니다."
  },
  {
    id: 408, set: 5, category: "분사구문 부정",
    sentence: "___ him, I kept silent.",
    question: "교안 p.12: '그를 몰라서'와 같이 부정어의 올바른 위치는?",
    choices: ["Not knowing", "Knowing not", "No knowing", "To not know"],
    answer: 0,
    explanation: "교안 p.12: 분사구문의 부정은 분사 앞에 not을 추가합니다."
  },
  {
    id: 409, set: 5, category: "분사구문",
    sentence: "___ the door, I saw my mom.",
    question: "교안 p.10: '문을 열었을 때'를 의미하는 올바른 분사구문은?",
    choices: ["Opening", "Opened", "To open", "Being opened"],
    answer: 0,
    explanation: "교안 p.10: 시간(~할 때)을 나타내는 현재분사 형태의 분사구문입니다."
  },
  {
    id: 410, set: 5, category: "분사구문",
    sentence: "___ to the left, you will see the building.",
    question: "교안 p.10: '왼쪽으로 돈다면'이라는 조건의 의미를 가진 분사구문은?",
    choices: ["Turning", "Turned", "To turn", "Turn"],
    answer: 0,
    explanation: "교안 p.10: 조건(~한다면)의 의미를 담은 분사구문입니다."
  },
  {
    id: 411, set: 5, category: "분사구문",
    sentence: "___ sick, he couldn't attend the meeting.",
    question: "교안 p.10: '아팠기 때문에'라는 이유의 의미를 담은 분사구문은?",
    choices: ["Being", "Been", "Was", "As"],
    answer: 0,
    explanation: "교안 p.10: 이유(~때문에)를 나타낼 때 Being을 사용하여 분사구문을 만듭니다."
  },
  {
    id: 412, set: 5, category: "독립분사구문",
    sentence: "___ being a fine day, we went out for a walk.",
    question: "교안 p.12: 주절의 주어와 다를 때 사용되는 올바른 주어(비인칭 독립분사구문)는?",
    choices: ["It", "Weather", "There", "They"],
    answer: 0,
    explanation: "교안 p.12: 날씨를 나타낼 때 주어 It을 생략하지 않고 남겨두는 독립분사구문입니다."
  },
  {
    id: 413, set: 5, category: "분사구문 수동",
    sentence: "___ in haste, the book has many faults.",
    question: "교안 p.12/13: '서둘러서 쓰여졌기 때문에'라는 수동 의미의 알맞은 분사 형태는?",
    choices: ["Written", "Writing", "To write", "Having written"],
    answer: 0,
    explanation: "교안 p.12: 수동태 구문에서 (Being이나 Having been)이 생략된 과거분사 Written이 적절합니다."
  },
  {
    id: 414, set: 5, category: "부대상황",
    sentence: "She waved her hands, ___ brightly.",
    question: "교안 p.10: '밝게 웃으면서'라는 부대상황을 나타내는 알맞은 분사 형태는?",
    choices: ["smiling", "smiled", "to smile", "being smiled"],
    answer: 0,
    explanation: "교안 p.10: 두 가지 동작이 동시에 일어날 때 현재분사를 사용합니다."
  },
  {
    id: 415, set: 5, category: "분사구문",
    sentence: "___ from the distance, the island looks small.",
    question: "교안 p.12: '멀리서 보여질 때'의 의미로 Being이 생략된 수동 분사구문은?",
    choices: ["Seen", "Seeing", "To see", "Saw"],
    answer: 0,
    explanation: "교안 p.12: 수동태 구문에서 (Being)이 생략된 과거분사(p.p.) 형태입니다."
  },
  {
    id: 416, set: 5, category: "분사구문",
    sentence: "___ not what to do, I remained silent.",
    question: "교안 p.12: 분사구문 부정어(Not)의 올바른 위치는?",
    choices: ["Not knowing", "Knowing not", "No knowing", "To not know"],
    answer: 0,
    explanation: "교안 p.12: 분사구문의 부정은 분사 앞에 not을 추가합니다."
  },
  {
    id: 417, set: 5, category: "분사구문",
    sentence: "When ___ across time zones, people feel tired.",
    question: "교안 p.8: 접속사가 생략되지 않은 분사구문의 올바른 형태는?",
    choices: ["traveling", "traveled", "to travel", "in travel"],
    answer: 0,
    explanation: "교안 p.8: 접속사 뒤에 분사가 오는 형태의 분사구문입니다."
  },
  {
    id: 418, set: 5, category: "분사구문",
    sentence: "___ that he is young, he is very wise.",
    question: "교안 p.11: '양보(~임에도 불구하고)'의 의미를 가진 분사구문은?",
    choices: ["Admitting", "Admitted", "To admit", "By admitting"],
    answer: 0,
    explanation: "교안 p.11: Admitting (that)은 '~을 인정하더라도, ~임에도 불구하고'라는 양보의 의미로 쓰입니다."
  },
  {
    id: 419, set: 5, category: "독립분사구문",
    sentence: "___ coming on, we started for home.",
    question: "교안 p.12: 주어가 다른 독립분사구문(Night coming on)에서 빈칸에 알맞은 주어는?",
    choices: ["Night", "It", "There", "The night"],
    answer: 0,
    explanation: "교안 p.12: '밤이 다가오자'라는 의미의 독립분사구문으로, 주어 Night를 써야 합니다."
  },

  // --- SET 6: 시제/특수구문 ---
  {
    id: 501, set: 6, category: "시제",
    sentence: "If it ___ tomorrow, we will stay home.",
    question: "시간/조건의 부사절 법칙에 따라 알맞은 형태는?",
    choices: ["rains", "will rain", "rained", "is raining"],
    answer: 0,
    explanation: "시간이나 조건의 부사절(if, when 등)에서는 현재시제가 미래를 대신합니다."
  },
  {
    id: 502, set: 6, category: "수의일치",
    sentence: "The number of students ___ increasing.",
    question: "빈칸에 알맞은 동사는?",
    choices: ["is", "are", "have", "were"],
    answer: 0,
    explanation: "'The number of'(~의 수)는 단수 취급, 'A number of'(많은)는 복수 취급합니다."
  },
  {
    id: 503, set: 6, category: "동격",
    sentence: "The news ___ he won the race surprised us.",
    question: "빈칸에 알맞은 동격의 접속사는?",
    choices: ["which", "what", "that", "how"],
    answer: 2,
    explanation: "추상명사 뒤에 완전한 절이 오는 경우 동격의 접속사 that을 사용합니다."
  },
  {
    id: 504, set: 6, category: "가목적어",
    sentence: "I found ___ difficult to solve the problem.",
    question: "빈칸에 알맞은 가목적어는?",
    choices: ["this", "that", "it", "which"],
    answer: 2,
    explanation: "목적어가 to부정사/that절인 경우 가목적어 it을 사용합니다."
  },
  {
    id: 505, set: 6, category: "시제",
    sentence: "By the time he arrives, we ___ our work.",
    question: "미래의 어느 시점까지 완료될 일을 나타내는 알맞은 시제는?",
    choices: ["finish", "will finish", "will have finished", "finished"],
    answer: 2,
    explanation: "미래의 특정 시점까지 완료될 상황을 나타낼 때는 미래완료(will have p.p.)를 사용합니다."
  },
  {
    id: 506, set: 6, category: "도치",
    sentence: "Never ___ I seen such a beautiful sunset.",
    question: "부정어(Never)가 문두에 올 때 일어나는 올바른 도치 형태는?",
    choices: ["I have", "have I", "I had", "did I"],
    answer: 1,
    explanation: "Never, Little, Seldom 등 부정어가 문두에 오면 '조동사 + 주어' 순으로 도치됩니다."
  },
  {
    id: 507, set: 6, category: "조동사",
    sentence: "You ___ have told her the truth yesterday.",
    question: "'어제 그녀에게 진실을 말했어야 했다(후회)'의 의미로 알맞은 조동사는?",
    choices: ["must", "should", "could", "would"],
    answer: 1,
    explanation: "should have p.p.는 과거에 하지 못한 일에 대한 후회나 유감(~했어야 했다)을 나타냅니다."
  },
  {
    id: 508, set: 6, category: "조동사",
    sentence: "He ___ have been rich in the past.",
    question: "'과거에 부자였음에 틀림없다(확신)'의 의미로 알맞은 조동사는?",
    choices: ["must", "cannot", "may", "should"],
    answer: 0,
    explanation: "must have p.p.는 과거의 일에 대한 강한 긍정적 추측(~했음에 틀림없다)을 나타냅니다."
  },
  {
    id: 509, set: 6, category: "강조",
    sentence: "It is my parents ___ encourage me.",
    question: "주어를 강조하는 'It is ~ that' 강조구문에서 알맞은 접속사는?",
    choices: ["which", "who(that)", "whom", "whose"],
    answer: 1,
    explanation: "It is ~ that 강조구문에서 강조하는 대상이 사람인 경우 who를 쓸 수도 있습니다."
  },
  {
    id: 510, set: 6, category: "수의일치",
    sentence: "Each of the boys ___ a bike.",
    question: "Each가 주어일 때 알맞은 동사의 형태는?",
    choices: ["have", "has", "having", "to have"],
    answer: 1,
    explanation: "Each, Every, Either 등은 단수 취급하므로 단수 동사(has)를 씁니다."
  },
  {
    id: 511, set: 6, category: "특수구문",
    sentence: "Hardly ___ I started when it began to rain.",
    question: "'~하자마자 ...하다'의 의미를 가진 도치 구문에 알맞은 형태는?",
    choices: ["I had", "had I", "I did", "did I"],
    answer: 1,
    explanation: "Hardly/Scarcely + had + 주어 + p.p. ~ when/before ... 구문은 '~하자마자 ...하다'는 뜻입니다."
  },
  {
    id: 512, set: 6, category: "동격",
    sentence: "I have no idea ___ she will come.",
    question: "완전한 절을 이끄는 동격의 접속사로 알맞은 것은?",
    choices: ["which", "whether", "what", "whom"],
    answer: 1,
    explanation: "완전한 절이 오며 '~인지 아닌지'라는 불확실한 내용을 담을 때 whether를 동격 접속사로 쓸 수 있습니다."
  },
  {
    id: 513, set: 6, category: "가정법",
    sentence: "If I ___ you, I wouldn't do that.",
    question: "현재 사실과 반대되는 가정법 과거 구문에 알맞은 동사는?",
    choices: ["am", "was", "were", "been"],
    answer: 2,
    explanation: "가정법 과거에서 be동사는 주어에 상관없이 were를 쓰는 것이 원칙입니다."
  },
  {
    id: 514, set: 6, category: "가정법",
    sentence: "I wish I ___ harder when I was a student.",
    question: "과거 사실에 대한 아쉬움을 나타내는 'I wish' 가정법 과거완료에 알맞은 형태는?",
    choices: ["study", "studied", "had studied", "would study"],
    answer: 2,
    explanation: "I wish 뒤에 과거 사실에 대한 반대나 유감을 나타낼 때는 가정법 과거완료(had p.p.)를 씁니다."
  },
  {
    id: 515, set: 6, category: "주요명제",
    sentence: "He suggested that she ___ a doctor.",
    question: "제안(suggest)의 동사 뒤 coming that절에 알맞은 동사 형태는?",
    choices: ["see", "sees", "saw", "must see"],
    answer: 0,
    explanation: "제안, 주장, 권고, 요구 등의 동사 뒤의 that절에는 '(should) + 동사원형'을 씁니다."
  },
  {
    id: 516, set: 6, category: "시제",
    sentence: "The teacher said that the earth ___ round.",
    question: "시제 일치의 예외(변하지 않는 진리)에 해당할 때 알맞은 시제는?",
    choices: ["is", "was", "has been", "will be"],
    answer: 0,
    explanation: "불변의 진리나 격언 등은 주절의 시제와 상관없이 항상 현재시제로 씁니다."
  },
  {
    id: 517, set: 6, category: "관계사",
    sentence: "That is the house ___ I lived in.",
    question: "전치사 in의 목적어 역할을 하는 알맞은 관계대명사는?",
    choices: ["which", "in which", "where", "what"],
    answer: 0,
    explanation: "전치사 in이 문장 끝에 남아있으므로 목적격 관계대명사 which가 적절합니다. (in which는 관계부사 where와 같습니다)"
  }
];
