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
  // 1세트: be 동사와 1형식 대표 동사
  {
    id: 1, set: 1, verb: "be",
    sentence: "There ___ several reasons for the results.",
    question: "빈칸에 알맞은 동사와 의미는?",
    choices: ["are (~이 있다, 1형식)", "is being", "are being", "have been"],
    answer: 0,
    explanation: "be 동사는 1형식으로 쓰일 때 '~이 있다'의 의미를 가진다."
  },
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
    id: 104, set: 1, verb: "matter",
    sentence: "Every vote ___.",
    question: "빈칸에 알맞은 동사와 의미는?",
    choices: ["matters (중요하다, 1형식)", "matters something", "is mattered", "matters to us something"],
    answer: 0,
    explanation: "matter는 1형식 자동사로 '중요하다'의 의미. 목적어 없이 단독으로 쓰인다."
  },
  {
    id: 10, set: 1, verb: "count",
    sentence: "In this competition, experience doesn't ___ much.",
    question: "빈칸에 알맞은 동사와 의미는?",
    choices: ["count (중요하다, 1형식)", "count numbers", "is counted", "counting"],
    answer: 0,
    explanation: "count는 1형식으로 '중요하다(matter)'의 의미로 쓰일 수 있다."
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
    id: 108, set: 1, verb: "work",
    sentence: "Does this plan ___?",
    question: "빈칸에 알맞은 동사와 의미는? (1형식)",
    choices: ["work (효과가 있다, 1형식)", "work the plan", "is worked", "work us"],
    answer: 0,
    explanation: "work는 1형식으로 '효과가 있다'의 의미로 쓰인다."
  },
  {
    id: 11, set: 1, verb: "do",
    sentence: "Any dictionary will ___.",
    question: "빈칸에 알맞은 동사와 의미는?",
    choices: ["do (충분하다, 1형식)", "do work", "make", "doing"],
    answer: 0,
    explanation: "do는 1형식으로 '충분하다, 적절하다'의 의미로 쓰인다."
  },
  {
    id: 12, set: 1, verb: "pay",
    sentence: "In the long run, honesty ___.",
    question: "빈칸에 알맞은 동사와 의미는?",
    choices: ["pays (이익이 되다, 1형식)", "pays money", "is paid", "paying"],
    answer: 0,
    explanation: "pay는 1형식으로 '이익이 되다, 수지가 맞다'의 의미로 쓰인다."
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
    id: 103, set: 1, verb: "rise",
    sentence: "Prices ___ sharply last year.",
    question: "빈칸에 알맞은 동사와 의미는?",
    choices: ["rose (오르다, 1형식)", "rose prices (가격을 올리다)", "was risen", "raised (타동사, O 필요)"],
    answer: 0,
    explanation: "rise는 1형식 자동사로 목적어 없이 쓰인다. raise는 타동사로 구별 필요."
  },

  // 2세트: seem류 동사 (인식)
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

  // 3세트: 감각동사
  {
    id: 128, set: 3, verb: "look",
    sentence: "You ___ tired. Are you okay?",
    question: "빈칸에 알맞은 표현과 문장 형식은?",
    choices: ["look (a하게 보이다, 2형식)", "look tiredly", "look you tired", "are looked tired"],
    answer: 0,
    explanation: "look + 형용사(tired)는 2형식 감각동사. '~하게 보이다'의 의미."
  },
  {
    id: 127, set: 3, verb: "sound",
    sentence: "The music ___ strange to me.",
    question: "빈칸에 알맞은 표현과 문장 형식은?",
    choices: ["sounded (a하게 들리다, 2형식)", "sounded strangely", "sounded the music strange", "was sounded strange"],
    answer: 0,
    explanation: "sound + 형용사(strange)는 2형식 감각동사. '~하게 들리다'의 의미."
  },
  {
    id: 123, set: 3, verb: "smell",
    sentence: "The soup ___ delicious.",
    question: "빈칸에 알맞은 표현과 문장 형식은?",
    choices: ["smells (a한 냄새가 나다, 2형식)", "smells deliciously (1형식)", "smells the soup", "is smelled delicious"],
    answer: 0,
    explanation: "smell + 형용사(delicious)는 2형식 감각동사. '~한 냄새가 나다'의 의미."
  },
  {
    id: 125, set: 3, verb: "taste",
    sentence: "This cake ___ sweet.",
    question: "빈칸에 알맞은 표현과 문장 형식은?",
    choices: ["tastes (a한 맛이 나다, 2형식)", "tastes sweetly", "tastes the cake sweet", "is tasted sweet"],
    answer: 0,
    explanation: "taste + 형용사(sweet)는 2형식 감각동사. '~한 맛이 나다'의 의미."
  },
  {
    id: 129, set: 3, verb: "feel",
    sentence: "The blanket ___ soft.",
    question: "빈칸에 알맞은 표현과 문장 형식은?",
    choices: ["feels (a한 느낌이 나다, 2형식)", "feels softly", "feels the blanket soft", "is felt soft"],
    answer: 0,
    explanation: "feel + 형용사(soft)는 2형식 감각동사. '~한 느낌이 나다'의 의미."
  },

  // 4세트: become형 동사 (변화)
  {
    id: 13, set: 4, verb: "get",
    sentence: "It is ___ dark outside.",
    question: "빈칸에 알맞은 표현과 문장 형식은?",
    choices: ["getting (C하게 되다, 2형식)", "getting darkly", "is gotten", "getting it"],
    answer: 0,
    explanation: "get + 형용사는 2형식으로 '~하게 되다'의 의미이다."
  },
  {
    id: 116, set: 4, verb: "grow",
    sentence: "She ___ nervous before the exam.",
    question: "빈칸에 알맞은 표현과 문장 형식은?",
    choices: ["grew (C하게 되다, 2형식)", "grew nervously (1형식)", "was grown nervous", "grew her nervous"],
    answer: 0,
    explanation: "grow + 형용사(nervous)는 2형식. '~하게 되다'의 의미로 보어를 취한다."
  },
  {
    id: 121, set: 4, verb: "go",
    sentence: "Everything ___ wrong yesterday.",
    question: "빈칸에 알맞은 표현과 문장 형식은?",
    choices: ["went (C하게 되다, 2형식)", "went wrongly", "went the plan", "was gone"],
    answer: 0,
    explanation: "go + 형용사는 2형식으로 '~하게 되다'의 의미로 쓰인다."
  },
  {
    id: 118, set: 4, verb: "come",
    sentence: "Her dream ___ true.",
    question: "빈칸에 알맞은 표현과 문장 형식은?",
    choices: ["came (C가 되다, 2형식)", "came truly (1형식)", "came her dream true", "was come true"],
    answer: 0,
    explanation: "come + 형용사(true)는 2형식. come true는 관용 표현으로 '이루어지다'의 의미."
  },
  {
    id: 120, set: 4, verb: "run",
    sentence: "The well has ___ dry.",
    question: "빈칸에 알맞은 표현과 문장 형식은?",
    choices: ["run (C하게 되다, 2형식)", "run dryly", "been run", "run the well"],
    answer: 0,
    explanation: "run + 형용사는 2형식으로 '~하게 되다'의 의미로 쓰인다."
  },
  {
    id: 133, set: 4, verb: "turn",
    sentence: "The leaves ___ red in autumn.",
    question: "빈칸에 알맞은 표현과 문장 형식은? (2형식)",
    choices: ["turn (C가 되다/C 상태로 변하다, 2형식)", "turn redly (1형식)", "turn the leaves red (5형식)", "are turned red"],
    answer: 0,
    explanation: "turn + 형용사(red)는 2형식. '~한 상태로 변하다'의 의미."
  },
  {
    id: 117, set: 4, verb: "fall",
    sentence: "He ___ asleep during the class.",
    question: "빈칸에 알맞은 표현과 문장 형식은?",
    choices: ["fell (C한 상태가 되다, 2형식)", "fell sleepily", "was fallen", "fell him asleep"],
    answer: 0,
    explanation: "fall + 형용사는 2형식으로 '~한 상태가 되다'의 의미이다."
  },

  // 5세트: remain형 동사 (상태)
  {
    id: 113, set: 5, verb: "remain",
    sentence: "The issue ___ unsolved.",
    question: "빈칸에 알맞은 동사와 의미는?",
    choices: ["remained (계속해서 C이다, 2형식)", "remained the problem", "was remained", "remained unsolvedly"],
    answer: 0,
    explanation: "remain은 2형식으로 '(계속해서) C이다'의 의미. unsolved는 형용사 보어."
  },
  {
    id: 14, set: 5, verb: "keep",
    sentence: "Please ___ silent in the library.",
    question: "빈칸에 알맞은 동사와 의미는?",
    choices: ["keep (C한 상태를 유지하다, 2형식)", "keep silently", "is kept silent", "keep you silent"],
    answer: 0,
    explanation: "keep + 형용사는 2형식으로 '~한 상태를 유지하다'의 의미이다."
  },
  {
    id: 122, set: 5, verb: "stay",
    sentence: "Please ___ calm.",
    question: "빈칸에 알맞은 동사와 의미는?",
    choices: ["stay (C한 채로 있다, 2형식)", "stay calmly", "stay you calm", "be stayed calm"],
    answer: 0,
    explanation: "stay는 2형식으로 '(C한) 상태를 유지하다'의 의미. calm은 형용사 보어."
  },
  {
    id: 111, set: 5, verb: "stand",
    sentence: "He ___ still.",
    question: "빈칸에 알맞은 동사와 의미는?",
    choices: ["stood (계속해서 C인 상태에 있다, 2형식)", "stood him still", "was stood still", "stood stilly"],
    answer: 0,
    explanation: "stand는 2형식으로 '(계속해서) C인 상태에 있다'의 의미. still은 형용사 보어."
  },
  {
    id: 112, set: 5, verb: "lie",
    sentence: "The book ___ open on the table.",
    question: "빈칸에 알맞은 동사와 의미는?",
    choices: ["lay (계속해서 C이다, 2형식)", "lay the book", "was lied", "laid openly"],
    answer: 0,
    explanation: "lie는 2형식으로 '(계속해서) C이다'의 의미. open은 형용사 보어."
  },

  // 6세트: dream 동사 (뒤에 전치사 불가)
  {
    id: 135, set: 6, verb: "discuss",
    sentence: "We ___ the plan together.",
    question: "빈칸에 알맞은 표현과 의미는?",
    choices: ["discussed (O에 대해 토론하다, 3형식)", "discussed about the plan", "discussed with the plan", "was discussed the plan"],
    answer: 0,
    explanation: "discuss는 3형식 타동사로 전치사 없이 목적어를 바로 취한다. discuss about (X)"
  },
  {
    id: 138, set: 6, verb: "resemble",
    sentence: "You ___ your mother.",
    question: "빈칸에 알맞은 표현과 의미는?",
    choices: ["resemble (O와 닮다, 3형식)", "resemble to your mother", "resemble with your mother", "is resembled your mother"],
    answer: 0,
    explanation: "resemble은 3형식 타동사로 전치사 없이 목적어를 취한다. resemble to (X)"
  },
  {
    id: 137, set: 6, verb: "reach",
    sentence: "We finally ___ our destination.",
    question: "빈칸에 알맞은 표현과 의미는?",
    choices: ["reached (O에 도착하다, 3형식)", "reached to our destination", "reached at our destination", "arrived our destination"],
    answer: 0,
    explanation: "reach + 목적어는 3형식으로 전치사 없이 쓴다. arrive는 자동사로 arrive at/in을 쓴다."
  },
  {
    id: 139, set: 6, verb: "enter",
    sentence: "She ___ the room.",
    question: "빈칸에 알맞은 표현과 의미는?",
    choices: ["entered (O에 들어가다, 3형식)", "entered into the room", "entered to the room", "was entered the room"],
    answer: 0,
    explanation: "enter는 3형식 타동사로 전치사 없이 목적어를 취한다. enter into (X)"
  },
  {
    id: 140, set: 6, verb: "attend",
    sentence: "Will you ___ the meeting?",
    question: "빈칸에 알맞은 표현과 의미는?",
    choices: ["attend (O에 참석하다, 3형식)", "attend to the meeting", "attend at the meeting", "was attended"],
    answer: 0,
    explanation: "attend + 목적어는 3형식으로 '참석하다'의 의미. attend to는 '~를 돌보다'로 의미가 다르다."
  },
  {
    id: 141, set: 6, verb: "approach",
    sentence: "The cat ___ the mouse slowly.",
    question: "빈칸에 알맞은 동사와 의미는?",
    choices: ["approached (O에 접근하다, 3형식)", "approached to the mouse", "was approached", "approaching to the mouse"],
    answer: 0,
    explanation: "approach는 3형식 타동사로 전치사 없이 목적어를 취한다. approach to (X)"
  },
  {
    id: 15, set: 6, verb: "answer",
    sentence: "Please ___ the question.",
    question: "빈칸에 알맞은 표현과 의미는?",
    choices: ["answer (O에 답하다, 3형식)", "answer to the question", "be answered", "answering to"],
    answer: 0,
    explanation: "answer는 3형식 타동사로 전치사 없이 목적어를 취한다. answer to (X)"
  },
  {
    id: 143, set: 6, verb: "mention",
    sentence: "He didn't ___ the name.",
    question: "빈칸에 알맞은 표현과 의미는?",
    choices: ["mention (O에 대해 언급하다, 3형식)", "mention about the name", "mention on the name", "was mentioned the name"],
    answer: 0,
    explanation: "mention은 3형식 타동사로 전치사 없이 목적어를 취한다. mention about (X)"
  },
  {
    id: 142, set: 6, verb: "marry",
    sentence: "She ___ him last year.",
    question: "빈칸에 알맞은 표현과 의미는?",
    choices: ["married (O와 결혼하다, 3형식)", "married with him", "married to him", "was married him"],
    answer: 0,
    explanation: "marry는 3형식 타동사로 전치사 없이 목적어를 취한다. marry with (X), marry to (X)"
  }
];
