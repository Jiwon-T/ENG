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
    choices: ["are", "is being", "are being", "have been"],
    answer: 0,
    explanation: "be 동사는 1형식으로 쓰일 때 '~이 있다'의 의미를 가진다."
  },
  {
    id: 2, set: 1, verb: "be",
    sentence: "Where ___ you yesterday?",
    question: "빈칸에 알맞은 동사와 의미는?",
    choices: ["were", "did", "was being", "have been"],
    answer: 0,
    explanation: "be 동사는 장소를 나타내는 부사구와 함께 쓰여 '~에 있다'는 의미의 1형식 문장을 만든다."
  },
  {
    id: 3, set: 1, verb: "be",
    sentence: "She ___ at the library until late last night.",
    question: "빈칸에 알맞은 표현은?",
    choices: ["was", "is being", "has been being", "stayed to"],
    answer: 0,
    explanation: "be 동사는 1형식으로 쓰일 때 '~에 있다'는 존재나 위치를 나타낸다."
  },
  {
    id: 4, set: 1, verb: "be",
    sentence: "My grandparents' house ___ in a small village.",
    question: "빈칸에 알맞은 표현은?",
    choices: ["is", "is being", "has stayed", "exists to"],
    answer: 0,
    explanation: "주어 + be동사 + 장소부사구는 1형식으로 '~에 있다'는 의미이다."
  },
  {
    id: 101, set: 1, verb: "happen",
    sentence: "An accident ___ on the highway this morning.",
    question: "빈칸에 알맞은 동사와 의미는?",
    choices: ["happened", "happened me", "was happened", "happened something"],
    answer: 0,
    explanation: "happen은 1형식 자동사로 수동태 불가. 목적어 없이 단독으로 쓰인다."
  },
  {
    id: 1012, set: 1, verb: "happen",
    sentence: "What ___ to your car?",
    question: "빈칸에 알맞은 동사와 의미는?",
    choices: ["happened", "is happened", "was happened", "happened with"],
    answer: 0,
    explanation: "happen은 자동사로 수동태가 불가능하며, '~에게 일어나다'라고 할 때 전치사 to를 사용한다."
  },
  {
    id: 1013, set: 1, verb: "happen",
    sentence: "The incident ___ exactly one week ago.",
    question: "빈칸에 알맞은 표현은?",
    choices: ["happened", "was happened", "is happened", "happened with"],
    answer: 0,
    explanation: "happen은 '일어나다'는 의미의 1형식 자동사로 수동태가 불가능하다."
  },
  {
    id: 1014, set: 1, verb: "happen",
    sentence: "I wonder what will ___ if we fail.",
    question: "빈칸에 알맞은 표현은?",
    choices: ["happen", "be happened", "happen to", "happen about"],
    answer: 0,
    explanation: "happen은 1형식 자동사로 목적어 없이 쓰인다."
  },
  {
    id: 102, set: 1, verb: "occur",
    sentence: "A great idea ___ to me in the shower.",
    question: "빈칸에 알맞은 동사와 의미는?",
    choices: ["occurred", "occurred me", "was occurred", "occurred an idea"],
    answer: 0,
    explanation: "occur는 1형식 자동사로 'occur to + 사람' 형태로 쓰인다. 수동태 불가."
  },
  {
    id: 1022, set: 1, verb: "occur",
    sentence: "Earthquakes ___ frequently in this region.",
    question: "빈칸에 알맞은 동사와 의미는?",
    choices: ["occur", "are occurred", "occurred to", "occurs"],
    answer: 0,
    explanation: "occur는 '일어나다, 발생하다'라는 의미의 1형식 자동사이다."
  },
  {
    id: 1024, set: 1, verb: "occur",
    sentence: "The same error ___ twice yesterday.",
    question: "빈칸에 알맞은 표현은?",
    choices: ["occurred", "was occurred", "is occurred", "occurred to us something"],
    answer: 0,
    explanation: "occur는 자동사이므로 수동태를 쓸 수 없다."
  },
  {
    id: 1025, set: 1, verb: "occur",
    sentence: "A better solution ___ to her this morning.",
    question: "빈칸에 알맞은 표현은?",
    choices: ["occurred", "was occurred", "thought", "happened with"],
    answer: 0,
    explanation: "occur to + 사람 형태는 '생각이 떠오르다'는 의미의 1형식 구문이다."
  },
  {
    id: 104, set: 1, verb: "matter",
    sentence: "Every vote ___.",
    question: "빈칸에 알맞은 동사와 의미는?",
    choices: ["matters", "matters something", "is mattered", "matters to us something"],
    answer: 0,
    explanation: "matter는 1형식 자동사로 '중요하다'의 의미. 목적어 없이 단독으로 쓰인다."
  },
  {
    id: 1042, set: 1, verb: "matter",
    sentence: "It doesn't ___ what you wear.",
    question: "빈칸에 알맞은 동사와 의미는?",
    choices: ["matter", "matter something", "mattered to", "is mattered"],
    answer: 0,
    explanation: "matter는 1형식 자동사로 '중요하다'의 의미이다."
  },
  {
    id: 1043, set: 1, verb: "matter",
    sentence: "Our children's future ___ most to us.",
    question: "빈칸에 알맞은 표현은?",
    choices: ["matters", "matters to", "is mattered", "mattering"],
    answer: 0,
    explanation: "matter는 '중요하다'는 의미의 1형식 자동사이다."
  },
  {
    id: 1044, set: 1, verb: "matter",
    sentence: "Your opinion doesn't ___ in this decision.",
    question: "빈칸에 알맞은 표현은?",
    choices: ["matter", "matters", "is mattered", "matter something"],
    answer: 0,
    explanation: "matter는 1형식 자동사로 목적어가 필요 없다."
  },
  {
    id: 10, set: 1, verb: "count",
    sentence: "In this competition, experience doesn't ___ much.",
    question: "빈칸에 알맞은 동사와 의미는?",
    choices: ["count", "count numbers", "is counted", "counting"],
    answer: 0,
    explanation: "count는 1형식으로 '중요하다(matter)'의 의미로 쓰일 수 있다."
  },
  {
    id: 1023, set: 1, verb: "count",
    sentence: "Every single point ___ in the final score.",
    question: "빈칸에 알맞은 동사와 의미는?",
    choices: ["counts", "counts numbers", "is counted", "count to"],
    answer: 0,
    explanation: "count가 1형식으로 쓰일 때는 '중요하다'라는 의미를 가진다."
  },
  {
    id: 1025, set: 1, verb: "count",
    sentence: "In the end, it is character that ___.",
    question: "빈칸에 알맞은 표현은?",
    choices: ["counts", "counts numbers", "is counted", "counting"],
    answer: 0,
    explanation: "count는 1형식 자동사로 '중요하다(matter)'의 의미로 쓰인다."
  },
  {
    id: 1026, set: 1, verb: "count",
    sentence: "Does my previous experience ___ for this job?",
    question: "빈칸에 알맞은 표현은?",
    choices: ["count", "count as", "be counted", "counting"],
    answer: 0,
    explanation: "count가 1형식으로 쓰여 '가치가 있다, 중요하다'는 뜻을 나타낸다."
  },
  {
    id: 106, set: 1, verb: "work",
    sentence: "The machine ___ perfectly.",
    question: "빈칸에 알맞은 동사와 의미는?",
    choices: ["works", "works the machine", "is worked", "works something"],
    answer: 0,
    explanation: "work는 1형식으로 '작동되다, 효과가 있다'의 의미. 목적어 없이 쓰인다."
  },
  {
    id: 108, set: 1, verb: "work",
    sentence: "Does this plan ___?",
    question: "빈칸에 알맞은 동사와 의미는? (1형식)",
    choices: ["work", "work the plan", "is worked", "work us"],
    answer: 0,
    explanation: "work는 1형식으로 '효과가 있다'의 의미로 쓰인다."
  },
  {
    id: 1083, set: 1, verb: "work",
    sentence: "I hope the medicine ___ quickly.",
    question: "빈칸에 알맞은 표현은?",
    choices: ["works", "works the medicine", "is worked", "working"],
    answer: 0,
    explanation: "work는 '(약 등이) 효과가 있다'는 뜻의 1형식 자동사이다."
  },
  {
    id: 1084, set: 1, verb: "work",
    sentence: "That excuse won't ___ with me.",
    question: "빈칸에 알맞은 표현은?",
    choices: ["work", "works", "be worked", "work something"],
    answer: 0,
    explanation: "work는 '효과가 있다, 통하다'는 의미의 1형식 자동사이다."
  },
  {
    id: 11, set: 1, verb: "do",
    sentence: "Any dictionary will ___.",
    question: "빈칸에 알맞은 동사와 의미는?",
    choices: ["do", "do work", "make", "doing"],
    answer: 0,
    explanation: "do는 1형식으로 '충분하다, 적절하다'의 의미로 쓰인다."
  },
  {
    id: 1122, set: 1, verb: "do",
    sentence: "Will this small gift ___ for the children?",
    question: "빈칸에 알맞은 표현은?",
    choices: ["do", "make", "be doing", "done"],
    answer: 0,
    explanation: "do는 1형식으로 '충분하다'는 의미를 가진다."
  },
  {
    id: 1123, set: 1, verb: "do",
    sentence: "Two hundred dollars will ___ for now.",
    question: "빈칸에 알맞은 표현은?",
    choices: ["do", "be doing", "make", "be enough to"],
    answer: 0,
    explanation: "do는 1형식 자동사로 '충분하다'는 뜻이 있다."
  },
  {
    id: 1124, set: 1, verb: "do",
    sentence: "Will this chair ___ for the guest?",
    question: "빈칸에 알맞은 표현은?",
    choices: ["do", "doing", "make", "be done"],
    answer: 0,
    explanation: "do는 '알맞다, 충분하다'는 뜻의 1형식 자동사이다."
  },
  {
    id: 12, set: 1, verb: "pay",
    sentence: "In the long run, honesty ___.",
    question: "빈칸에 알맞은 동사와 의미는?",
    choices: ["pays", "pays money", "is paid", "paying"],
    answer: 0,
    explanation: "pay는 1형식으로 '이익이 되다, 수지가 맞다'의 의미로 쓰인다."
  },
  {
    id: 1222, set: 1, verb: "pay",
    sentence: "Hard work will ___ off eventually.",
    question: "빈칸에 알맞은 표현은?",
    choices: ["pay", "pay money", "be paid", "paying"],
    answer: 0,
    explanation: "pay off는 '결실을 맺다, 이득이 되다'라는 의미로 pay가 1형식으로 수지가 맞는다는 의미로 쓰였다."
  },
  {
    id: 1224, set: 1, verb: "pay",
    sentence: "Crime never ___.",
    question: "빈칸에 알맞은 표현은?",
    choices: ["pays", "paying", "is paid", "pays money"],
    answer: 0,
    explanation: "pay는 1형식 자동사로 '이득이 되다, 보람이 있다'는 뜻이다."
  },
  {
    id: 1225, set: 1, verb: "pay",
    sentence: "It ___ to be careful when crossing the street.",
    question: "빈칸에 알맞은 표현은?",
    choices: ["pays", "is paid", "pays for", "paying"],
    answer: 0,
    explanation: "It pays to V 구문은 '~하는 것이 이득이다/가치가 있다'는 의미의 1형식 표현이다."
  },
  {
    id: 107, set: 1, verb: "last",
    sentence: "The concert ___ for three hours.",
    question: "빈칸에 알맞은 동사와 의미는?",
    choices: ["lasted", "lasted the audience", "was lasted", "lasted long time"],
    answer: 0,
    explanation: "last는 1형식으로 '계속되다, 지속되다'의 의미. 수동태 불가."
  },
  {
    id: 1072, set: 1, verb: "last",
    sentence: "The battery ___ for two days.",
    question: "빈칸에 알맞은 동사와 의미는?",
    choices: ["lasts", "lasts long time", "is lasted", "lasted to"],
    answer: 0,
    explanation: "last는 '지속되다'라는 의미의 1형식 자동사이다."
  },
  {
    id: 1073, set: 1, verb: "last",
    sentence: "The rain ___ all night.",
    question: "빈칸에 알맞은 표현은?",
    choices: ["lasted", "was lasted", "is lasted", "continued to"],
    answer: 0,
    explanation: "last는 '지속되다'는 의미의 1형식 자동사로 수동태 불가."
  },
  {
    id: 1074, set: 1, verb: "last",
    sentence: "Good memories ___ forever.",
    question: "빈칸에 알맞은 표현은?",
    choices: ["last", "lasts", "are lasted", "last for something"],
    answer: 0,
    explanation: "last는 '오래가다, 지속되다'는 의미의 1형식 자동사이다."
  },
  {
    id: 103, set: 1, verb: "rise",
    sentence: "Prices ___ sharply last year.",
    question: "빈칸에 알맞은 동사와 의미는?",
    choices: ["rose", "rose prices", "was risen", "raised"],
    answer: 0,
    explanation: "rise는 1형식 자동사로 목적어 없이 쓰인다. raise는 타동사로 구별 필요."
  },
  {
    id: 1032, set: 1, verb: "rise",
    sentence: "The sun ___ in the east.",
    question: "빈칸에 알맞은 동사와 의미는?",
    choices: ["rises", "raises", "is risen", "rose up to"],
    answer: 0,
    explanation: "rise는 '오르다, 뜨다'라는 의미의 1형식 자동사이다."
  },

  // 2세트: seem류 동사 (인식)
  {
    id: 109, set: 2, verb: "seem",
    sentence: "She ___ happy about the news.",
    question: "빈칸에 알맞은 동사와 의미는? (2형식)",
    choices: ["seemed", "seemed her happy", "was seemed", "seemed happily"],
    answer: 0,
    explanation: "seem은 2형식 동사로 보어(C)를 취한다. 부사(happily)가 아닌 형용사(happy)가 온다."
  },
  {
    id: 1092, set: 2, verb: "seem",
    sentence: "It ___ that they are already finished.",
    question: "빈칸에 알맞은 표현은?",
    choices: ["seems", "looks like", "appears to", "seems clearly"],
    answer: 0,
    explanation: "It seems that... 구문은 '~인 것 같다'는 의미로 seem이 2형식으로 쓰인 대표적인 형태이다."
  },
  {
    id: 1093, set: 2, verb: "seem",
    sentence: "The task ___ quite difficult at first glance.",
    question: "빈칸에 알맞은 표현은?",
    choices: ["seemed", "seemed happily", "was seemed", "seemed it"],
    answer: 0,
    explanation: "seem은 2형식 동사로 형용사 보어(difficult)를 취한다."
  },
  {
    id: 1094, set: 2, verb: "seem",
    sentence: "They ___ to be in a great hurry to leave.",
    question: "빈칸에 알맞은 표현은?",
    choices: ["seem", "seems", "looks", "appear it"],
    answer: 0,
    explanation: "seem + to V 구문은 '~하는 것처럼 보이다'는 의미의 2형식 표현이다."
  },
  {
    id: 110, set: 2, verb: "appear",
    sentence: "The situation ___ to be getting worse.",
    question: "빈칸에 알맞은 동사와 의미는?",
    choices: ["appears", "appears the situation", "is appeared", "appears badly"],
    answer: 0,
    explanation: "appear는 2형식 동사로 'appear + to부정사' 형태로도 쓰인다."
  },
  {
    id: 1102, set: 2, verb: "appear",
    sentence: "New stars ___ in the sky every night.",
    question: "빈칸에 알맞은 표현은?",
    choices: ["appear", "are appeared", "appears", "show"],
    answer: 0,
    explanation: "appear가 '나타나다'라는 의미일 때는 1형식 자동사로 쓰인다."
  },

  // 3세트: 감각동사
  {
    id: 128, set: 3, verb: "look",
    sentence: "You ___ tired. Are you okay?",
    question: "빈칸에 알맞은 표현과 문장 형식은?",
    choices: ["look", "look tiredly", "look you tired", "are looked tired"],
    answer: 0,
    explanation: "look + 형용사(tired)는 2형식 감각동사. '~하게 보이다'의 의미."
  },
  {
    id: 1282, set: 3, verb: "look",
    sentence: "The plan ___ good on paper.",
    question: "빈칸에 알맞은 표현은?",
    choices: ["looks", "looks like", "is looked", "looks well"],
    answer: 0,
    explanation: "look은 감각동사로 보어로 형용사를 취한다. well은 부사로 쓰일 때가 많아 형용사 good이 더 적절하나 look good이 관용적이다."
  },
  {
    id: 1283, set: 3, verb: "look",
    sentence: "That dress ___ really beautiful on you.",
    question: "빈칸에 알맞은 표현은?",
    choices: ["looks", "looks beautifully", "is looked", "looks clearly"],
    answer: 0,
    explanation: "look은 2형식 감각동사로 보어 자리에 부사가 아닌 형용사가 와야 한다."
  },
  {
    id: 1284, set: 3, verb: "look",
    sentence: "He ___ very disappointed with the test results.",
    question: "빈칸에 알맞은 표현은?",
    choices: ["looked", "looked it", "was looked", "looked disappointedly"],
    answer: 0,
    explanation: "감각동사 look 뒤에는 형용사가 보어로 온다."
  },
  {
    id: 127, set: 3, verb: "sound",
    sentence: "The music ___ strange to me.",
    question: "빈칸에 알맞은 표현과 문장 형식은?",
    choices: ["sounded", "sounded strangely", "sounded the music strange", "was sounded strange"],
    answer: 0,
    explanation: "sound + 형용사(strange)는 2형식 감각동사. '~하게 들리다'의 의미."
  },
  {
    id: 1272, set: 3, verb: "sound",
    sentence: "That ___ like a great idea!",
    question: "빈칸에 알맞은 표현은?",
    choices: ["sounds", "sounds strangely", "is sounded", "hears"],
    answer: 0,
    explanation: "sound는 감각동사로 뒤에 전치사 like + 명사가 오거나 형용사 보어가 온다."
  },
  {
    id: 1273, set: 3, verb: "sound",
    sentence: "The voice ___ very familiar to her.",
    question: "빈칸에 알맞은 표현은?",
    choices: ["sounded", "sounded familiarly", "was sounded", "heard"],
    answer: 0,
    explanation: "sound는 2형식 감각동사로 형용사 보어(familiar)를 취한다."
  },
  {
    id: 1274, set: 3, verb: "sound",
    sentence: "The alarm ___ at exactly 6 AM.",
    question: "빈칸에 알맞은 표현은?",
    choices: ["sounded", "was sounded", "is sounded", "rang it"],
    answer: 0,
    explanation: "sound가 '소리가 나다, 울리다'는 의미로 단독으로 쓰일 때는 1형식이다."
  },
  {
    id: 123, set: 3, verb: "smell",
    sentence: "The soup ___ delicious.",
    question: "빈칸에 알맞은 표현과 문장 형식은?",
    choices: ["smells", "smells deliciously", "smells the soup", "is smelled delicious"],
    answer: 0,
    explanation: "smell + 형용사(delicious)는 2형식 감각동사. '~한 냄새가 나다'의 의미."
  },
  {
    id: 1232, set: 3, verb: "smell",
    sentence: "Freshly baked bread ___ wonderful.",
    question: "빈칸에 알맞은 표현은?",
    choices: ["smells", "smells wonderfully", "is smelled", "scents"],
    answer: 0,
    explanation: "smell은 2형식 감각동사로 보어로 형용사를 가진다."
  },
  {
    id: 1233, set: 3, verb: "smell",
    sentence: "The kitchen ___ of freshly baked bread.",
    question: "빈칸에 알맞은 표현은?",
    choices: ["smells", "is smelled", "has smell", "smelling"],
    answer: 0,
    explanation: "smell (of) 구문에서 smell은 '~한 냄새가 나다'는 뜻의 1형식 또는 2형식 자동사로 쓰인다."
  },
  {
    id: 1234, set: 3, verb: "smell",
    sentence: "The flowers in the garden ___ so sweet.",
    question: "빈칸에 알맞은 표현은?",
    choices: ["smell", "smells", "smell sweetly", "are smelled"],
    answer: 0,
    explanation: "smell은 감각동사로 보어 자리에 형용사(sweet)를 취한다."
  },
  {
    id: 125, set: 3, verb: "taste",
    sentence: "This cake ___ sweet.",
    question: "빈칸에 알맞은 표현과 문장 형식은?",
    choices: ["tastes", "tastes sweetly", "tastes the cake sweet", "is tasted sweet"],
    answer: 0,
    explanation: "taste + 형용사(sweet)는 2형식 감각동사. '~한 맛이 나다'의 의미."
  },
  {
    id: 1252, set: 3, verb: "taste",
    sentence: "The medicine ___ bitter.",
    question: "빈칸에 알맞은 표현은?",
    choices: ["tastes", "tastes bitterly", "is tasted", "feels"],
    answer: 0,
    explanation: "taste는 감각동사로 뒤에 형용사 보어(bitter)를 취한다."
  },
  {
    id: 1253, set: 3, verb: "taste",
    sentence: "The milk ___ a bit strange, so don't drink it.",
    question: "빈칸에 알맞은 표현은?",
    choices: ["tastes", "tastes strangely", "is tasted", "smells it"],
    answer: 0,
    explanation: "taste는 2형식 감각동사로 형용사 보어를 취한다."
  },
  {
    id: 1254, set: 3, verb: "taste",
    sentence: "This soup ___ much better now.",
    question: "빈칸에 알맞은 표현은?",
    choices: ["tastes", "is tasted", "tastes well", "feels"],
    answer: 0,
    explanation: "taste 뒤에는 보어로 형용사가 오며, better는 good의 비교급(형용사)으로 쓰였다."
  },
  {
    id: 129, set: 3, verb: "feel",
    sentence: "The blanket ___ soft.",
    question: "빈칸에 알맞은 표현과 문장 형식은?",
    choices: ["feels", "feels softly", "feels the blanket soft", "is felt soft"],
    answer: 0,
    explanation: "feel + 형용사(soft)는 2형식 감각동사. '~한 느낌이 나다'의 의미."
  },
  {
    id: 1292, set: 3, verb: "feel",
    sentence: "I ___ really good about the choice.",
    question: "빈칸에 알맞은 표현은?",
    choices: ["feel", "feel well", "am felt", "feels me"],
    answer: 0,
    explanation: "feel은 2형식 동사로 뒤에 형용사 보어(good)를 취한다."
  },

  // 4세트: become형 동사 (변화)
  {
    id: 13, set: 4, verb: "get",
    sentence: "It is ___ dark outside.",
    question: "빈칸에 알맞은 표현과 문장 형식은?",
    choices: ["getting", "getting darkly", "is gotten", "getting it"],
    answer: 0,
    explanation: "get + 형용사는 2형식으로 '~하게 되다'의 의미이다."
  },
  {
    id: 132, set: 4, verb: "get",
    sentence: "The weather is ___ colder.",
    question: "빈칸에 알맞은 표현은?",
    choices: ["getting", "getting coldly", "is gotten", "becoming cold"],
    answer: 0,
    explanation: "get + 비교급(형용사)은 '~해지다'라는 의미의 2형식 문장이다."
  },
  {
    id: 1323, set: 4, verb: "get",
    sentence: "The situation is ___ worse by the day.",
    question: "빈칸에 알맞은 표현은?",
    choices: ["getting", "getting badly", "is gotten", "becoming badly"],
    answer: 0,
    explanation: "get + 형용사(worse)는 '~하게 되다'는 의미의 2형식 변화 동사이다."
  },
  {
    id: 1324, set: 4, verb: "get",
    sentence: "He ___ angry when he heard the rumors.",
    question: "빈칸에 알맞은 표현은?",
    choices: ["got", "is gotten", "got angrily", "made"],
    answer: 0,
    explanation: "get 뒤에 형용사 보어(angry)가 와서 상태의 변화를 나타낸다."
  },
  {
    id: 116, set: 4, verb: "grow",
    sentence: "She ___ nervous before the exam.",
    question: "빈칸에 알맞은 표현과 문장 형식은?",
    choices: ["grew", "grew nervously", "was grown nervous", "grew her nervous"],
    answer: 0,
    explanation: "grow + 형용사(nervous)는 2형식. '~하게 되다'의 의미로 보어를 취한다."
  },
  {
    id: 1162, set: 4, verb: "grow",
    sentence: "The noise ___ louder as we approached.",
    question: "빈칸에 알맞은 표현은?",
    choices: ["grew", "grew loudly", "was grown", "became loud"],
    answer: 0,
    explanation: "grow + 형용사는 2형식으로 '~하게 되다, ~해지다'라는 변화의 의미를 갖는다."
  },
  {
    id: 1163, set: 4, verb: "grow",
    sentence: "Her interest in music ___ stronger over time.",
    question: "빈칸에 알맞은 표현은?",
    choices: ["grew", "grew strongly", "was grown", "became strongly"],
    answer: 0,
    explanation: "grow는 2형식 변화 동사로 형용사 보어를 취한다."
  },
  {
    id: 1164, set: 4, verb: "grow",
    sentence: "The old man has ___ wise with age.",
    question: "빈칸에 알맞은 표현은?",
    choices: ["grown", "grown wisely", "been grown", "reached"],
    answer: 0,
    explanation: "grow + 형용사는 주어의 상태가 변화했음을 나타내는 2형식 구문이다."
  },
  {
    id: 133, set: 4, verb: "turn",
    sentence: "The leaves ___ red in autumn.",
    question: "빈칸에 알맞은 표현과 문장 형식은? (2형식)",
    choices: ["turn", "turn redly", "turn the leaves red", "are turned red"],
    answer: 0,
    explanation: "turn + 형용사(red)는 2형식. '~한 상태로 변하다'의 의미."
  },
  {
    id: 1332, set: 4, verb: "turn",
    sentence: "She ___ forty last week.",
    question: "빈칸에 알맞은 표현은?",
    choices: ["turned", "turned sixty years", "was turned", "reached"],
    answer: 0,
    explanation: "turn + 나이는 '~세가 되다'라는 의미의 2형식 활용이다."
  },
  {
    id: 1333, set: 4, verb: "turn",
    sentence: "The weather has ___ cold suddenly.",
    question: "빈칸에 알맞은 표현은?",
    choices: ["turned", "turned coldly", "is turned", "become coldly"],
    answer: 0,
    explanation: "turn + 형용사는 색상이나 날씨 등 갑작스러운 상태 변화를 나타내는 2형식이다."
  },
  {
    id: 1334, set: 4, verb: "turn",
    sentence: "His face ___ pale with fear.",
    question: "빈칸에 알맞은 표현은?",
    choices: ["turned", "was turned", "turned palely", "changed"],
    answer: 0,
    explanation: "얼굴색이 변하는 것은 2형식 turn + 형용사 보어 형태로 표현한다."
  },
  {
    id: 120, set: 4, verb: "run",
    sentence: "The well has ___ dry.",
    question: "빈칸에 알맞은 표현과 문장 형식은?",
    choices: ["run", "run dryly", "been run", "run the well"],
    answer: 0,
    explanation: "run + 형용사는 2형식으로 '~하게 되다'의 의미로 쓰인다."
  },
  {
    id: 1202, set: 4, verb: "run",
    sentence: "The river has ___ shallow during the summer.",
    question: "빈칸에 알맞은 표현은?",
    choices: ["run", "run shallowly", "been run", "becoming shallow"],
    answer: 0,
    explanation: "run + 형용사는 2형식 상태 변화 동사로 쓰일 수 있다."
  },
  {
    id: 1203, set: 4, verb: "run",
    sentence: "Supplies are ___ low in the camp.",
    question: "빈칸에 알맞은 표현은?",
    choices: ["running", "running lowly", "being run", "getting lowly"],
    answer: 0,
    explanation: "run low는 '부족해지다'는 의미의 2형식 변화 표현이다."
  },
  {
    id: 1204, set: 4, verb: "run",
    sentence: "Our oxygen is ___ thin.",
    question: "빈칸에 알맞은 표현은?",
    choices: ["running", "running thinly", "is run", "becoming thinly"],
    answer: 0,
    explanation: "run thin은 '희박해지다, 부족해지다'는 뜻의 2형식 문장이다."
  },
  {
    id: 121, set: 4, verb: "go",
    sentence: "Everything ___ wrong yesterday.",
    question: "빈칸에 알맞은 표현과 문장 형식은?",
    choices: ["went", "went wrongly", "went the plan", "was gone"],
    answer: 0,
    explanation: "go + 형용사는 2형식으로 '~하게 되다'의 의미로 쓰인다."
  },
  {
    id: 1212, set: 4, verb: "go",
    sentence: "The milk has ___ sour.",
    question: "빈칸에 알맞은 표현은?",
    choices: ["gone", "gone sourly", "been gone", "went"],
    answer: 0,
    explanation: "go + 형용사(sour)는 '상하다' 등의 좋지 않은 상태로의 변화를 나타내는 2형식이다."
  },
  {
    id: 1213, set: 4, verb: "go",
    sentence: "The milk will ___ bad if left outside.",
    question: "빈칸에 알맞은 표현은?",
    choices: ["go", "be gone", "goes badly", "went badly"],
    answer: 0,
    explanation: "go bad는 '상하다'는 뜻으로 go가 2형식 변화 동사로 쓰인 예이다."
  },
  {
    id: 1214, set: 4, verb: "go",
    sentence: "The company ___ bankrupt last year.",
    question: "빈칸에 알맞은 표현은?",
    choices: ["went", "is gone", "went with", "became with bankrupt"],
    answer: 0,
    explanation: "go bankrupt는 '파산하다'는 뜻의 2형식 변화 구문이다."
  },
  {
    id: 118, set: 4, verb: "come",
    sentence: "Her dream ___ true.",
    question: "빈칸에 알맞은 표현과 문장 형식은?",
    choices: ["came", "came truly", "came her dream true", "was come true"],
    answer: 0,
    explanation: "come + 형용사(true)는 2형식. come true는 관용 표현으로 '이루어지다'의 의미."
  },
  {
    id: 1182, set: 4, verb: "come",
    sentence: "The knots ___ loose.",
    question: "빈칸에 알맞은 표현은?",
    choices: ["came", "became loose", "came loosely", "showed"],
    answer: 0,
    explanation: "come loose는 '풀리다'라는 의미로 come이 2형식 변화 동사로 쓰인 예이다."
  },
  {
    id: 1183, set: 4, verb: "come",
    sentence: "Your shoelaces have ___ undone.",
    question: "빈칸에 알맞은 표현은?",
    choices: ["come", "became", "showed", "been done"],
    answer: 0,
    explanation: "come undone은 '풀리다'는 뜻으로 come이 2형식 변화 동사로 쓰인 형태이다."
  },
  {
    id: 1184, set: 4, verb: "come",
    sentence: "The truth will ___ out eventually.",
    question: "빈칸에 알맞은 표현은?",
    choices: ["come", "be come", "came out to", "shows up"],
    answer: 0,
    explanation: "come out은 '드러나다, 나타나다'는 의미의 1형식 자동사 구문이다."
  },
  {
    id: 117, set: 4, verb: "fall",
    sentence: "He ___ asleep during the class.",
    question: "빈칸에 알맞은 표현과 문장 형식은?",
    choices: ["fell", "fell sleepily", "was fallen", "fell him asleep"],
    answer: 0,
    explanation: "fall + 형용사는 2형식으로 '~한 상태가 되다'의 의미이다."
  },
  {
    id: 1172, set: 4, verb: "fall",
    sentence: "He ___ silent at the news.",
    question: "빈칸에 알맞은 표현은?",
    choices: ["fell", "fell silently", "was fallen", "kept silently"],
    answer: 0,
    explanation: "fall silent는 '조용해지다'라는 의미의 2형식 상태 변화 표현이다."
  },
  {
    id: 1173, set: 4, verb: "fall",
    sentence: "She ___ ill just before the important exam.",
    question: "빈칸에 알맞은 표현은?",
    choices: ["fell", "fell badly", "is fallen", "became illy"],
    answer: 0,
    explanation: "fall ill은 '병들다'는 뜻으로 fall이 2형식 상태 변화를 나타낸다."
  },
  {
    id: 1174, set: 4, verb: "fall",
    sentence: "The whole city ___ into a deep silence.",
    question: "빈칸에 알맞은 표현은?",
    choices: ["fell", "is fallen", "was fallen to", "fell silently"],
    answer: 0,
    explanation: "어떤 상태로 변화하는 것을 나타낼 때 fall을 2형식으로 사용한다."
  },

  // 5세트: remain형 동사 (상태)
  {
    id: 122, set: 5, verb: "stay",
    sentence: "Please ___ calm.",
    question: "빈칸에 알맞은 동사와 의미는?",
    choices: ["stay", "stay calmly", "stay you calm", "be stayed calm"],
    answer: 0,
    explanation: "stay는 2형식으로 '(C한) 상태를 유지하다'의 의미. calm은 형용사 보어."
  },
  {
    id: 1222, set: 5, verb: "stay",
    sentence: "Prices are expected to ___ high.",
    question: "빈칸에 알맞은 표현은?",
    choices: ["stay", "stay highly", "are stayed", "remain high"],
    answer: 0,
    explanation: "stay is a 2nd-form state maintenance verb that takes an adjective complement."
  },
  {
    id: 1223, set: 5, verb: "stay",
    sentence: "You should ___ healthy by exercising regularly.",
    question: "빈칸에 알맞은 표현은?",
    choices: ["stay", "stay healthily", "be stayed", "keep healthily"],
    answer: 0,
    explanation: "stay는 2형식 상태 유지 동사로 보어로 형용사(healthy)를 취한다."
  },
  {
    id: 1224, set: 5, verb: "stay",
    sentence: "He ___ awake all night to finish the report.",
    question: "빈칸에 알맞은 표현은?",
    choices: ["stayed", "stayed awaking", "was stayed", "kept to awake"],
    answer: 0,
    explanation: "stay awake는 '깨어있는 상태를 유지하다'는 뜻의 2형식 문장이다."
  },
  {
    id: 113, set: 5, verb: "remain",
    sentence: "The issue ___ unsolved.",
    question: "빈칸에 알맞은 동사와 의미는?",
    choices: ["remained", "remained the problem", "was remained", "remained unsolvedly"],
    answer: 0,
    explanation: "remain은 2형식으로 '(계속해서) C이다'의 의미. unsolved는 형용사 보어."
  },
  {
    id: 1132, set: 5, verb: "remain",
    sentence: "Everyone ___ silent during the announcement.",
    question: "빈칸에 알맞은 표현은?",
    choices: ["remained", "remained silently", "is remained", "stayed silent"],
    answer: 0,
    explanation: "remain은 상태 유지 동사로 뒤에 형용사 보어(silent)가 온다."
  },
  {
    id: 1133, set: 5, verb: "remain",
    sentence: "The mystery ___ unsolved for over a decade.",
    question: "빈칸에 알맞은 표현은?",
    choices: ["remains", "remains unsolvedly", "is remained", "stayed to be unsolved"],
    answer: 0,
    explanation: "remain은 2형식 상태 유지 동사로 보어로 형용사(unsolved)가 온다."
  },
  {
    id: 1134, set: 5, verb: "remain",
    sentence: "Please ___ seated until the bus stops.",
    question: "빈칸에 알맞은 표현은?",
    choices: ["remain", "remain to sit", "are remained", "keep sitting"],
    answer: 0,
    explanation: "remain seated는 '앉아있는 상태를 유지하다'는 의미의 2형식 표현이다."
  },
  {
    id: 14, set: 5, verb: "keep",
    sentence: "Please ___ silent in the library.",
    question: "빈칸에 알맞은 동사와 의미는?",
    choices: ["keep", "keep silently", "is kept silent", "keep you silent"],
    answer: 0,
    explanation: "keep + 형용사는 2형식으로 '~한 상태를 유지하다'의 의미이다."
  },
  {
    id: 142, set: 5, verb: "keep",
    sentence: "Try to ___ cool in this heat.",
    question: "빈칸에 알맞은 표현은?",
    choices: ["keep", "keep coolly", "stay coolly", "make cool"],
    answer: 0,
    explanation: "keep은 2형식 동사로 뒤에 형용사 보어를 취해 상태 유지를 나타낸다."
  },
  {
    id: 144, set: 5, verb: "keep",
    sentence: "I'll try to ___ quiet during the performance.",
    question: "빈칸에 알맞은 표현은?",
    choices: ["keep", "keep quietly", "stay quietly", "be kept quietly"],
    answer: 0,
    explanation: "keep은 2형식 동사로 보어 자리에 형용사(quiet)가 와야 한다."
  },
  {
    id: 145, set: 5, verb: "keep",
    sentence: "You must ___ moving to reach the summit.",
    question: "빈칸에 알맞은 표현은?",
    choices: ["keep", "keep to move", "kept it moving", "remain to move"],
    answer: 0,
    explanation: "keep + -ing(현재분사) 형태는 '~하는 상태를 계속하다'는 의미의 2형식 구문이다."
  },
  {
    id: 111, set: 5, verb: "stand",
    sentence: "He ___ still.",
    question: "빈칸에 알맞은 동사와 의미는?",
    choices: ["stood", "stood him still", "was stood still", "stood stilly"],
    answer: 0,
    explanation: "stand는 2형식으로 '(계속해서) C인 상태에 있다'의 의미. still은 형용사 보어."
  },
  {
    id: 1112, set: 5, verb: "stand",
    sentence: "Truth will ___ forever.",
    question: "빈칸에 알맞은 표현은?",
    choices: ["stand", "be stood", "stands", "stand to"],
    answer: 0,
    explanation: "stand가 1형식으로 쓰여 '유효하다, 유지되다'라는 의미를 가질 수 있다."
  },
  {
    id: 1113, set: 5, verb: "stand",
    sentence: "The offer still ___ if you are interested.",
    question: "빈칸에 알맞은 표현은?",
    choices: ["stands", "was stood", "stays it", "stands it"],
    answer: 0,
    explanation: "stand가 1형식으로 쓰일 때 '유효하다, 변함없다'는 의미를 나타낸다."
  },
  {
    id: 1114, set: 5, verb: "stand",
    sentence: "He ___ tall among his peers.",
    question: "빈칸에 알맞은 표현은?",
    choices: ["stands", "stands it", "is stood", "standing"],
    answer: 0,
    explanation: "stand tall은 '당당한 상태를 유지하다'는 의미의 2형식 구문으로 볼 수 있다."
  },
  {
    id: 112, set: 5, verb: "lie",
    sentence: "The book ___ open on the table.",
    question: "빈칸에 알맞은 동사와 의미는?",
    choices: ["lay", "lay the book", "was lied", "laid openly"],
    answer: 0,
    explanation: "lie는 2형식으로 '(계속해서) C이다'의 의미. open은 형용사 보어."
  },
  {
    id: 1122, set: 5, verb: "lie",
    sentence: "Snow ___ thick on the ground.",
    question: "빈칸에 알맞은 표현은?",
    choices: ["lay", "lied", "was lain", "laid"],
    answer: 0,
    explanation: "lie(눕다/놓여있다)의 과거형 lay가 2형식으로 쓰여 상태를 나타낸다."
  },
  {
    id: 1123, set: 5, verb: "lie",
    sentence: "The spare keys ___ hidden under the mat.",
    question: "빈칸에 알맞은 표현은?",
    choices: ["lay", "laid", "lied", "lain"],
    answer: 0,
    explanation: "lie + 형용사는 2형식으로 '~한 상태로 놓여있다'는 뜻이다. (과거형 lay)"
  },
  {
    id: 1124, set: 5, verb: "lie",
    sentence: "Don't let your artistic talents ___ idle.",
    question: "빈칸에 알맞은 표현은?",
    choices: ["lie", "lay", "lied", "lying"],
    answer: 0,
    explanation: "lie idle은 '사용되지 않고 방치되다'는 뜻의 2형식 상태 표현이다."
  },

  // 6세트: dream 동사 (뒤에 전치사 불가)
  {
    id: 135, set: 6, verb: "discuss",
    sentence: "We ___ the plan together.",
    question: "빈칸에 알맞은 표현과 의미는?",
    choices: ["discussed", "discussed about the plan", "discussed with the plan", "was discussed the plan"],
    answer: 0,
    explanation: "discuss는 3형식 타동사로 전치사 없이 목적어를 바로 취한다. discuss about (X)"
  },
  {
    id: 1352, set: 6, verb: "discuss",
    sentence: "They met to ___ their future.",
    question: "빈칸에 알맞은 표현은?",
    choices: ["discuss", "discuss about", "argue about", "talk about"],
    answer: 0,
    explanation: "discuss는 대표적인 3형식 타동사로 전치사를 쓰지 않는다."
  },
  {
    id: 1353, set: 6, verb: "discuss",
    sentence: "We should ___ how to improve our service.",
    question: "빈칸에 알맞은 표현은?",
    choices: ["discuss", "discuss about", "talk about", "argue it"],
    answer: 0,
    explanation: "discuss는 타동사로 전치사 없이 목적어(명사절 등)를 바로 취한다."
  },
  {
    id: 1354, set: 6, verb: "discuss",
    sentence: "They'll ___ the new policy next week.",
    question: "빈칸에 알맞은 표현은?",
    choices: ["discuss", "discuss about", "argue with", "be discussed"],
    answer: 0,
    explanation: "discuss는 3형식 타동사로 전치사 없이 목적어를 취한다."
  },
  {
    id: 138, set: 6, verb: "resemble",
    sentence: "You ___ your mother.",
    question: "빈칸에 알맞은 표현과 의미는?",
    choices: ["resemble", "resemble to your mother", "resemble with your mother", "is resembled your mother"],
    answer: 0,
    explanation: "resemble은 3형식 타동사로 전치사 없이 목적어를 취한다. resemble to (X)"
  },
  {
    id: 1382, set: 6, verb: "resemble",
    sentence: "She ___ a movie star.",
    question: "빈칸에 알맞은 표현은?",
    choices: ["resembles", "resembles to", "looks like", "resembles with"],
    answer: 0,
    explanation: "resemble은 타동사이므로 전치사 without 또는 with을 사용하지 않는다."
  },
  {
    id: 1383, set: 6, verb: "resemble",
    sentence: "Whom do you ___ more, your father or mother?",
    question: "빈칸에 알맞은 표현은?",
    choices: ["resemble", "resemble to", "look like", "resemble with"],
    answer: 0,
    explanation: "resemble은 타동사로 전치사 없이 목적어를 바로 취한다."
  },
  {
    id: 1384, set: 6, verb: "resemble",
    sentence: "These two cases ___ each other in many ways.",
    question: "빈칸에 알맞은 표현은?",
    choices: ["resemble", "resemble with", "are resembled", "look alike"],
    answer: 0,
    explanation: "resemble은 3형식 타동사로 전치사 없이 목적어를 취한다."
  },
  {
    id: 137, set: 6, verb: "reach",
    sentence: "We finally ___ our destination.",
    question: "빈칸에 알맞은 표현과 의미는?",
    choices: ["reached", "reached to our destination", "reached at our destination", "arrived our destination"],
    answer: 0,
    explanation: "reach + 목적어는 3형식으로 전치사 없이 쓴다. arrive는 자동사로 arrive at/in을 쓴다."
  },
  {
    id: 1372, set: 6, verb: "reach",
    sentence: "Sales ___ a record high this month.",
    question: "빈칸에 알맞은 표현은?",
    choices: ["reached", "reached to", "arrived at", "got"],
    answer: 0,
    explanation: "reach는 3형식 타동사로 전치사 없이 수치나 장소등의 목적어를 바로 취한다."
  },
  {
    id: 1373, set: 6, verb: "reach",
    sentence: "The climber finally ___ the peak of the mountain.",
    question: "빈칸에 알맞은 표현은?",
    choices: ["reached", "reached at", "arrived", "got to at"],
    answer: 0,
    explanation: "reach는 3형식 타동사로 전치사 없이 목적어를 취한다."
  },
  {
    id: 1374, set: 6, verb: "reach",
    sentence: "Please contact me when you ___ the airport.",
    question: "빈칸에 알맞은 표현은?",
    choices: ["reach", "reach to", "arrive in", "get"],
    answer: 0,
    explanation: "reach는 타동사로 장소를 목적어로 바로 취한다."
  },
  {
    id: 139, set: 6, verb: "enter",
    sentence: "She ___ the room.",
    question: "빈칸에 알맞은 표현과 의미는?",
    choices: ["entered", "entered into the room", "entered to the room", "was entered the room"],
    answer: 0,
    explanation: "enter는 3형식 타동사로 전치사 없이 목적어를 취한다. enter into (X)"
  },
  {
    id: 1392, set: 6, verb: "enter",
    sentence: "He ___ the competition last year.",
    question: "빈칸에 알맞은 표현은?",
    choices: ["entered", "entered into", "joined into", "participated"],
    answer: 0,
    explanation: "enter는 타동사로 전치사 없이 목적어를 취한다."
  },
  {
    id: 1393, set: 6, verb: "enter",
    sentence: "The police ___ the building through the back door.",
    question: "빈칸에 알맞은 표현은?",
    choices: ["entered", "entered into", "joined into", "was entered"],
    answer: 0,
    explanation: "enter는 '들어가다'는 의미일 때 전치사를 쓰지 않는 타동사이다."
  },
  {
    id: 1394, set: 6, verb: "enter",
    sentence: "New data should be ___ into the system.",
    question: "빈칸에 알맞은 표현은?",
    choices: ["entered", "entered into", "put", "typed"],
    answer: 0,
    explanation: "정보를 입력한다는 의미의 enter는 3형식 또는 타동사적 활용이 가능하다."
  },
  {
    id: 140, set: 6, verb: "attend",
    sentence: "Will you ___ the meeting?",
    question: "빈칸에 알맞은 표현과 의미는?",
    choices: ["attend", "attend to the meeting", "attend at the meeting", "was attended"],
    answer: 0,
    explanation: "attend + 목적어는 3형식으로 '참석하다'의 의미. attend to는 '~를 돌보다'로 의미가 다르다."
  },
  {
    id: 1402, set: 6, verb: "attend",
    sentence: "She has to ___ the customer's needs.",
    question: "빈칸에 알맞은 표현은?",
    choices: ["attend to", "attend", "attend at", "wait for"],
    answer: 0,
    explanation: "attend to는 '~에 전념하다, 돌보다'라는 의미로 attend(참석하다)와 구분해야 한다."
  },
  {
    id: 1403, set: 6, verb: "attend",
    sentence: "Only a few students ___ the lecture yesterday.",
    question: "빈칸에 알맞은 표현은?",
    choices: ["attended", "attended to", "were attended", "joined in"],
    answer: 0,
    explanation: "참석하다는 뜻의 attend는 타동사로 전치사가 필요 없다."
  },
  {
    id: 1404, set: 6, verb: "attend",
    sentence: "The nurse will ___ the patient's needs.",
    question: "빈칸에 알맞은 표현은?",
    choices: ["attend to", "attend", "be attended to", "take care of something"],
    answer: 0,
    explanation: "attend to + 명사는 '~를 돌보다, 주의를 기울이다'는 의미이다."
  },
  {
    id: 141, set: 6, verb: "approach",
    sentence: "The cat ___ the mouse slowly.",
    question: "빈칸에 알맞은 동사와 의미는?",
    choices: ["approached", "approached to the mouse", "was approached", "approaching to the mouse"],
    answer: 0,
    explanation: "approach는 3형식 타동사로 전치사 없이 목적어를 취한다. approach to (X)"
  },
  {
    id: 1412, set: 6, verb: "approach",
    sentence: "Winter is ___.",
    question: "빈칸에 알맞은 표현은?",
    choices: ["approaching", "approaching us", "approached to", "is approached"],
    answer: 0,
    explanation: "approach가 시간적/공간적으로 다가온다는 의미일 때 1형식으로 쓰일 수 있다."
  },
  {
    id: 1413, set: 6, verb: "approach",
    sentence: "Don't ___ the wild animals in the park.",
    question: "빈칸에 알맞은 표현은?",
    choices: ["approach", "approach to", "be approached", "near to"],
    answer: 0,
    explanation: "approach는 타동사로 전치사 없이 목적어를 취한다."
  },
  {
    id: 1414, set: 6, verb: "approach",
    sentence: "Scientists are ___ a major breakthrough.",
    question: "빈칸에 알맞은 표현은?",
    choices: ["approaching", "approaching to", "reaching to", "getting to"],
    answer: 0,
    explanation: "목표나 단계에 다가가는 approach는 타동사로 쓰인다."
  },
  {
    id: 15, set: 6, verb: "answer",
    sentence: "Please ___ the question.",
    question: "빈칸에 알맞은 표현과 의미는?",
    choices: ["answer", "answer to the question", "be answered", "answering to"],
    answer: 0,
    explanation: "answer는 3형식 타동사로 전치사 없이 목적어를 취한다. answer to (X)"
  },
  {
    id: 152, set: 6, verb: "answer",
    sentence: "She didn't ___ the phone.",
    question: "빈칸에 알맞은 표현은?",
    choices: ["answer", "answer to", "get to", "respond with"],
    answer: 0,
    explanation: "answer는 타동사로 전치사 없이 목적어를 취한다."
  },
  {
    id: 153, set: 6, verb: "answer",
    sentence: "He didn't ___ any of my emails.",
    question: "빈칸에 알맞은 표현은?",
    choices: ["answer", "answer to", "reply", "respond with"],
    answer: 0,
    explanation: "answer는 타동사로 목적어를 바로 취한다. reply는 reply to를 써야 한다."
  },
  {
    id: 154, set: 6, verb: "answer",
    sentence: "We are waiting for someone to ___ the door.",
    question: "빈칸에 알맞은 표현은?",
    choices: ["answer", "answer at", "open for", "respond"],
    answer: 0,
    explanation: "문이나 전화에 응대하다는 뜻의 answer는 타동사이다."
  },
  {
    id: 143, set: 6, verb: "mention",
    sentence: "He didn't ___ the name.",
    question: "빈칸에 알맞은 표현과 의미는?",
    choices: ["mention", "mention about the name", "mention on the name", "was mentioned the name"],
    answer: 0,
    explanation: "mention은 3형식 타동사로 전치사 없이 목적어를 취한다. mention about (X)"
  },
  {
    id: 1432, set: 6, verb: "mention",
    sentence: "Did he ___ the meeting time?",
    question: "빈칸에 알맞은 표현은?",
    choices: ["mention", "mention about", "talk about", "say about"],
    answer: 0,
    explanation: "mention은 대표적인 3형식 타동사로 전치사를 쓰지 않는다."
  },
  {
    id: 1433, set: 6, verb: "mention",
    sentence: "She forgot to ___ the price of the tickets.",
    question: "빈칸에 알맞은 표현은?",
    choices: ["mention", "mention about", "talk about", "say it"],
    answer: 0,
    explanation: "mention은 타동사이므로 전치사 about을 쓰지 않는다."
  },
  {
    id: 1434, set: 6, verb: "mention",
    sentence: "He briefly ___ his past experiences in the interview.",
    question: "빈칸에 알맞은 표현은?",
    choices: ["mentioned", "mentioned about", "told about", "spoke"],
    answer: 0,
    explanation: "언급하다는 뜻의 mention은 3형식 타동사이다."
  },
  {
    id: 142, set: 6, verb: "marry",
    sentence: "She ___ him last year.",
    question: "빈칸에 알맞은 표현과 의미는?",
    choices: ["married", "married with him", "married to him", "was married him"],
    answer: 0,
    explanation: "marry는 3형식 타동사로 전치사 없이 목적어를 취한다. marry with (X), marry to (X)"
  },
  {
    id: 1422, set: 6, verb: "marry",
    sentence: "He wants to ___ her.",
    question: "빈칸에 알맞은 표현은?",
    choices: ["marry", "marry to", "marry with", "get married to"],
    answer: 0,
    explanation: "marry는 타동사이므로 목적어를 바로 취한다. get married to는 수동적 표현이다."
  },
  {
    id: 1423, set: 6, verb: "marry",
    sentence: "They are planning to ___ next June.",
    question: "빈칸에 알맞은 표현은?",
    choices: ["marry", "marry with", "get married to", "be married with"],
    answer: 0,
    explanation: "marry는 문맥에 따라 자동사로도 쓰일 수 있으나, 결혼하다는 행위 자체는 marry를 주로 사용한다."
  },
  {
    id: 1424, set: 6, verb: "marry",
    sentence: "He ___ his high school sweetheart.",
    question: "빈칸에 알맞은 표현은?",
    choices: ["married", "married with", "married to", "was married"],
    answer: 0,
    explanation: "marry는 타동사이므로 전치사 없이 목적어를 취한다."
  }
];
