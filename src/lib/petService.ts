import { Timestamp, doc, updateDoc } from 'firebase/firestore';
import { GoogleGenAI, Type } from "@google/genai";
import { db } from './firebase';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const modelName = 'gemini-3-flash-preview';

export type PetCharacterType = 'kuromi' | 'mymelody' | 'cinnamoroll' | 'molang' | 'mang_bear';
export type PetStage = 'baby' | 'child' | 'teen' | 'adult' | 'master';

export interface LearnedPhrase {
  original: string;
  remembered: string;
  learnedAtLevel: number;
  evolvedVersions: { [level: string]: string };
}

export interface PetData {
  slot: number;
  character: PetCharacterType;
  name: string;
  level: number;
  xp: number;
  energy: number;
  maxEnergy: number;
  lastEnergyItemTime?: number;
  lastFed?: number;
  lastPetted?: number;
  learnedPhrases: LearnedPhrase[];
}

export interface PetSystemState {
  currentPetSlot: number;
  points: number;
  inventory: string[];
  outfit: string | null;
  background: string;
  unlockedSlots: number;
  pets: PetData[];
}

const INITIAL_STATE: PetSystemState = {
  currentPetSlot: 1,
  points: 0,
  inventory: [],
  outfit: null,
  background: 'default',
  unlockedSlots: 1,
  pets: [
    {
      slot: 1,
      character: 'molang', // Logic will handle first-time selection
      name: '친구가 필요해요',
      level: 1,
      xp: 0,
      energy: 100,
      maxEnergy: 100,
      learnedPhrases: []
    }
  ]
};

const STORAGE_KEY = 'pet_system_data';

