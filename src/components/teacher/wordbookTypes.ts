// Shapes shared by the 학습 세트 screens.
/** The tabs of 학습 세트 (and the student home): 단어장, 문법 세트, 시험기간, 문장 세트. */
export type SetCategory = 'word' | 'grammar' | 'exam' | 'sentence';
export interface Wordbook {
  id: string;
  title: string;
  description: string;
  createdBy: string;
  createdAt: any;
  order?: number;
  type?: 'standard' | 'irregular' | 'to-ing-grammar' | 'complement-grammar' | 'conversion-grammar' | 'relative-grammar' | 'modal-grammar' | 'basic-modal-grammar' | 'verb-form-grammar' | 'grammar-cramming' | 'comparative-grammar' | 'sentence-order' | 'sentence';
  category?: SetCategory;
  customDistractors?: string[];
  defaultUnitSize?: number;
}

export interface Word {
  id: string;
  word: string;
  meaning: string;
  day?: number;
  past?: string;
  pastParticiple?: string;
  comparative?: string;
  superlative?: string;
  pattern?: string;
  distractors?: string[];
  example?: string;
  imageUrl?: string;
  order?: number;
  passageTitle?: string;
  /** 문장 세트: the sentence as registered, with its / marks (끊어 읽기); `word` is shown without them. */
  chunked?: string;
}
