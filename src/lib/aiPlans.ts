// AI 이용 한도와 패스 (one list for the server, which counts, and the screens, which explain). Passes are paid at the
// academy (no payment in the app); the admin turns a pass on for a person until a date in 관리자 설정 › AI 사용량.
export type AiPlan = 'free' | 'pet' | 'premium';
export interface AiPlanInfo { label: string; price: number; petTalkPerPet: number | null; petTalk: number | null; analyzer: number; workbook: number; /** 변형 문제 만들기 a month */ generator: number;
  /** 펫 혼잣말 (automatic) a day */ petMonologue: number; /** 펫 영어 회화 모드 can be turned on */ englishTalk: boolean }
export const AI_PLANS: Record<AiPlan, AiPlanInfo> = {
  /** 펫 대화·말 가르치기 150 a month for each pet (= 5 a day), 지문 분석 10, 워크북 AI 해석 50. */
  free: { label: '기본', price: 0, petTalkPerPet: 150, petTalk: null, analyzer: 10, workbook: 50, generator: 10, petMonologue: 10, englishTalk: false },
  /** 펫 패스: 600 talks a month shared by all pets, 혼잣말 30 a day, 영어 회화 모드, 지문 분석 20, 변형 문제 30. */
  pet: { label: '펫 패스', price: 2900, petTalkPerPet: null, petTalk: 600, analyzer: 20, workbook: 50, generator: 30, petMonologue: 30, englishTalk: true },
  /** 프리미엄 패스: the 펫 패스 plus 지문 분석 80, 워크북 AI 해석 300 and 변형 문제 60 a month. */
  premium: { label: '프리미엄 패스', price: 4900, petTalkPerPet: null, petTalk: 600, analyzer: 80, workbook: 300, generator: 60, petMonologue: 30, englishTalk: true },
};
/** Talks a day at most on any plan (so a month isn't used up in one day); pet 혼잣말 (automatic) a day. */
export const PET_TALK_DAILY_GUARD = 50;
export interface AiPass { plan: AiPlan; until: string }
/** The plan in force today ('YYYY-MM-DD', Korea time): a pass counts through its last day. */
export const activePlan = (pass: Partial<AiPass> | null | undefined, today: string): AiPlan =>
  pass && (pass.plan === 'pet' || pass.plan === 'premium') && typeof pass.until === 'string' && pass.until >= today ? pass.plan : 'free';
const won = (n: number) => n.toLocaleString('ko-KR');
/** The line shown when a free limit runs out. */
export const PASS_NOTE = {
  pet: `펫 패스(월 ${won(AI_PLANS.pet.price)}원)면 모든 펫과 한 달 ${AI_PLANS.pet.petTalk}번 이야기하고, 영어 회화 모드와 혼잣말 하루 ${AI_PLANS.pet.petMonologue}번, 지문 분석 ${AI_PLANS.pet.analyzer}번, 변형 문제 ${AI_PLANS.pet.generator}번을 쓸 수 있어요. 학원에 문의해 주세요.`,
  englishTalk: `영어 회화 모드는 펫 패스(월 ${won(AI_PLANS.pet.price)}원)나 프리미엄 패스로 쓸 수 있어요. 펫이 영어로만 대화하고 틀린 표현을 부드럽게 고쳐 줘요. 학원에 문의해 주세요.`,
  premium: `프리미엄 패스(월 ${won(AI_PLANS.premium.price)}원, 펫 패스 포함)면 지문 분석 월 ${AI_PLANS.premium.analyzer}번, 워크북 AI 해석 월 ${AI_PLANS.premium.workbook}번, 변형 문제 만들기 월 ${AI_PLANS.premium.generator}번까지 쓸 수 있어요. 학원에 문의해 주세요.`,
};