export const PetService = {
  getStage(level: number): PetStage {
    if (level <= 20) return 'baby';
    if (level <= 40) return 'child';
    if (level <= 60) return 'teen';
    if (level <= 99) return 'adult';
    return 'master';
  },

  getXpNeeded(level: number): number {
    return level * 100;
  },

  getState(uid?: string): PetSystemState {
    const key = uid ? `${STORAGE_KEY}_${uid}` : STORAGE_KEY;
    const saved = localStorage.getItem(key);
    if (!saved) return INITIAL_STATE;
    try {
      const parsed = JSON.parse(saved);
      // Migration or validation
      if (!parsed.pets || parsed.pets.length === 0) return INITIAL_STATE;
      
      // Ensure energy exists (migration)
      parsed.pets.forEach((p: any) => {
        if (p.energy === undefined) p.energy = 100;
        if (p.maxEnergy === undefined) p.maxEnergy = 100;
        if (p.learnedPhrases === undefined) p.learnedPhrases = [];
      });
      
      return parsed;
    } catch (e) {
      return INITIAL_STATE;
    }
  },

  saveState(state: PetSystemState, uid?: string) {
    const key = uid ? `${STORAGE_KEY}_${uid}` : STORAGE_KEY;
    localStorage.setItem(key, JSON.stringify(state));

    // Sync summary to Firestore for Teacher to see
    if (uid) {
      const pet = state.pets.find(p => p.slot === state.currentPetSlot);
      if (pet) {
        updateDoc(doc(db, 'users', uid), {
          petStats: {
            points: state.points,
            totalXP: pet.xp, // Simplified for now
            highestLevel: pet.level,
            petName: pet.name,
            character: pet.character
          }
        }).catch(e => console.error('Firestore sync failed:', e));
      }
    }
  },

  addXP(amount: number, uid: string): { leveledUp: boolean; newState: PetSystemState } {
    const state = this.getState(uid);
    const pet = state.pets.find(p => p.slot === state.currentPetSlot);
    if (!pet) return { leveledUp: false, newState: state };

    pet.xp += amount;
    let leveledUp = false;

    while (pet.xp >= this.getXpNeeded(pet.level) && pet.level < 100) {
      pet.xp -= this.getXpNeeded(pet.level);
      pet.level += 1;
      leveledUp = true;
      
      // If leveled up to 100, unlock next slot if not already
      if (pet.level === 100 && state.unlockedSlots < 3) {
        state.unlockedSlots += 1;
      }
    }

    this.saveState(state, uid);
    
    // Check for major level up evolution
    if (leveledUp && pet.level % 10 === 0) {
       // We can't easily wait for AI in this function because it's sync usually
       // We should handle a "pending evolution" or just trigger it async
       this.evolveAllPhrases(uid).catch(console.error);
    }

    return { leveledUp, newState: state };
  },

  async evolveAllPhrases(uid: string): Promise<{ newState: PetSystemState; evolvedCount: number }> {
    const state = this.getState(uid);
    const pet = state.pets.find(p => p.slot === state.currentPetSlot);
    if (!pet || pet.learnedPhrases.length === 0) return { newState: state, evolvedCount: 0 };

    let count = 0;
    for (const phrase of pet.learnedPhrases) {
      const levelKey = Math.floor(pet.level / 10) * 10;
      if (!phrase.evolvedVersions[levelKey]) {
        try {
          const evolved = await this.generateEvolvedVersion(phrase.remembered, pet.level);
          phrase.evolvedVersions[levelKey] = evolved;
          count++;
        } catch (e) {
          console.error('Evolution failed for phrase:', phrase.original, e);
        }
      }
    }

    if (count > 0) {
      this.saveState(state, uid);
    }
    return { newState: state, evolvedCount: count };
  },

  async generateEvolvedVersion(remembered: string, level: number): Promise<string> {
    const response = await ai.models.generateContent({
      model: modelName,
      contents: `너는 레벨 ${level}인 펫이야.\n예전에 배운 말 "${remembered}"을 현재 지능 수준에 맞게 자연스럽게 말해줘.\n배경 상황 없이 혼자 중얼거리는 느낌으로.\n1문장, JSON으로만: {"monologue": "변형된 혼잣말"}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            monologue: { type: Type.STRING }
          },
          required: ["monologue"]
        }
      }
    });
    
    const data = JSON.parse(response.text);
    return data.monologue;
  },

  addPoints(amount: number, uid: string): PetSystemState {
    const state = this.getState(uid);
    state.points += amount;
    this.saveState(state, uid);
    return state;
  },

  addEnergy(amount: number, uid: string): PetSystemState {
    const state = this.getState(uid);
    const pet = state.pets.find(p => p.slot === state.currentPetSlot);
    if (pet) {
      pet.energy = Math.min(pet.maxEnergy, pet.energy + amount);
    }
    this.saveState(state, uid);
    return state;
  },

  purchaseItem(id: string, price: number, category: 'outfit' | 'background' | 'consumable', uid: string): { success: boolean; newState: PetSystemState; message: string } {
    const state = this.getState(uid);
    if (state.points < price) {
      return { success: false, newState: state, message: '포인트가 부족해요!' };
    }

    state.points -= price;
    const pet = state.pets.find(p => p.slot === state.currentPetSlot);
    if (!pet) return { success: false, newState: state, message: '펫을 찾을 수 없습니다.' };

    if (category === 'consumable') {
       // Consumables represent snacks that give XP immediately
       // In a simple system, we just add the XP
       let xpGain = 0;
       let energyGain = 0;
       
       if (id === 'cookie') xpGain = 5;
       if (id === 'cake') xpGain = 15;
       if (id === 'candy') xpGain = 30;
       
       // Energy items
       if (id === 'coffee' || id === 'energy_drink') {
         const lastTime = pet.lastEnergyItemTime;
         if (lastTime) {
           const lastDate = new Date(lastTime);
           const today = new Date();
           if (lastDate.getFullYear() === today.getFullYear() &&
               lastDate.getMonth() === today.getMonth() &&
               lastDate.getDate() === today.getDate()) {
              // Rollback points if limit reached
              state.points += price;
              return { success: false, newState: state, message: '에너지 음료는 하루에 한 번만 마실 수 있어요!' };
           }
         }
         
         if (id === 'coffee') energyGain = 30;
         if (id === 'energy_drink') energyGain = 60;
         pet.lastEnergyItemTime = Date.now();
       }
       
       if (xpGain > 0) {
         pet.xp += xpGain;
         // Handle level up logic inside xp gain block if needed or call addXP
         // But addXP re-gets state, so it's better to refactor or manually handle here
         this.saveState(state, uid);
         const xpResult = this.addXP(0, uid); // This will trigger level checks safely
         return { success: true, newState: xpResult.newState, message: '맛있게 먹었어요! XP 획득!' };
       }
       
       if (energyGain > 0) {
         pet.energy = Math.min(pet.maxEnergy, pet.energy + energyGain);
         this.saveState(state, uid);
         return { success: true, newState: state, message: '기운이 나요! 체력 회복!' };
       }
    }

    if (!state.inventory.includes(id)) {
      state.inventory.push(id);
    }
    
    this.saveState(state, uid);
    return { success: true, newState: state, message: '구매 완료!' };
  },

  applyItem(id: string, category: 'outfit' | 'background', uid: string): PetSystemState {
    const state = this.getState(uid);
    if (category === 'outfit') state.outfit = id;
    if (category === 'background') state.background = id;
    this.saveState(state, uid);
    return state;
  },

  renamePet(newName: string, uid: string): PetSystemState {
    const state = this.getState(uid);
    const pet = state.pets.find(p => p.slot === state.currentPetSlot);
    if (pet) {
      pet.name = newName;
    }
    this.saveState(state, uid);
    return state;
  },

  petPet(uid: string): { success: boolean; xpGain: number; newState: PetSystemState; message?: string } {
    const state = this.getState(uid);
    const pet = state.pets.find(p => p.slot === state.currentPetSlot);
    
    if (!pet) return { success: false, xpGain: 0, newState: state };
    
    if (pet.energy < 5) {
      return { success: false, xpGain: 0, newState: state, message: '펫이 너무 지쳤어요!' };
    }

    pet.energy -= 5;
    this.saveState(state, uid);
    const { newState } = this.addXP(3, uid);
    return { success: true, xpGain: 3, newState };
  },

  teachWord(success: boolean): { success: boolean; xpGain: number; newState: PetSystemState; message?: string } {
    // This is the old sync stub. The new one will be async handleTeachWord
    return { success: false, xpGain: 0, newState: this.getState() };
  },

  async handleTeachWord(text: string, uid: string): Promise<{ success: boolean; reaction: string; remembered: string; newState: PetSystemState; message?: string }> {
    const state = this.getState(uid);
    const pet = state.pets.find(p => p.slot === state.currentPetSlot);
    
    if (!pet) return { success: false, reaction: '', remembered: '', newState: state };
    
    if (pet.energy < 20) {
      return { success: false, reaction: '', remembered: '', newState: state, message: '펫이 너무 지쳤어요. 체력을 회복시켜주세요!' };
    }

    try {
      const response = await ai.models.generateContent({
        model: modelName,
        contents: `사용자가 가르칠 문장: "${text}"`,
        config: {
          systemInstruction: `너는 귀여운 펫 캐릭터야. 사용자가 너에게 문장을 가르쳐줄 거야.\n너의 현재 지능 레벨은 ${pet.level}이야. (최대 100)\n\n레벨에 따라 아래 기준으로 반응해줘:\n\nLv 1~10 (아기):\n- 옹알이 수준. 가르쳐준 말의 첫 글자나 받침만 따라함\n- 예) "공부 열심히 해!" → "꽁... 냐~"\n- 이모티콘 많이 사용\n\nLv 11~30 (어린이):\n- 핵심 단어 1~2개만 따라함. 나머지는 틀리게 말함\n- 예) "공부 열심히 해!" → "공부... 열씨미? 🐣"\n\nLv 31~50 (청소년):\n- 문장을 어느 정도 따라하되 유아적 표현 섞음\n- 예) "공부 열심히 해!" → "공부 열심히 할게! 근데 간식 먼저! 🍪"\n\nLv 51~80 (어른):\n- 문장을 정확히 따라하고 자기 감상도 덧붙임\n- 예) "공부 열심히 해!" → "공부 열심히 할게! 너도 같이 해야 해~ 😤"\n\nLv 81~99 (고급):\n- 문장을 따라하고 영어도 섞어서 더 풍부하게 표현\n- 예) "공부 열심히 해!" → "공부 열심히 할게! Let's study together! 나 요즘 많이 똑똑해졌지? ✨"\n\nLv 100 (만렙):\n- 완벽하게 이해하고 깊은 답변. 철학적이거나 감동적인 말도 가능\n- 예) "공부 열심히 해!" → "알아. 근데 있잖아, 열심히 하는 것보다 꾸준히 하는 게 더 중요하더라. I learned that from you 💕"\n\n반드시 지켜야 할 것:\n- 2~3문장 이내로 짧게\n- 캐릭터 이름(${pet.name})을 가끔 언급\n- 답변 끝에 현재 레벨에 맞는 이모티콘 1~2개 포함\n- JSON으로만 응답:\n  {"response": "펫의 반응 문장", "remembered": "기억할 핵심 표현 (5단어 이내)"}`,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              response: { type: Type.STRING },
              remembered: { type: Type.STRING }
            },
            required: ["response", "remembered"]
          }
        }
      });

      const data = JSON.parse(response.text);
      
      pet.energy -= 20;
      const levelKey = Math.floor(pet.level / 10) * 10;
      
      const newPhrase: LearnedPhrase = {
        original: text,
        remembered: data.remembered,
        learnedAtLevel: pet.level,
        evolvedVersions: {
          [levelKey]: data.response
        }
      };
      
      pet.learnedPhrases.push(newPhrase);
      this.saveState(state, uid);
      
      const { newState } = this.addXP(20, uid);
      return { 
        success: true, 
        reaction: data.response, 
        remembered: data.remembered, 
        newState 
      };
    } catch (e) {
      console.error('Teach word failed:', e);
      return { success: false, reaction: '', remembered: '', newState: state, message: '교육 중 오류가 발생했어요.' };
    }
  }
};
