
export interface VerbFormEntry {
  verb: string;
  form1?: string;
  form2?: string;
  form3?: string;
  form4?: string;
  form5?: string;
}

export const VERB_FORM_TABLE_DATA: VerbFormEntry[] = [
  { verb: 'happen', form1: '일어나다' },
  { verb: 'occur', form1: '일어나다' },
  { verb: 'grow', form1: '자라다', form2: 'C하게 되다', form3: 'O를 기르다 / 키우다' },
  { verb: 'seem', form2: 'C하게 보이다' },
  { verb: 'appear', form1: '나타나다', form2: 'C하게 보이다' },
  { verb: 'rise', form1: '오르다' },
  { verb: 'fall', form1: '떨어지다', form2: 'C한 상태가 되다' },
  { verb: 'stay', form1: '머무르다', form2: 'C한 채로 있다' },
  { verb: 'matter', form1: '중요하다' },
  { verb: 'count', form1: '중요하다; (수를) 세다', form3: 'O를 세다', form5: 'O를 C로 간주하다' },
  { verb: 'work', form1: '효과가 있다; 작동되다' },
  { verb: 'pay', form1: '이익이 되다; 지불하다', form3: 'O를 지불하다, (주의 등을) 기울이다', form4: 'IO에게 DO를 지불하다/주다' },
  { verb: 'do', form1: '충분하다, 적절하다, 되어가다(하다)', form3: 'O를 하다', form4: 'IO에게 DO를 베풀다/주다' },
  { verb: 'last', form1: '계속되다; 오래가다, 지속되다', form4: 'IO에게 DO(동안) 버티게 해주다' },
  { verb: 'be', form1: '있다, 존재하다', form2: 'C이다' },
  { verb: 'stand', form1: '(위치해) 있다, 서다', form2: '(계속해서) C인 상태에 있다', form3: 'O를 참다 / 견디다' },
  { verb: 'lie', form1: '(위치해) 있다', form2: '(계속해서) C이다' },
  { verb: 'stay', form1: '계속 있다, 머무르다', form2: '(계속해서) C이다' },
  { verb: 'remain', form2: '(계속해서) C이다' },
  { verb: 'run', form1: '달리다, 작동하다', form2: 'C가 되다', form3: '~을 운영하다, 경영하다', form4: 'IO에게 DO를 해주다', form5: 'O를 C한 상태로 두다' },
  { verb: 'live', form1: '살다' },
  { verb: 'go', form1: '가다', form2: 'C가 되다' },
  { verb: 'come', form1: '오다', form2: 'C가 되다' },
  { verb: 'look', form1: '보다, 바라보다', form2: 'a하게 보이다' },
  { verb: 'sound', form1: '소리가 나다, 울리다', form2: 'a하게 들리다' },
  { verb: 'smell', form2: 'a한 냄새가 나다', form3: 'O의 냄새를 맡다' },
  { verb: 'taste', form2: 'a한 맛이 나다', form3: 'O의 맛을 보다' },
  { verb: 'feel', form2: 'a한 느낌이 나다', form3: 'O를 느끼다, 만져보다', form5: 'O가 C하는 것을 느끼다' },
  { verb: 'turn', form1: '돌리다, 돌다', form2: 'C가 되다 / C 상태로 변하다', form3: 'O를 뒤집다 / 돌리다' },
  { verb: 'discuss', form3: 'O에 대해 토론하다' },
  { verb: 'reach', form1: '(~for) 손을 뻗다', form3: 'O에 도착하다' },
  { verb: 'resemble', form3: 'O와 닮다' },
  { verb: 'enter', form1: '(~into) (사업 등을) 시작하다', form3: 'O에 들어가다' },
  { verb: 'attend', form1: '(~to) 시중들다, 주의하다', form3: 'O에 참석하다' },
  { verb: 'approach', form1: '(때가) 다가오다', form3: 'O에 접근하다' },
  { verb: 'marry', form3: 'O와 결혼하다' },
  { verb: 'mention', form3: 'O에 대해 언급하다' }
];
