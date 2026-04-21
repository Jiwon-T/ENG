
export interface Chunk {
  text: string;
  translation: string;
  marking?: string; // S, V, O, C, M, 접속사, 관계사, 동격 등
  grammarNote?: string;
  color?: string; // red, blue, green, purple, brown
  underline?: boolean;
  highlight?: boolean;
}

export interface SentenceAnalysis {
  category: string; // e.g., "감사 인사", "공사 안내"
  original: string;
  chunks: Chunk[];
  fullTranslation: string;
  grammarPoints: string[];
  isImportant?: boolean; // 서술형 대비
  isTopicSentence?: boolean; // 주제 문장
  isInsertionPoint?: boolean; // 삽입 문장
}

export type QuestionType = 'vocabulary' | 'title' | 'gist' | 'consistency' | 'ordering' | 'insertion' | 'summary' | 'blank' | 'grammar' | 'irrelevant' | 'claim' | 'topic' | 'workbook';

export interface Question {
  type: QuestionType;
  question: string;
  boxContent?: string; // 주어진 문장 (insertion) 또는 주어진 글 (ordering)
  passage?: string; // 지문 (번호 포함 - insertion용, 밑줄 포함 - grammar용)
  paragraphs?: { A: string; B: string; C: string }; // ordering용 (A, B, C 단락)
  summaryPassage?: string; // 요약문 (A), (B) 포함
  options?: string[];
  answer: string;
  explanation?: string;
}

