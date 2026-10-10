// Shapes shared by the 학습 세트 screens.
export interface Wordbook {
  id: string;
  title: string;
  description: string;
  createdBy: string;
  createdAt: any;
  order?: number;
  type?: 'standard' | 'irregular' | 'to-ing-grammar' | 'complement-grammar' | 'conversion-grammar' | 'relative-grammar' | 'modal-grammar' | 'basic-modal-grammar' | 'verb-form-grammar' | 'grammar-cramming' | 'comparative-grammar' | 'sentence-order';
  category?: 'word' | 'grammar' | 'exam';
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
}
