export interface QuizQuestion {
  id: number;
  set: number;
  sentence: string;
  question: string;
  choices: string[];
  answer: number;
  explanation: string;
}

export const MODAL_QUIZ_POOL: QuizQuestion[] = [
  // 1세트 문제 Pool (can / may / will)
  {
    id: 1, set: 1,
    sentence: "John ___ run 50 meters in 7 seconds.",
    question: "빈칸에 알맞은 조동사와 의미는?",
    choices: ["can (~할 수 있다, 능력)", "may (~해도 된다, 허가)", "will (~할 것이다, 미래)", "must (~해야 한다, 의무)"],
    answer: 0,
    explanation: "can은 능력을 나타내며 be able to로 바꿀 수 있다."
  },
  {
    id: 2, set: 1,
    sentence: "You ___ use my scissors.",
    question: "빈칸에 알맞은 조동사와 의미는?",
    choices: ["can (~해도 된다, 허가)", "must (~해야 한다, 의무)", "will (~하겠다, 의지)", "should (~해야 한다, 충고)"],
    answer: 0,
    explanation: "can은 허가의 의미로 '~해도 된다'를 나타낸다."
  },
  {
    id: 3, set: 1,
    sentence: "___ you answer the phone?",
    question: "빈칸에 알맞은 조동사와 의미는?",
    choices: ["Can (~해주겠니?, 요청)", "May (~해도 된다, 허가)", "Will (~할 것이다, 미래)", "Must (~해야 한다, 의무)"],
    answer: 0,
    explanation: "Can은 요청의 의미로 '~해주겠니?'를 나타낸다."
  },
  {
    id: 4, set: 1,
    sentence: "That ___ be Matt. Matt is much taller.",
    question: "빈칸에 알맞은 표현과 의미는?",
    choices: ["can't (~일 리가 없다, 추측)", "may not (~이 아닐지도 모른다)", "shouldn't (~하면 안 된다)", "won't (~하지 않겠다, 의지)"],
    answer: 0,
    explanation: "can't는 추측의 부정으로 '~일 리가 없다'를 나타낸다."
  },
  {
    id: 5, set: 1,
    sentence: "He ___ be at home. He said he was going home an hour ago.",
    question: "빈칸에 알맞은 조동사와 의미는?",
    choices: ["could (~일 수도 있다, 추측)", "can't (~일 리가 없다, 추측)", "must (~임이 틀림없다, 추측)", "may not (~이 아닐지도 모른다)"],
    answer: 0,
    explanation: "could는 약한 추측으로 '~일 수도 있다'를 나타낸다."
  },
  {
    id: 6, set: 1,
    sentence: "We ___ need boxes.",
    question: "빈칸에 알맞은 조동사와 의미는?",
    choices: ["may (~일지도 모른다, 약한 추측)", "must (~임이 틀림없다, 강한 추측)", "can't (~일 리가 없다)", "will (~할 것이다, 미래)"],
    answer: 0,
    explanation: "may는 약한 추측으로 '~일지도 모른다'를 나타낸다."
  },
  {
    id: 7, set: 1,
    sentence: "I ___ enter high school next year.",
    question: "빈칸에 알맞은 조동사와 의미는?",
    choices: ["will (~할 것이다, 미래)", "can (~할 수 있다, 능력)", "should (~해야 한다, 충고)", "may (~일지도 모른다, 추측)"],
    answer: 0,
    explanation: "will은 미래를 나타내며 be going to로 바꿀 수 있다."
  },
  {
    id: 8, set: 1,
    sentence: "___ you please be quiet?",
    question: "빈칸에 알맞은 조동사와 특징은?",
    choices: ["Would (will보다 정중한 요청)", "Will (요청)", "Can (요청)", "Could (can보다 정중한 요청)"],
    answer: 0,
    explanation: "would는 will보다 정중한 요청을 나타낸다."
  },
  {
    id: 33, set: 1,
    sentence: "We ___ always tell the truth.",
    question: "빈칸에 알맞은 조동사와 의미는?",
    choices: ["will (~하겠다, 의지)", "can (~할 수 있다, 능력)", "may (~해도 된다, 허가)", "must (~해야 한다, 의무)"],
    answer: 0,
    explanation: "will은 주어의 의지를 나타내어 '~하겠다'는 의미로 흔히 쓰인다."
  },
  {
    id: 34, set: 1,
    sentence: "She ___ have a cold or the flu.",
    question: "빈칸에 알맞은 조동사와 의미는?",
    choices: ["might (~일지도 모른다)", "must (~임이 틀림없다)", "can't (~일 리가 없다)", "will (~할 것이다)"],
    answer: 0,
    explanation: "might는 may보다 더 불확실한 약한 추측을 나타낸다."
  },
  // 2세트 문제 Pool (must / should)
  {
    id: 9, set: 2,
    sentence: "You ___ submit your assignment by e-mail.",
    question: "빈칸에 알맞은 조동사와 의미는?",
    choices: ["must (~해야 한다, 강한 의무)", "should (~해야 한다, 약한 의무/충고)", "can (~해도 된다, 허가)", "will (~하겠다, 의지)"],
    answer: 0,
    explanation: "must는 강한 의무를 나타내며 have to로 바꿀 수 있다."
  },
  {
    id: 10, set: 2,
    sentence: "We ___ break the law.",
    question: "빈칸에 알맞은 표현과 의미는?",
    choices: ["must not (~해서는 안 된다, 강한 금지)", "don't have to (~할 필요가 없다, 불필요)", "should not (~하지 않는 게 좋다, 충고)", "can't (~일 리가 없다, 추측)"],
    answer: 0,
    explanation: "must not은 강한 금지로 '~해서는 안 된다'이고, don't have to는 불필요로 의미가 다르다."
  },
  {
    id: 11, set: 2,
    sentence: "You ___ turn off the radio.",
    question: "빈칸에 알맞은 표현과 의미는?",
    choices: ["don't have to (~할 필요가 없다, 불필요)", "must not (~해서는 안 된다, 강한 금지)", "should not (~하지 않는 게 좋다)", "can't (~할 수 없다)"],
    answer: 0,
    explanation: "don't have to는 불필요로 '~할 필요가 없다'이며 must not과 의미가 완전히 다르다."
  },
  {
    id: 12, set: 2,
    sentence: "The interview ___ be long.",
    question: "빈칸에 알맞은 조동사와 의미는?",
    choices: ["must (~임이 틀림없다, 강한 추측)", "should (~해야 한다, 의무)", "can (~할 수 있다, 능력)", "will (~할 것이다, 미래)"],
    answer: 0,
    explanation: "must는 강한 추측으로 '~임이 틀림없다'를 나타낸다."
  },

  {
    id: 13, set: 2,
    sentence: "We ___ help other people.",
    question: "빈칸에 알맞은 조동사와 의미는?",
    choices: ["should (~해야 한다, 충고·의무)", "must (~해야 한다, 강한 의무)", "can (~해도 된다, 허가)", "may (~해도 된다, 허가)"],
    answer: 0,
    explanation: "should는 ought to와 같은 의미로 must보다 약한 의무/충고를 나타낸다."
  },
  // 3세트 문제 Pool (should 생략)
  {
    id: 14, set: 3,
    sentence: "I ___ that Janet (should) be the class president.",
    question: "빈칸에 알맞은 동사는? (should 생략 가능 동사)",
    choices: ["suggested", "thought", "knew", "believed"],
    answer: 0,
    explanation: "suggest는 제안 동사로 that절에 should + 동사원형이 오며 should는 생략 가능하다."
  },
  {
    id: 15, set: 3,
    sentence: "He ___ that we (should) report the lost wallet to the police.",
    question: "빈칸에 알맞은 동사는?",
    choices: ["insisted", "said", "thought", "told"],
    answer: 0,
    explanation: "insist는 주장 동사로 that절에 should + 동사원형이 오며 should는 생략 가능하다."
  },
  {
    id: 35, set: 3,
    sentence: "The doctor recommended that he ___ more fruit.",
    question: "빈칸에 알맞은 형태는?",
    choices: ["eat", "eats", "ate", "to eat"],
    answer: 0,
    explanation: "recommend(추천/제안) 동사 뒤의 that절에서는 (should) + 동사원형을 쓴다."
  },
  {
    id: 36, set: 3,
    sentence: "The manager required that everyone ___ on time.",
    question: "빈칸에 알맞은 형태는?",
    choices: ["be", "is", "was", "are"],
    answer: 0,
    explanation: "require(요구) 동사 뒤의 that절에서는 (should) + 동사원형을 쓴다. be동사는 원형인 be 그대로 쓴다."
  },
  {
    id: 16, set: 3,
    sentence: "다음 중 that절에 'should + 동사원형'이 오는 동사가 아닌 것은?",
    question: "",
    choices: ["know", "suggest", "demand", "require"],
    answer: 0,
    explanation: "know는 일반 인식 동사로 should 생략 구문과 관계없다. suggest/demand/require는 모두 해당 동사다."
  },
  // 4세트 문제 Pool (used to / would)
  {
    id: 17, set: 4,
    sentence: "Helen ___ go to church when she was young.",
    question: "빈칸에 알맞은 표현과 의미는?",
    choices: ["used to (~하곤 했다, 과거 습관)", "would (~하곤 했다, 과거 습관)", "was used to (~하는 데 사용됐다)", "둘 다 가능"],
    answer: 3,
    explanation: "과거 습관은 used to와 would 모두 가능하다."
  },
  {
    id: 18, set: 4,
    sentence: "There ___ be a bridge here two years ago.",
    question: "빈칸에 알맞은 표현은? (과거 상태)",
    choices: ["used to (~이었다, 과거 상태 가능)", "would (~하곤 했다, 과거 습관만 가능)", "was used to (~에 익숙했다)", "had better (~하는 것이 낫다)"],
    answer: 0,
    explanation: "would는 과거 상태를 나타낼 수 없다. 과거 상태는 반드시 used to를 써야 한다."
  },
  {
    id: 19, set: 4,
    sentence: "This knife ___ cut bread.",
    question: "빈칸에 알맞은 표현과 의미는?",
    choices: ["is used to (~하는 데 사용되다, 수동태)", "used to (~하곤 했다, 과거 습관)", "is used to + V-ing (~에 익숙하다)", "would (~하곤 했다)"],
    answer: 0,
    explanation: "be used to + 동사원형은 수동태로 '~하는 데 사용되다'의 의미다."
  },
  {
    id: 20, set: 4,
    sentence: "I ___ eating spicy food.",
    question: "빈칸에 알맞은 표현과 의미는?",
    choices: ["am used to (~에 익숙하다)", "used to (~하곤 했다, 과거 습관)", "am used to + 동사원형 (~하는 데 사용되다)", "would (~하곤 했다)"],
    answer: 0,
    explanation: "be used to + V-ing/명사는 '~에 익숙하다'의 의미다. 동명사(eating)가 왔으므로 정답."
  },
  {
    id: 21, set: 4,
    sentence: "James (___ / ___) be short, but he is tall now.",
    question: "빈칸에 들어갈 수 있는 표현은?",
    choices: ["used to만 가능 (과거 상태이므로)", "would만 가능", "둘 다 가능", "둘 다 불가능"],
    answer: 0,
    explanation: "be short는 과거의 상태를 나타내므로 would는 불가. used to만 가능하다."
  },
  // 5세트 문제 Pool (조동사 + have + p.p.)
  {
    id: 22, set: 5,
    sentence: "I ___ sent the wrong file.",
    question: "빈칸에 알맞은 표현과 의미는?",
    choices: ["may have (~했을 수도 있다, 약한 추측)", "must have (~했음이 틀림없다, 강한 추측)", "can't have (~했을 리가 없다)", "should have (~했어야 했다, 후회)"],
    answer: 0,
    explanation: "may[might] have p.p.는 과거에 대한 약한 추측으로 '~했을 수도 있다'를 나타낸다."
  },
  {
    id: 23, set: 5,
    sentence: "That tree on the road ___ during the storm.",
    question: "빈칸에 알맞은 표현과 의미는? (강한 추측)",
    choices: ["must have fallen (~쓰러졌음이 틀림없다)", "may have fallen (~쓰러졌을 수도 있다)", "should have fallen (~쓰러졌어야 했다)", "could have fallen (~쓰러졌을 수도 있었다)"],
    answer: 0,
    explanation: "must have p.p.는 과거에 대한 강한 추측으로 '~했음이 틀림없다'를 나타낸다."
  },
  {
    id: 24, set: 5,
    sentence: "The neighbors ___ already.",
    question: "빈칸에 알맞은 표현과 의미는? (강한 추측 부정)",
    choices: ["can't have moved (~이사했을 리가 없다)", "must have moved (~이사했음이 틀림없다)", "should have moved (~이사했어야 했다)", "may have moved (~이사했을 수도 있다)"],
    answer: 0,
    explanation: "can't have p.p.는 과거에 대한 강한 추측 부정으로 '~했을 리가 없다'를 나타낸다."
  },
  {
    id: 25, set: 5,
    sentence: "You ___ me before throwing it away.",
    question: "빈칸에 알맞은 표현과 의미는? (후회·유감)",
    choices: ["should have asked (~물어봤어야 했다, 후회)", "must have asked (~물어봤음이 틀림없다, 추측)", "may have asked (~물어봤을 수도 있다)", "could have asked (~물어볼 수도 있었다)"],
    answer: 0,
    explanation: "should have p.p.는 과거에 하지 않은 것에 대한 후회로 '~했어야 했다'를 나타낸다."
  },
  {
    id: 26, set: 5,
    sentence: "We ___ abroad, but we stayed home.",
    question: "빈칸에 알맞은 표현과 의미는?",
    choices: ["could have traveled (~갔을 수도 있었다, 후회)", "should have traveled (~갔어야 했다, 후회)", "must have traveled (~갔음이 틀림없다)", "may have traveled (~갔을 수도 있다)"],
    answer: 0,
    explanation: "could have p.p.는 과거에 하지 않은 것에 대한 유감으로 '~했을 수도 있었다'를 나타낸다."
  },
  // 6세트 문제 Pool (조동사 관용 표현)
  {
    id: 27, set: 6,
    sentence: "I ___ a room with a balcony.",
    question: "빈칸에 알맞은 표현과 의미는?",
    choices: ["would like (~을 원하다)", "would like to (~하고 싶다)", "would rather (~하겠다)", "had better (~하는 것이 낫다)"],
    answer: 0,
    explanation: "would like + 명사는 '~을 원하다'의 의미. 뒤에 명사(a room)가 왔으므로 정답."
  },
  {
    id: 28, set: 6,
    sentence: "I ___ play tennis.",
    question: "빈칸에 알맞은 표현과 의미는?",
    choices: ["would like to (~하고 싶다)", "would like (~을 원하다)", "would rather (~하겠다)", "may as well (~하는 편이 좋다)"],
    answer: 0,
    explanation: "would like to + 동사원형은 '~하고 싶다'. 뒤에 동사원형(play)이 왔으므로 정답."
  },
  {
    id: 29, set: 6,
    sentence: "I ___ visit Spain than France.",
    question: "빈칸에 알맞은 표현과 의미는?",
    choices: ["would rather (~하겠다, 차라리)", "would like to (~하고 싶다)", "may as well (~하는 편이 좋다)", "had better (~하는 것이 낫다)"],
    answer: 0,
    explanation: "would rather + 동사원형은 '차라리 ~하겠다'. than과 함께 쓰여 비교를 나타낸다."
  },
  {
    id: 30, set: 6,
    sentence: "They ___ think so.",
    question: "빈칸에 알맞은 표현과 의미는?",
    choices: ["may well (~하는 것도 당연하다)", "may as well (~하는 편이 좋다)", "had better (~하는 것이 낫다)", "would rather (~하겠다)"],
    answer: 0,
    explanation: "may well + 동사원형은 '~하는 것도 당연하다'의 의미."
  },
  {
    id: 31, set: 6,
    sentence: "You ___ try the new program.",
    question: "빈칸에 알맞은 표현과 의미는?",
    choices: ["may as well (~하는 편이 좋다)", "may well (~하는 것도 당연하다)", "had better (~하는 것이 낫다)", "would rather (~하겠다)"],
    answer: 0,
    explanation: "may as well + 동사원형은 '~하는 편이 좋다'의 의미. may well과 혼동 주의."
  },
  {
    id: 32, set: 6,
    sentence: "You ___ save the money.",
    question: "빈칸에 알맞은 표현과 의미는?",
    choices: ["had better (~하는 것이 낫다)", "may as well (~하는 편이 좋다)", "would rather (~하겠다)", "may well (~하는 것도 당연하다)"],
    answer: 0,
    explanation: "had better + 동사원형은 '~하는 것이 낫다'. 부정형은 had better not."
  },
  // 추가 문제 Pool
  {
    id: 101, set: 1,
    sentence: "Miracles ___ happen anytime.",
    question: "빈칸에 알맞은 조동사와 의미는?",
    choices: ["can (~할 가능성이 있다, 가능)", "must (~임이 틀림없다, 강한 추측)", "will (~할 것이다, 미래)", "should (~해야 한다, 충고)"],
    answer: 0,
    explanation: "can은 가능성을 나타내어 '~할 가능성이 있다'를 뜻한다."
  },
  {
    id: 102, set: 1,
    sentence: "He could[was able to] swim fast when he was young.",
    question: "밑줄 친 could의 의미로 알맞은 것은?",
    choices: ["can의 과거형 (~할 수 있었다, 과거 능력)", "정중한 요청 (~해주시겠어요?)", "약한 추측 (~일 수도 있다)", "허가 (~해도 된다)"],
    answer: 0,
    explanation: "could는 can의 과거형으로 쓰여 과거의 능력을 나타낸다. was able to로 바꿀 수 있다."
  },
  {
    id: 103, set: 1,
    sentence: "___ you give me some advice, please?",
    question: "빈칸에 알맞은 조동사와 특징은?",
    choices: ["Could (can보다 정중한 요청)", "Can (일반 요청)", "Will (미래/요청)", "Would (will보다 정중한 요청)"],
    answer: 0,
    explanation: "Could는 Can보다 정중한 요청을 나타낸다. please와 함께 쓰여 더욱 공손한 표현이 된다."
  },
  {
    id: 104, set: 1,
    sentence: "She ___ have a cold or the flu.",
    question: "빈칸에 알맞은 조동사와 의미는?",
    choices: ["might (~일지도 모른다, 불확실한 추측)", "may (~일지도 모른다, 약한 추측)", "must (~임이 틀림없다, 강한 추측)", "can't (~일 리가 없다)"],
    answer: 0,
    explanation: "might는 may보다 더 불확실한 추측을 나타낸다."
  },
  {
    id: 105, set: 1,
    sentence: "Our goal ___ be met.",
    question: "빈칸에 알맞은 표현과 의미는?",
    choices: ["can't (~이루어질 리가 없다, 추측)", "may not (~이루어지지 않을지도 모른다)", "won't (~이루어지지 않겠다, 의지)", "shouldn't (~이루어지지 않아야 한다)"],
    answer: 0,
    explanation: "can't는 추측의 부정으로 '~일 리가 없다'를 나타낸다."
  },
  {
    id: 106, set: 1,
    sentence: "We ___ always tell the truth.",
    question: "빈칸에 알맞은 조동사와 의미는?",
    choices: ["will (~하겠다, 의지)", "can (~할 수 있다, 능력)", "may (~할지도 모른다, 추측)", "should (~해야 한다, 충고)"],
    answer: 0,
    explanation: "will은 의지를 나타내어 '~하겠다'를 뜻한다."
  },
  {
    id: 107, set: 1,
    sentence: "___ you open the door?",
    question: "빈칸에 알맞은 조동사와 의미는?",
    choices: ["Will (~해주겠니?, 요청)", "Would (~해주시겠어요?, 정중한 요청)", "Can (~해줄 수 있니?, 요청)", "May (~해도 되니?, 허가)"],
    answer: 0,
    explanation: "Will은 요청을 나타내며 '~해주겠니?'를 뜻한다. Would보다는 덜 정중한 표현이다."
  },
  {
    id: 108, set: 1,
    sentence: "다음 중 can의 의미가 나머지와 다른 하나는?",
    question: "",
    choices: ["Can you answer the phone? (요청)", "John can run 50 meters. (능력)", "Miracles can happen. (가능)", "You can use my scissors. (허가)"],
    answer: 0,
    explanation: "Can you answer the phone?는 요청이고, 나머지는 각각 능력/가능/허가를 나타낸다."
  },
  {
    id: 109, set: 2,
    sentence: "You ___ follow the traffic rules.",
    question: "빈칸에 알맞은 조동사와 의미는? (강제성 있는 의무)",
    choices: ["must (~해야 한다, 강한 의무)", "should (~해야 한다, 약한 의무)", "can (~해도 된다, 허가)", "may (~해도 된다, 허가)"],
    answer: 0,
    explanation: "must는 강제성이 있는 의무를 나타낸다. should보다 훨씬 강한 표현이다."
  },
  {
    id: 110, set: 2,
    sentence: "You ___ wear dark clothes at the funeral.",
    question: "빈칸에 알맞은 조동사와 의미는? (충고)",
    choices: ["should (~해야 한다, 약한 의무/충고)", "must (~해야 한다, 강한 의무)", "can (~해도 된다, 허가)", "will (~하겠다, 의지)"],
    answer: 0,
    explanation: "should는 must보다 약한 의무/충고를 나타낸다. 장례식 복장처럼 강제는 아니지만 권고되는 상황에 쓴다."
  },
  {
    id: 111, set: 2,
    sentence: "must not vs don't have to: 'We ___ break the law.'에서 빈칸의 의미는?",
    question: "",
    choices: ["must not (~해서는 안 된다, 강한 금지)", "don't have to (~할 필요가 없다, 불필요)", "should not (~하지 않는 게 좋다)", "cannot (~할 수 없다)"],
    answer: 0,
    explanation: "must not은 강한 금지이고, don't have to는 불필요의 의미로 서로 완전히 다르다."
  },
  {
    id: 112, set: 2,
    sentence: "The interview ___ be long. (그 인터뷰는 오래 걸릴 리가 없다.)",
    question: "빈칸에 알맞은 표현은? (강한 추측 부정)",
    choices: ["can't (~일 리가 없다)", "must (~임이 틀림없다)", "shouldn't (~하면 안 된다)", "may not (~이 아닐지도 모른다)"],
    answer: 0,
    explanation: "must가 강한 추측일 때, 그 부정형은 must not이 아닌 can't를 쓴다."
  },
  {
    id: 113, set: 2,
    sentence: "다음 중 의무의 강도가 가장 강한 표현은?",
    question: "",
    choices: ["must", "should", "ought to", "had better"],
    answer: 0,
    explanation: "must > had better > should ≈ ought to 순으로 의무의 강도가 강하다."
  },
  {
    id: 114, set: 2,
    sentence: "We ___ [ought to] help other people.",
    question: "밑줄 친 표현과 바꿔 쓸 수 있는 것은?",
    choices: ["should", "must", "have to", "can"],
    answer: 0,
    explanation: "should와 ought to는 같은 의미로 충고/의무를 나타내며 서로 바꿔 쓸 수 있다."
  },
  {
    id: 115, set: 3,
    sentence: "The doctor recommended that she ___ more rest.",
    question: "빈칸에 알맞은 형태는?",
    choices: ["(should) get (동사원형)", "gets (3인칭 단수)", "got (과거형)", "is getting (현재진행형)"],
    answer: 0,
    explanation: "recommend는 제안/추천 동사로 that절에 should + 동사원형이 오며 should는 생략 가능하다."
  },
  {
    id: 116, set: 3,
    sentence: "The teacher demanded that the student ___ the homework again.",
    question: "빈칸에 알맞은 형태는?",
    choices: ["(should) do (동사원형)", "does (3인칭 단수)", "did (과거형)", "has done (현재완료)"],
    answer: 0,
    explanation: "demand는 요구 동사로 that절에 should + 동사원형이 온다. 주어가 3인칭이어도 동사원형을 쓴다."
  },
  {
    id: 117, set: 3,
    sentence: "The law requires that everyone ___ a seatbelt.",
    question: "빈칸에 알맞은 형태는?",
    choices: ["(should) wear (동사원형)", "wears (3인칭 단수)", "wore (과거형)", "is wearing (현재진행형)"],
    answer: 0,
    explanation: "require는 요구 동사로 that절에 should + 동사원형이 오며 주어에 관계없이 동사원형을 쓴다."
  },
  {
    id: 118, set: 3,
    sentence: "The manager ordered that all employees ___ early.",
    question: "빈칸에 알맞은 형태는?",
    choices: ["(should) arrive (동사원형)", "arrives (3인칭)", "arrived (과거형)", "will arrive (미래형)"],
    answer: 0,
    explanation: "order는 명령 동사로 that절에 should + 동사원형이 온다."
  },
  {
    id: 119, set: 3,
    sentence: "다음 중 that절에 'should + 동사원형'이 오지 않는 동사는?",
    question: "",
    choices: ["believe", "suggest", "insist", "recommend"],
    answer: 0,
    explanation: "believe는 일반 인식 동사로 should 생략 구문과 관계없다. suggest/insist/recommend는 모두 해당된다."
  },
  {
    id: 120, set: 4,
    sentence: "I ___ eat onions, but I like them now.",
    question: "빈칸에 알맞은 표현과 의미는?",
    choices: ["didn't use to (~하지 않곤 했다, 과거 습관 부정)", "wouldn't (~하지 않곤 했다)", "wasn't used to (~에 익숙하지 않았다)", "didn't have to (~할 필요가 없었다)"],
    answer: 0,
    explanation: "didn't use to는 과거 습관의 부정형으로 '~하지 않곤 했다'를 나타낸다."
  },
  {
    id: 121, set: 4,
    sentence: "We ___ go camping every summer when we were children.",
    question: "빈칸에 알맞은 표현과 의미는?",
    choices: ["would (~하곤 했다, 과거 습관)", "used to (~하곤 했다, 과거 습관)", "were used to (~에 익숙했다)", "둘 다 가능"],
    answer: 3,
    explanation: "캠핑 가는 것은 과거의 습관이므로 used to와 would 모두 가능하다."
  },
  {
    id: 122, set: 4,
    sentence: "I ___ the hot weather. (나는 더운 날씨에 익숙하다.)",
    question: "빈칸에 알맞은 표현은?",
    choices: ["am used to (~에 익숙하다)", "used to (~하곤 했다)", "am used to + 동사원형 (~하는 데 사용된다)", "would (~하곤 했다)"],
    answer: 0,
    explanation: "be used to + 명사는 '~에 익숙하다'의 의미다. the hot weather(명사)가 왔으므로 정답."
  },
  {
    id: 123, set: 4,
    sentence: "This machine ___ produce 1,000 units per hour.",
    question: "빈칸에 알맞은 표현과 의미는? (수동태)",
    choices: ["is used to (~하는 데 사용된다, 수동태)", "used to (~하곤 했다, 과거 습관)", "is used to + V-ing (~에 익숙하다)", "would (~하곤 했다)"],
    answer: 0,
    explanation: "be used to + 동사원형은 수동태로 '~하는 데 사용된다'의 의미다."
  },
  {
    id: 124, set: 4,
    sentence: "다음 중 used to 대신 would를 쓸 수 없는 문장은?",
    question: "",
    choices: ["There used to be a forest here. (과거 상태)", "She used to walk to school. (과거 습관)", "He used to play the piano. (과거 습관)", "They used to meet every Friday. (과거 습관)"],
    answer: 0,
    explanation: "would는 과거 상태를 나타낼 수 없다. 'There used to be ~'는 상태를 나타내므로 would로 바꿀 수 없다."
  },
  {
    id: 125, set: 5,
    sentence: "She ___ the email. I saw it in her inbox. (그녀는 이메일을 받았음이 틀림없다.)",
    question: "빈칸에 알맞은 표현은?",
    choices: ["must have received", "may have received", "should have received", "could have received"],
    answer: 0,
    explanation: "must have p.p.는 과거에 대한 강한 추측으로 '~했음이 틀림없다'를 나타낸다."
  },
  {
    id: 126, set: 5,
    sentence: "He ___ the bus. He arrived on time. (그는 버스를 놓쳤을 리가 없다.)",
    question: "빈칸에 알맞은 표현은?",
    choices: ["can't have missed", "must have missed", "should have missed", "may have missed"],
    answer: 0,
    explanation: "can't have p.p.는 과거에 대한 강한 추측 부정으로 '~했을 리가 없다'를 나타낸다."
  },
  {
    id: 127, set: 5,
    sentence: "I ___ my umbrella. It might rain. (우산을 가져왔어야 했는데.)",
    question: "빈칸에 알맞은 표현은?",
    choices: ["should have brought", "must have brought", "can't have brought", "may have brought"],
    answer: 0,
    explanation: "should have p.p.는 과거에 하지 않은 것에 대한 후회로 '~했어야 했다'를 나타낸다."
  },
  {
    id: 128, set: 5,
    sentence: "They ___ earlier. They would have caught the train. (더 일찍 떠날 수도 있었는데.)",
    question: "빈칸에 알맞은 표현은?",
    choices: ["could have left", "should have left", "must have left", "can't have left"],
    answer: 0,
    explanation: "could have p.p.는 과거에 하지 않은 것에 대한 유감으로 '~할 수도 있었다'를 나타낸다."
  },
  {
    id: 129, set: 5,
    sentence: "다음 중 후회·유감을 나타내는 표현이 아닌 것은?",
    question: "",
    choices: ["must have p.p. (강한 추측)", "should have p.p. (후회)", "could have p.p. (유감)", "두 개 이상 해당"],
    answer: 0,
    explanation: "must have p.p.는 강한 추측이고, should/could have p.p.가 후회·유감을 나타낸다."
  },
  {
    id: 130, set: 5,
    sentence: "No one answered the door. They ___ out. (그들은 외출했을 수도 있다.)",
    question: "빈칸에 알맞은 표현은? (약한 추측)",
    choices: ["may[might] have gone", "must have gone", "can't have gone", "should have gone"],
    answer: 0,
    explanation: "may[might] have p.p.는 과거에 대한 약한 추측으로 '~했을 수도 있다'를 나타낸다."
  },
  {
    id: 131, set: 6,
    sentence: "I ___ some coffee. (나는 커피를 원한다.)",
    question: "빈칸에 알맞은 표현은?",
    choices: ["would like", "would like to", "would rather", "had better"],
    answer: 0,
    explanation: "would like + 명사는 '~을 원하다'. 뒤에 명사(some coffee)가 왔으므로 정답."
  },
  {
    id: 132, set: 6,
    sentence: "I ___ stay home than go to the party.",
    question: "빈칸에 알맞은 표현과 의미는?",
    choices: ["would rather (~하겠다, 차라리)", "would like to (~하고 싶다)", "may as well (~하는 편이 좋다)", "had better (~하는 것이 낫다)"],
    answer: 0,
    explanation: "would rather A than B는 'B보다 차라리 A하겠다'의 의미다."
  },
  {
    id: 133, set: 6,
    sentence: "You ___ not waste your time. (시간을 낭비하지 않는 것이 낫다.)",
    question: "빈칸에 알맞은 표현은?",
    choices: ["had better", "would rather", "may as well", "may well"],
    answer: 0,
    explanation: "had better not + 동사원형은 '~하지 않는 것이 낫다'의 부정형이다."
  },
  {
    id: 134, set: 6,
    sentence: "There's nothing else to do. We ___ go home.",
    question: "빈칸에 알맞은 표현과 의미는?",
    choices: ["may as well (~하는 편이 좋다)", "may well (~하는 것도 당연하다)", "would rather (~하겠다)", "had better (~하는 것이 낫다)"],
    answer: 0,
    explanation: "may as well은 '딱히 다른 선택지가 없으니 ~하는 편이 좋다'는 뉘앙스로 쓰인다."
  },
  {
    id: 135, set: 6,
    sentence: "It ___ rain today. The clouds are very dark.",
    question: "빈칸에 알맞은 표현과 의미는?",
    choices: ["may well (~할 가능성이 충분하다, 당연하다)", "may as well (~하는 편이 좋다)", "had better (~하는 것이 낫다)", "would rather (~하겠다)"],
    answer: 0,
    explanation: "may well은 '~하는 것도 당연하다 / ~할 가능성이 충분하다'의 의미로 쓰인다."
  },
  {
    id: 136, set: 6,
    sentence: "다음 중 부정형이 잘못 연결된 것은?",
    question: "",
    choices: ["would like → would not like (X, wouldn't like가 맞음)", "would rather → would rather not (O)", "had better → had better not (O)", "may as well → may as well not (O)"],
    answer: 0,
    explanation: "would like의 부정형은 wouldn't like이다. 'would not like'도 가능하나 축약형 wouldn't like가 일반적이다. 나머지는 모두 올바른 부정형이다."
  },
  {
    id: 137, set: 6,
    sentence: "A: Would you like to join us for dinner? B: I ___ stay home tonight, if you don't mind.",
    question: "B의 빈칸에 가장 알맞은 표현은?",
    choices: ["would rather (~하겠다, 차라리)", "would like to (~하고 싶다)", "had better (~하는 것이 낫다)", "may as well (~하는 편이 좋다)"],
    answer: 0,
    explanation: "would rather는 상대방의 제안을 정중히 거절하며 다른 것을 선택할 때 쓰기 좋은 표현이다."
  }
];
