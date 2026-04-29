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
  // 1세트: 1형식 전용 동사 (happen, occur, rise, matter 등)
  {
    id: 1, set: 1, verb: "happen",
    sentence: "Unexpected accidents can happen anytime.",
    question: "위 문장에서 happen의 의미와 형식은?",
    choices: ["일어나다, 발생하다 (1형식)", "C하게 되다 (2형식)", "O를 발생시키다 (3형식)", "생각나다 (1형식)"],
    answer: 0,
    explanation: "happen은 '일어나다'라는 의미의 대표적인 자동사로 1형식으로만 쓰입니다."
  },
  {
    id: 2, set: 1, verb: "matter",
    sentence: "It doesn't matter what they say.",
    question: "위 문장에서 matter의 의미로 알맞은 것은?",
    choices: ["중요하다 (1형식)", "문제가 되다 (2형식)", "O를 물질로 만들다 (3형식)", "상관하다 (3형식)"],
    answer: 0,
    explanation: "matter가 1형식 자동사로 쓰이면 '중요하다'라는 의미를 가집니다."
  },
  {
    id: 3, set: 1, verb: "rise",
    sentence: "The sun rises in the east.",
    question: "위 문장의 동사 rise의 형식은?",
    choices: ["1형식", "2형식", "3형식", "5형식"],
    answer: 0,
    explanation: "rise는 '오르다, 뜨다'라는 의미의 1형식 자동사입니다. 타동사 raise(올리다)와 구별해야 합니다."
  },

  // 2세트: 2형식 전용 동사 (seem, appear, remain 등)
  {
    id: 10, set: 2, verb: "seem",
    sentence: "He seems happy with the result.",
    question: "빈칸에 들어갈 seem의 해석으로 옳은 것은?",
    choices: ["~하게 보이다, ~인 것 같다 (2형식)", "나타나다 (1형식)", "행동하다 (1형식)", "좋아하다 (3형식)"],
    answer: 0,
    explanation: "seem은 주격보어를 취하는 대표적인 2형식 동사로 '~하게 보이다'라는 뜻입니다."
  },
  {
    id: 11, set: 2, verb: "remain",
    sentence: "The mystery remains unsolved.",
    question: "위 문장에서 remain의 문장 형식은?",
    choices: ["1형식", "2형식", "3형식", "5형식"],
    answer: 1,
    explanation: "remain이 '~한 채로 남아있다'는 의미로 형용사 보어(unsolved)를 취했으므로 2형식입니다."
  },

  // 3세트: 1형식 vs 2형식 겸용 (grow, stay, run, go, come 등)
  {
    id: 20, set: 3, verb: "grow",
    sentence: "The rice grows well in this area.",
    question: "위 문장에서 grow의 의미와 형식은?",
    choices: ["자라다 (1형식)", "C하게 되다 (2형식)", "O를 기르다 (3형식)", "증가하다 (1형식)"],
    answer: 0,
    explanation: "뒤에 보어나 목적어 없이 부사(well)만 있으므로 '자라다'라는 의미의 1형식 자동사입니다."
  },
  {
    id: 21, set: 3, verb: "grow",
    sentence: "It grew dark outside.",
    question: "위 문장에서 grow의 의미와 형식은?",
    choices: ["자라다 (1형식)", "C하게 되다 (2형식)", "O를 기르다 (3형식)", "어두워지다 (1형식)"],
    answer: 1,
    explanation: "뒤에 형용사 보어(dark)가 왔으므로 '~하게 되다'라는 의미의 2형식 동사입니다."
  },
  {
    id: 22, set: 3, verb: "stay",
    sentence: "We stayed at the hotel for two nights.",
    question: "위 문장에서 stay의 형식은?",
    choices: ["1형식 (머무르다)", "2형식 (C한 채로 있다)", "3형식 (O를 머물게 하다)", "1형식 (계속 있다)"],
    answer: 0,
    explanation: "장소 부사구(at the hotel)가 뒤에 오며 '머무르다'의 의미로 쓰인 1형식입니다."
  },
  {
    id: 23, set: 3, verb: "stay",
    sentence: "Please stay calm during the test.",
    question: "위 문장에서 stay의 형식은?",
    choices: ["1형식 (머무르다)", "2형식 (C한 채로 있다)", "3형식 (O를 유지하다)", "5형식 (O를 C하게 두다)"],
    answer: 1,
    explanation: "뒤에 형용사 보어(calm)가 와서 '어떠한 상태를 유지하다'는 의미의 2형식입니다."
  },
  {
    id: 24, set: 3, verb: "run",
    sentence: "He runs every morning.",
    question: "위 문장에서 run의 의미와 형식은?",
    choices: ["달리다 (1형식)", "C가 되다 (2형식)", "운영하다 (3형식)", "작동하다 (1형식)"],
    answer: 0,
    explanation: "동작만을 나타내는 1형식 자동사입니다."
  },
  {
    id: 25, set: 3, verb: "run",
    sentence: "The well ran dry.",
    question: "위 문장에서 run의 의미와 형식은?",
    choices: ["달리다 (1형식)", "C가 되다 (2형식)", "O를 운영하다 (3형식)", "말라버리다 (1형식)"],
    answer: 1,
    explanation: "형용사 보어(dry)와 함께 쓰여 '~한 상태가 되다(이형식)'라는 의미가 됩니다."
  },

  // 4세트: 2형식 vs 3형식 겸용 (smell, taste, feel, look, turn 등)
  {
    id: 30, set: 4, verb: "smell",
    sentence: "The soup smells good.",
    question: "위 문장에서 smell의 형식은?",
    choices: ["1형식", "2형식 (a한 냄새가 나다)", "3형식 (O의 냄새를 맡다)", "5형식"],
    answer: 1,
    explanation: "주어의 상태를 설명하는 형용사(good)가 보어로 쓰인 2형식 감각동사입니다."
  },
  {
    id: 31, set: 4, verb: "smell",
    sentence: "He smelled the flower.",
    question: "위 문장에서 smell의 형식은?",
    choices: ["1형식", "2형식 (a한 냄새가 나다)", "3형식 (O의 냄새를 맡다)", "5형식"],
    answer: 2,
    explanation: "뒤에 목적어(the flower)가 오는 3형식 타동사로 '냄새를 맡다'라는 뜻입니다."
  },
  {
    id: 32, set: 4, verb: "turn",
    sentence: "The leaves turned red.",
    question: "위 문장에서 turn의 의미와 형식은?",
    choices: ["돌리다 (1형식)", "C가 되다 / 변하다 (2형식)", "O를 뒤집다 (3형식)", "회전시키다 (3형식)"],
    answer: 1,
    explanation: "색깔 등의 변화를 나타내는 형용사 보어(red)가 왔으므로 2형식입니다."
  },
  {
    id: 33, set: 4, verb: "look",
    sentence: "You look tired today.",
    question: "위 문장에서 look의 형식으로 알맞은 것은?",
    choices: ["1형식 (바라보다)", "2형식 (~하게 보이다)", "3형식 (O를 보다)", "5형식"],
    answer: 1,
    explanation: "외양이나 상태를 나타내는 형용사(tired)가 보어로 쓰인 2형식입니다."
  },

  // 5세트: 3형식 전용 동사 (중요 자동사 혼동 주의 - discuss, enter 등)
  {
    id: 40, set: 5, verb: "discuss",
    sentence: "We discussed the problem for an hour.",
    question: "discuss에 대한 설명으로 틀린 것은?",
    choices: ["3형식 타동사이다.", "뒤에 목적어가 바로 온다.", "전치사 about과 함께 써야 한다.", "'~에 대해 토론하다'라는 뜻이다."],
    answer: 2,
    explanation: "discuss는 완전타동사로 전치사(about)를 쓰지 않고 목적어를 바로 취합니다."
  },
  {
    id: 41, set: 5, verb: "resemble",
    sentence: "She resembles her mother.",
    question: "위 문장의 형식은?",
    choices: ["1형식", "2형식", "3형식", "5형식"],
    answer: 2,
    explanation: "resemble은 '~와 닮다'라는 의미의 3형식 타동사입니다. 전치사 with를 쓰지 않습니다."
  }
];
