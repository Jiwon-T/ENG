export interface VerbFormQuiz {
  id: number;
  set: number;
  sentence: string;
  question: string;
  choices: string[];
  answer: number;
  explanation: string;
  verb: string;
}

export const VERB_FORM_QUIZ_POOL: VerbFormQuiz[] = [
  // 1세트: 1형식 전용 동사
  {
    id: 101, set: 1, verb: "happen",
    sentence: "An accident ___ on the highway this morning.",
    question: "빈칸에 알맞은 동사와 의미는?",
    choices: ["happened (일어나다, 1형식)", "happened me (나에게 일어나다)", "was happened (수동태 불가)", "happened something (무언가를 일어나게 하다)"],
    answer: 0,
    explanation: "happen은 1형식 자동사로 수동태 불가. 목적어 없이 단독으로 쓰인다."
  },
  {
    id: 102, set: 1, verb: "occur",
    sentence: "A great idea ___ to me in the shower.",
    question: "빈칸에 알맞은 동사와 의미는?",
    choices: ["occurred (일어나다/떠오르다, 1형식)", "occurred me", "was occurred", "occurred an idea"],
    answer: 0,
    explanation: "occur는 1형식 자동사로 'occur to + 사람' 형태로 쓰인다. 수동태 불가."
  },
  {
    id: 103, set: 1, verb: "rise",
    sentence: "Prices ___ sharply last year.",
    question: "빈칸에 알맞은 동사와 의미는?",
    choices: ["rose (오르다, 1형식)", "rose prices (가격을 올리다)", "was risen", "raised (타동사, O 필요)"],
    answer: 0,
    explanation: "rise는 1형식 자동사로 목적어 없이 쓰인다. raise는 타동사로 구별 필요."
  },
  {
    id: 104, set: 1, verb: "matter",
    sentence: "Every vote ___.",
    question: "빈칸에 알맞은 동사와 의미는?",
    choices: ["matters (중요하다, 1형식)", "matters something", "is mattered", "matters to us something"],
    answer: 0,
    explanation: "matter는 1형식 자동사로 '중요하다'의 의미. 목적어 없이 단독으로 쓰인다."
  },
  {
    id: 105, set: 1, verb: "fall",
    sentence: "The leaves ___ in autumn.",
    question: "빈칸에 알맞은 동사와 의미는? (1형식)",
    choices: ["fall (떨어지다, 1형식)", "fall C한 상태가 되다 (2형식)", "fall the leaves", "are fallen"],
    answer: 0,
    explanation: "fall은 1형식으로 쓰일 때 '떨어지다'의 의미. 목적어 없이 단독으로 쓰인다."
  },
  {
    id: 106, set: 1, verb: "work",
    sentence: "The machine ___ perfectly.",
    question: "빈칸에 알맞은 동사와 의미는?",
    choices: ["works (작동되다, 1형식)", "works the machine", "is worked", "works something"],
    answer: 0,
    explanation: "work는 1형식으로 '작동되다, 효과가 있다'의 의미. 목적어 없이 쓰인다."
  },
  {
    id: 107, set: 1, verb: "last",
    sentence: "The concert ___ for three hours.",
    question: "빈칸에 알맞은 동사와 의미는?",
    choices: ["lasted (계속되다, 1형식)", "lasted the audience", "was lasted", "lasted long time"],
    answer: 0,
    explanation: "last는 1형식으로 '계속되다, 지속되다'의 의미. 수동태 불가."
  },
  {
    id: 108, set: 1, verb: "work",
    sentence: "Does this plan ___?",
    question: "빈칸에 알맞은 동사와 의미는? (1형식)",
    choices: ["work (효과가 있다, 1형식)", "work the plan", "is worked", "work us"],
    answer: 0,
    explanation: "work는 1형식으로 '효과가 있다'의 의미로 쓰인다."
  },

  // 2세트: 2형식 전용 동사
  {
    id: 109, set: 2, verb: "seem",
    sentence: "She ___ happy about the news.",
    question: "빈칸에 알맞은 동사와 의미는? (2형식)",
    choices: ["seemed (C하게 보이다, 2형식)", "seemed her happy", "was seemed", "seemed happily"],
    answer: 0,
    explanation: "seem은 2형식 동사로 보어(C)를 취한다. 부사(happily)가 아닌 형용사(happy)가 온다."
  },
  {
    id: 110, set: 2, verb: "appear",
    sentence: "The situation ___ to be getting worse.",
    question: "빈칸에 알맞은 동사와 의미는?",
    choices: ["appears (C하게 보이다, 2형식)", "appears the situation", "is appeared", "appears badly"],
    answer: 0,
    explanation: "appear는 2형식 동사로 'appear + to부정사' 형태로도 쓰인다."
  },
  {
    id: 111, set: 2, verb: "stand",
    sentence: "He ___ still during the photo.",
    question: "빈칸에 알맞은 동사와 의미는?",
    choices: ["stood (계속해서 C인 상태에 있다, 2형식)", "stood him still", "was stood still", "stood stilly"],
    answer: 0,
    explanation: "stand는 2형식으로 '(계속해서) C인 상태에 있다'의 의미. still은 형용사 보어."
  },
  {
    id: 112, set: 2, verb: "lie",
    sentence: "The dog ___ motionless on the floor.",
    question: "빈칸에 알맞은 동사와 의미는?",
    choices: ["lay (계속해서 C이다, 2형식)", "lay the dog", "was lied", "laid motionlessly"],
    answer: 0,
    explanation: "lie는 2형식으로 '(계속해서) C이다'의 의미. motionless는 형용사 보어."
  },
  {
    id: 113, set: 2, verb: "remain",
    sentence: "The problem ___ unsolved for years.",
    question: "빈칸에 알맞은 동사와 의미는?",
    choices: ["remained (계속해서 C이다, 2형식)", "remained the problem", "was remained", "remained unsolvedly"],
    answer: 0,
    explanation: "remain은 2형식으로 '(계속해서) C이다'의 의미. unsolved는 형용사 보어."
  },
  {
    id: 114, set: 2, verb: "stay",
    sentence: "Please ___ calm in an emergency.",
    question: "빈칸에 알맞은 동사와 의미는?",
    choices: ["stay (C한 채로 있다, 2형식)", "stay calmly", "stay you calm", "be stayed calm"],
    answer: 0,
    explanation: "stay는 2형식으로 '(C한) 상태를 유지하다'의 의미. calm은 형용사 보어."
  },

  // 3세트: 1형식 vs 2형식 겸용
  {
    id: 115, set: 3, verb: "grow",
    sentence: "The boy ___ fast. (그 소년은 빠르게 자란다.)",
    question: "빈칸에 알맞은 표현과 문장 형식은?",
    choices: ["grows (자라다, 1형식)", "grows fast (2형식, C=fast)", "grows fastly", "is grown fast"],
    answer: 0,
    explanation: "grow + 부사(fast)는 1형식. '빠르게 자라다'의 의미. fast는 여기서 부사."
  },
  {
    id: 116, set: 3, verb: "grow",
    sentence: "She ___ nervous before the exam. (그녀는 시험 전에 긴장하게 됐다.)",
    question: "빈칸에 알맞은 표현과 문장 형식은?",
    choices: ["grew (C하게 되다, 2형식)", "grew nervously (1형식)", "was grown nervous", "grew her nervous"],
    answer: 0,
    explanation: "grow + 형용사(nervous)는 2형식. '~하게 되다'의 의미로 보어를 취한다."
  },
  {
    id: 117, set: 3, verb: "fall",
    sentence: "The temperature ___ below zero. (기온이 영하로 떨어졌다.)",
    question: "빈칸에 알맞은 표현과 문장 형식은?",
    choices: ["fell (떨어지다, 1형식)", "fell below zero (2형식)", "fell the temperature", "was fallen"],
    answer: 0,
    explanation: "fall + 부사구(below zero)는 1형식. 단순히 '떨어지다'의 의미."
  },
  {
    id: 118, set: 3, verb: "fall",
    sentence: "He ___ silent when I asked the question. (그는 내가 질문했을 때 조용해졌다.)",
    question: "빈칸에 알맞은 표현과 문장 형식은?",
    choices: ["fell (C한 상태가 되다, 2형식)", "fell silently (1형식)", "fell him silent", "was fallen silent"],
    answer: 0,
    explanation: "fall + 형용사(silent)는 2형식. '~한 상태가 되다'의 의미로 보어를 취한다."
  },
  {
    id: 119, set: 3, verb: "run",
    sentence: "The car ___ smoothly. (차가 매끄럽게 달린다.)",
    question: "빈칸에 알맞은 표현과 문장 형식은?",
    choices: ["runs (달리다/작동하다, 1형식)", "runs smoothly (2형식)", "runs the car smoothly", "is run smoothly"],
    answer: 0,
    explanation: "run + 부사(smoothly)는 1형식. '달리다, 작동하다'의 의미."
  },
  {
    id: 120, set: 3, verb: "run",
    sentence: "His face ___ red with anger. (그의 얼굴이 화로 인해 빨개졌다.)",
    question: "빈칸에 알맞은 표현과 문장 형식은?",
    choices: ["ran (C가 되다, 2형식)", "ran redly (1형식)", "ran his face red", "was run red"],
    answer: 0,
    explanation: "run + 형용사(red)는 2형식. '~가 되다'의 의미로 보어를 취한다."
  },
  {
    id: 121, set: 3, verb: "go",
    sentence: "Everything ___ according to plan. (모든 것이 계획대로 됐다.)",
    question: "빈칸에 알맞은 표현과 문장 형식은?",
    choices: ["went (가다, 1형식)", "went well (2형식, C=well)", "went the plan", "was gone"],
    answer: 0,
    explanation: "go + 부사구(according to plan)는 1형식. 단순 이동/진행의 의미."
  },
  {
    id: 122, set: 3, verb: "come",
    sentence: "Her dream ___ true. (그녀의 꿈이 이루어졌다.)",
    question: "빈칸에 알맞은 표현과 문장 형식은?",
    choices: ["came (C가 되다, 2형식)", "came truly (1형식)", "came her dream true", "was come true"],
    answer: 0,
    explanation: "come + 형용사(true)는 2형식. come true는 관용 표현으로 '이루어지다'의 의미."
  },

  // 4세트: 2형식 vs 3형식 겸용
  {
    id: 123, set: 4, verb: "smell",
    sentence: "The soup ___ delicious. (그 수프는 맛있는 냄새가 난다.)",
    question: "빈칸에 알맞은 표현과 문장 형식은?",
    choices: ["smells (a한 냄새가 나다, 2형식)", "smells deliciously (1형식)", "smells the soup", "is smelled delicious"],
    answer: 0,
    explanation: "smell + 형용사(delicious)는 2형식 감각동사. '~한 냄새가 나다'의 의미."
  },
  {
    id: 124, set: 4, verb: "smell",
    sentence: "The dog ___ the ground carefully. (개가 조심스럽게 땅 냄새를 맡았다.)",
    question: "빈칸에 알맞은 표현과 문장 형식은?",
    choices: ["smelled (O의 냄새를 맡다, 3형식)", "smelled carefully (2형식)", "was smelled the ground", "smelled carefully the ground"],
    answer: 0,
    explanation: "smell + 목적어(the ground)는 3형식. '~의 냄새를 맡다'의 의미."
  },
  {
    id: 125, set: 4, verb: "taste",
    sentence: "This cake ___ sweet. (이 케이크는 달콤한 맛이 난다.)",
    question: "빈칸에 알맞은 표현과 문장 형식은?",
    choices: ["tastes (a한 맛이 나다, 2형식)", "tastes sweetly", "tastes the cake sweet", "is tasted sweet"],
    answer: 0,
    explanation: "taste + 형용사(sweet)는 2형식 감각동사. '~한 맛이 나다'의 의미."
  },
  {
    id: 126, set: 4, verb: "taste",
    sentence: "She ___ the soup to see if it needed more salt.",
    question: "빈칸에 알맞은 표현과 문장 형식은?",
    choices: ["tasted (O의 맛을 보다, 3형식)", "tasted salty (2형식)", "was tasted the soup", "tasted saltily"],
    answer: 0,
    explanation: "taste + 목적어(the soup)는 3형식. '~의 맛을 보다'의 의미."
  },
  {
    id: 127, set: 4, verb: "sound",
    sentence: "The music ___ strange to me.",
    question: "빈칸에 알맞은 표현과 문장 형식은?",
    choices: ["sounded (a하게 들리다, 2형식)", "sounded strangely", "sounded the music strange", "was sounded strange"],
    answer: 0,
    explanation: "sound + 형용사(strange)는 2형식 감각동사. '~하게 들리다'의 의미."
  },
  {
    id: 128, set: 4, verb: "look",
    sentence: "You ___ tired. Are you okay?",
    question: "빈칸에 알맞은 표현과 문장 형식은?",
    choices: ["look (a하게 보이다, 2형식)", "look tiredly", "look you tired", "are looked tired"],
    answer: 0,
    explanation: "look + 형용사(tired)는 2형식 감각동사. '~하게 보이다'의 의미."
  },
  {
    id: 129, set: 4, verb: "feel",
    sentence: "The blanket ___ soft.",
    question: "빈칸에 알맞은 표현과 문장 형식은?",
    choices: ["feels (a한 느낌이 나다, 2형식)", "feels softly", "feels the blanket soft", "is felt soft"],
    answer: 0,
    explanation: "feel + 형용사(soft)는 2형식 감각동사. '~한 느낌이 나다'의 의미."
  },
  {
    id: 130, set: 4, verb: "feel",
    sentence: "She ___ someone touch her shoulder.",
    question: "빈칸에 알맞은 표현과 문장 형식은?",
    choices: ["felt (O를 느끼다/만져보다, 3형식 → 5형식 확장)", "felt softly", "was felt someone", "felt touchingly"],
    answer: 0,
    explanation: "feel + 목적어(someone)는 3형식/5형식으로 확장 가능. '~를 느끼다'의 의미."
  },
  {
    id: 131, set: 4, verb: "taste",
    sentence: "The milk ___ sour. (우유가 상한 맛이 난다.)",
    question: "빈칸에 알맞은 표현과 문장 형식은?",
    choices: ["tastes (a한 맛이 나다, 2형식)", "tastes sourly", "is tasted sour", "tasted the milk sour"],
    answer: 0,
    explanation: "taste + 형용사(sour)는 2형식. 감각동사 뒤에는 형용사 보어가 온다."
  },
  {
    id: 132, set: 4, verb: "turn",
    sentence: "The wheels ___. (바퀴가 돌다.)",
    question: "빈칸에 알맞은 표현과 문장 형식은? (1형식)",
    choices: ["turned (돌다, 1형식)", "turned the wheel (3형식)", "turned round (2형식)", "was turned"],
    answer: 0,
    explanation: "turn은 1형식으로 '돌다'의 의미. 목적어 없이 쓰인다."
  },
  {
    id: 133, set: 4, verb: "turn",
    sentence: "Her face ___ pale. (그녀의 얼굴이 창백해졌다.)",
    question: "빈칸에 알맞은 표현과 문장 형식은? (2형식)",
    choices: ["turned (C가 되다/C 상태로 변하다, 2형식)", "turned palely (1형식)", "turned her face pale (5형식)", "was turned pale"],
    answer: 0,
    explanation: "turn + 형용사(pale)는 2형식. '~한 상태로 변하다'의 의미."
  },
  {
    id: 134, set: 4, verb: "turn",
    sentence: "He ___ the pancake carefully. (그는 조심스럽게 팬케이크를 뒤집었다.)",
    question: "빈칸에 알맞은 표현과 문장 형식은? (3형식)",
    choices: ["turned (O를 뒤집다, 3형식)", "turned carefully (1형식)", "turned pale (2형식)", "was turned the pancake"],
    answer: 0,
    explanation: "turn + 목적어(the pancake)는 3형식. 'O를 뒤집다/돌리다'의 의미."
  },

  // 5세트: 3형식 전용 동사
  {
    id: 135, set: 5, verb: "discuss",
    sentence: "We ___ the issue for hours.",
    question: "빈칸에 알맞은 표현과 의미는?",
    choices: ["discussed (O에 대해 토론하다, 3형식)", "discussed about the issue", "discussed on the issue", "was discussed the issue"],
    answer: 0,
    explanation: "discuss는 3형식 타동사로 전치사 없이 목적어를 바로 취한다. discuss about (X)"
  },
  {
    id: 136, set: 5, verb: "reach",
    sentence: "She ___ for the remote control.",
    question: "빈칸에 알맞은 표현과 의미는?",
    choices: ["reached (~로 손을 뻗다, 1형식 + for)", "reached the remote control (3형식)", "reached to the remote control", "was reached for"],
    answer: 0,
    explanation: "reach는 '~로 손을 뻗다'일 때 reach for + 명사(1형식 활용). '~에 도착하다'는 reach + 목적어(3형식)."
  },
  {
    id: 137, set: 5, verb: "reach",
    sentence: "She finally ___ the top of the mountain.",
    question: "빈칸에 알맞은 표현과 의미는?",
    choices: ["reached (O에 도착하다, 3형식)", "reached to the top", "reached at the top", "arrived the top"],
    answer: 0,
    explanation: "reach + 목적어는 3형식으로 전치사 없이 쓴다. arrive는 자동사로 arrive at/in을 쓴다."
  },
  {
    id: 138, set: 5, verb: "resemble",
    sentence: "This photo ___ my grandfather.",
    question: "빈칸에 알맞은 표현과 의미는?",
    choices: ["resembles (O와 닮다, 3형식)", "resembles to my grandfather", "resembles with my grandfather", "is resembled my grandfather"],
    answer: 0,
    explanation: "resemble은 3형식 타동사로 전치사 없이 목적어를 취한다. resemble to (X)"
  },
  {
    id: 139, set: 5, verb: "enter",
    sentence: "She ___ the room quietly.",
    question: "빈칸에 알맞은 표현과 의미는?",
    choices: ["entered (O에 들어가다, 3형식)", "entered into the room", "entered to the room", "was entered the room"],
    answer: 0,
    explanation: "enter는 3형식 타동사로 전치사 없이 목적어를 취한다. enter into (X)"
  },
  {
    id: 140, set: 5, verb: "attend",
    sentence: "He ___ the conference last Monday.",
    question: "빈칸에 알맞은 표현과 의미는?",
    choices: ["attended (O에 참석하다, 3형식)", "attended to the conference", "attended at the conference", "was attended the conference"],
    answer: 0,
    explanation: "attend + 목적어는 3형식으로 '참석하다'의 의미. attend to는 '~를 돌보다'로 의미가 다르다."
  },
  {
    id: 141, set: 5, verb: "approach",
    sentence: "The deadline is ___ fast.",
    question: "빈칸에 알맞은 동사와 의미는? (1형식)",
    choices: ["approaching (때가 다가오다, 1형식)", "approaching the deadline", "approached to us", "is approached"],
    answer: 0,
    explanation: "approach는 1형식으로 '다가오다'의 의미로 쓰이거나, 3형식으로 'O에 접근하다'로도 쓰인다."
  },
  {
    id: 142, set: 5, verb: "marry",
    sentence: "He ___ a wealthy woman.",
    question: "빈칸에 알맞은 표현과 의미는?",
    choices: ["married (O와 결혼하다, 3형식)", "married with a wealthy woman", "married to a wealthy woman", "was married a wealthy woman"],
    answer: 0,
    explanation: "marry는 3형식 타동사로 전치사 없이 목적어를 취한다. marry with (X), marry to (X)"
  },
  {
    id: 143, set: 5, verb: "mention",
    sentence: "She didn't ___ the problem in her speech.",
    question: "빈칸에 알맞은 표현과 의미는?",
    choices: ["mention (O에 대해 언급하다, 3형식)", "mention about the problem", "mention on the problem", "was mentioned the problem"],
    answer: 0,
    explanation: "mention은 3형식 타동사로 전치사 없이 목적어를 취한다. mention about (X)"
  },
  {
    id: 144, set: 5, verb: "run",
    sentence: "She ___ the company for 10 years.",
    question: "빈칸에 알맞은 표현과 의미는? (3형식)",
    choices: ["ran (O를 운영하다, 3형식)", "ran the company (1형식)", "was run the company", "ran for the company"],
    answer: 0,
    explanation: "run + 목적어는 3형식으로 '~을 운영하다, 경영하다'의 의미."
  }
];