export interface AnalysisResult {
  title: string;
  englishTitle: string;
  examInfo: string; // e.g., "2026년 3월 모의고사 고2-18"
  summary: string;
  topic: { ko: string; en: string };
  mainIdea: { ko: string; en: string };
  summaryLong: { ko: string; en: string };
  plotPoints: string[]; // 지문 흐름 요약
  logicType: string; // 논리 전개 방식
  purpose: string; // 글의 목적
  keySentence: string; // 핵심 문장 (영어)
  keywords: { en: string; ko: string }[]; // 핵심 키워드
  sentences: SentenceAnalysis[];
  questions?: Question[];
  clozePassage?: string;
  clozeAnswers?: string[];
  originalText?: string;
}
export async function analyzeEnglishText(
  text: string, 
  generateQuestions: boolean, 
  selectedTypes: QuestionType[] = [],
  questionsOnly: boolean = false
): Promise<AnalysisResult> {
  const { GoogleGenAI, Type } = await import("@google/genai");
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
  
  const prompt = `Analyze the following English text for a Korean high school student.
    
    ${!questionsOnly ? `
    For EACH sentence, provide:
    1. category: A very short Korean label (2-5 words) describing the purpose of this sentence (e.g., "감사 인사", "공사 안내").
    2. chunks: Break the sentence into meaningful chunks. For each chunk:
       - text: The English words.
         - CRITICAL: Treat functional phrases (Gerund phrases, Infinitive phrases, Prepositional phrases, Noun phrases) as a single chunk if they function as a single unit.
       - marking: ONLY the syntactic label (e.g., "S", "V", "O", "C", "M", "접속사", "관계사", "동격", "계속적용법"). 
         - CRITICAL: MAX 1-2 words. 
         - CRITICAL: For internal components of a clause OR a long phrase, use prime notation (s', v', o', c', m').
       - translation: Direct chunk translation (직독직해).
       - grammarNote: ONLY the grammar keyword (e.g., "분사구문", "to부정사"). 
       - color: Suggest a color based on the chunk's FUNCTION (blue: S, red: V, purple: O/C, green: Conjunctions, brown: M).
       - underline: true if the chunk is a Verb (V, v') or part of a parallel structure.
       - highlight: true if the chunk is an antecedent (선행사).
    3. fullTranslation: A natural Korean translation.
    4. grammarPoints: 2-3 key exam-relevant grammatical points.
    5. isImportant: true if the sentence is a prime candidate for a "Descriptive" question.
    6. isTopicSentence: true if it's the main theme sentence.
    7. isInsertionPoint: true if this sentence is the BEST candidate for a "Sentence Insertion" question.
    ` : `
    For EACH sentence, provide ONLY:
    1. category: A short label.
    2. original: The original sentence.
    3. fullTranslation: A natural Korean translation.
    (Leave chunks as an empty array, and other boolean flags as false).
    `}

    Overall Analysis:
    1. title: Korean title.
    2. englishTitle: English title.
    3. examInfo: e.g., "2026년 3월 모의고사 고2-18".
    4. topic: A one-sentence topic in Korean and English.
    5. mainIdea: The main idea/gist in Korean and English.
    6. summaryLong: A 2-3 sentence summary in Korean and English.
    7. plotPoints: A numbered list (지문 흐름 요약) of the text's logical flow in Korean.
    8. logicType: The logical structure type (e.g., "통념-반박", "원인-결과", "문제-해결", "비교-대조").
    9. purpose: The author's purpose or the text's intent in Korean (e.g., "정보 전달", "설득", "교훈 전달").
    10. keySentence: The most representative English sentence from the text.
    11. keywords: 5-7 key English terms from the text with their Korean meanings.

    ${generateQuestions ? `Also, generate EXACTLY one question for EACH of the following selected types: [${selectedTypes.join(', ')}]. Do NOT generate any types not listed here.
    
    For each question type, follow these STRICT rules for field usage:
    - title: '제목 추론' (Question in Korean, 5 English options in 'options' field. Use 1-5 numbering. No boxContent.)
    - gist: '요지 파악' (Question in Korean, 5 Korean options in 'options' field. Use 1-5 numbering. No boxContent.)
    - topic: '주제 파악' (Question in Korean, 5 English options in 'options' field. Use 1-5 numbering. No boxContent.)
    - claim: '필자의 주장' (Question in Korean, 5 Korean options in 'options' field. Use 1-5 numbering. No boxContent.)
    - consistency: '내용 일치/불일치' (Question in Korean, 5 Korean options in 'options' field. Use 1-5 numbering. BoxContent is optional.)
    - ordering: '순서 배열' (CRITICAL: You MUST use the ENTIRE original text. Place the introductory part in 'boxContent'. Divide the ENTIRE remaining text into (A), (B), (C) in 'paragraphs' object. No part of the text should be omitted. Options like "① (A)-(C)-(B)" in 'options' field.)
    - insertion: '문장 삽입' (The sentence to insert in 'boxContent'. Full passage with markers ( ① ) to ( ⑤ ) in 'passage' field. Options 1-5 in 'options' field.)
    - summary: '요약문 완성' (A concise one-sentence summary with (A) and (B) blanks in 'summaryPassage'. Provide 5 options for word pairs in 'options' field. Use boxContent for the original passage. CRITICAL: NEVER include the instruction text or examples inside 'summaryPassage'.)
    - blank: '빈칸 추론' (CRITICAL: You MUST place the ENTIRE original text in 'boxContent', replacing the key part with "________". Provide 5 English options in 'options' field.)
    - irrelevant: '무관한 문장 찾기' (Full passage with numbered sentences ① to ⑤ in 'passage' field. Options 1-5 in 'options' field.)
    - grammar: '어법 수정' (CRITICAL: Use the FULL original text in 'boxContent'. Provide 5 specific parts wrapped in <u>...</u> tags, but place the number markers ( ① ) IMMEDIATELY BEFORE the <u> tag, e.g., "① <u>is</u>". EXACTLY one of these MUST contain a clear grammatical error. The 'answer' field MUST match the number of the erroneous part. Options in 'options' field should be just "①", "②", etc.)
    - workbook: '빈칸 워크북' (CRITICAL: Provide the FULL original text in 'boxContent' with at least 10 blanks marked as ⓐ, ⓑ, ⓒ... ⓙ. Blanks MUST target important vocabulary or key grammar points (one word only). Provide the correct answers in 'clozeAnswers'.)
    
    CRITICAL RULES:
    1. ONLY use the 'paragraphs' field for 'ordering' type. For all other types, it MUST be null or empty.
    2. ONLY use the 'summaryPassage' field for 'summary' type. For all other types, it MUST be null or empty.
    3. ALL multiple-choice questions MUST use the 'options' field for 1-5 choices. NEVER put options in 'paragraphs' or 'summaryPassage'.
    4. For 'blank', 'ordering', 'grammar', and 'workbook' types, the FULL original text MUST be used.
    5. Generate ONLY the types requested in: [${selectedTypes.join(', ')}].
    6. 'clozePassage' and 'clozeAnswers' should ONLY be generated if 'workbook' is selected.
    7. NEVER generate 'writingWords' (보기) or 'writingCondition' (조건).
    8. NO REPETITION: NEVER repeat the same phrase, instruction, or word multiple times. If you find yourself repeating text, STOP immediately.
    9. SUMMARY PASSAGE: The 'summaryPassage' field MUST contain ONLY the summary sentence with (A) and (B). NEVER include instructions, examples, or options inside this field.
    10. For '대의파악' types (title, gist, topic, claim), do NOT use boxContent or passage. Just provide the question and options.
    11. STABILITY: Ensure the JSON output is stable and does not contain infinite loops or repetitive patterns.

    CRITICAL for Explanations: For ALL questions, provide a detailed, logical explanation (해설) in Korean. Explain WHY the correct answer is logically valid based on the text's context, flow, and keywords. Do not just repeat the answer.` : 'CRITICAL: Do NOT generate any questions or clozePassage.'}

    Return the result as a JSON object matching the AnalysisResult interface.

    Text: ${text}`;

  const result = await ai.models.generateContent({
    model: "gemini-2.0-flash",
    config: {
      responseMimeType: "application/json",
      maxOutputTokens: 8192,
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          englishTitle: { type: Type.STRING },
          examInfo: { type: Type.STRING },
          topic: {
            type: Type.OBJECT,
            properties: { ko: { type: Type.STRING }, en: { type: Type.STRING } },
            required: ["ko", "en"]
          },
          mainIdea: {
            type: Type.OBJECT,
            properties: { ko: { type: Type.STRING }, en: { type: Type.STRING } },
            required: ["ko", "en"]
          },
          summaryLong: {
            type: Type.OBJECT,
            properties: { ko: { type: Type.STRING }, en: { type: Type.STRING } },
            required: ["ko", "en"]
          },
          plotPoints: { type: Type.ARRAY, items: { type: Type.STRING } },
          logicType: { type: Type.STRING },
          purpose: { type: Type.STRING },
          keySentence: { type: Type.STRING },
          keywords: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: { en: { type: Type.STRING }, ko: { type: Type.STRING } },
              required: ["en", "ko"]
            }
          },
          sentences: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                category: { type: Type.STRING },
                original: { type: Type.STRING },
                chunks: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      text: { type: Type.STRING },
                      translation: { type: Type.STRING },
                      marking: { type: Type.STRING },
                      grammarNote: { type: Type.STRING },
                      color: { type: Type.STRING },
                      underline: { type: Type.BOOLEAN },
                      highlight: { type: Type.BOOLEAN }
                    },
                    required: ["text", "translation", "color", "marking", "grammarNote"]
                  }
                },
                fullTranslation: { type: Type.STRING },
                grammarPoints: { type: Type.ARRAY, items: { type: Type.STRING } },
                isImportant: { type: Type.BOOLEAN },
                isTopicSentence: { type: Type.BOOLEAN },
                isInsertionPoint: { type: Type.BOOLEAN }
              },
              required: ["category", "original", "chunks", "fullTranslation"]
            }
          },
          summary: { type: Type.STRING },
          clozePassage: { type: Type.STRING },
          clozeAnswers: { type: Type.ARRAY, items: { type: Type.STRING } },
          questions: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                type: { type: Type.STRING, enum: ["vocabulary", "title", "gist", "consistency", "ordering", "insertion", "summary", "blank", "grammar", "irrelevant", "claim", "topic", "workbook"] },
                question: { type: Type.STRING },
                boxContent: { type: Type.STRING },
                passage: { type: Type.STRING },
                paragraphs: {
                  type: Type.OBJECT,
                  properties: {
                    A: { type: Type.STRING },
                    B: { type: Type.STRING },
                    C: { type: Type.STRING },
                  }
                },
                summaryPassage: { type: Type.STRING },
                options: { type: Type.ARRAY, items: { type: Type.STRING } },
                answer: { type: Type.STRING },
                explanation: { type: Type.STRING }
              },
              required: ["type", "question", "answer"]
            }
          }
        },
        required: ["title", "englishTitle", "examInfo", "topic", "mainIdea", "summaryLong", "plotPoints", "logicType", "purpose", "keySentence", "keywords", "sentences", "summary"]
      }
    },
    contents: [{ role: "user", parts: [{ text: prompt }] }],
  });

  const responseText = result.text || "";
  
  try {
    // Clean potential markdown formatting if the model ignored responseMimeType
    const cleanedText = responseText.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim();
    const parsed = JSON.parse(cleanedText) as AnalysisResult;
    parsed.originalText = text;
    return parsed;
  } catch (e) {
    console.error("Failed to parse Gemini response:", responseText);
    throw new Error("AI 응답을 분석하는 중 오류가 발생했습니다. 지문이 너무 길거나 복잡할 수 있습니다.");
  }
}
