export interface Outcome {
  text: string;
  gold?: number;
  face?: number;
  maxFace?: number;
  card?: string;
  clue?: string;
  /** 선택하려면 이만큼 금화가 있어야 한다 */
  cost?: number;
}

export interface Choice {
  label: string;
  outcome: Outcome;
}

export interface GameEvent {
  id: string;
  title: string;
  scene: string;
  text: string;
  choices: Choice[];
}

export interface Clue {
  id: string;
  title: string;
  text: string;
}

export const CLUES: Clue[] = [
  { id: 'c-map', title: '저택 지하 통로', text: '술 취한 지도 장수의 지도에는 절벽 아래에서 저택 지하로 이어지는 통로가 그려져 있다.' },
  { id: 'c-photo', title: '웃지 않는 주민들', text: '바람에 날린 사진 속 주민들은 하나같이 입을 꾹 다물고 있다. 뒷면에는 "미소 보관 37호"라고 적혀 있다.' },
  { id: 'c-assistant', title: '사진사 조수의 실언', text: '"선생님은 100년 전 금니 선장의 웃음을 되찾으려는 것뿐이에요!" 조수는 말하고 나서 입을 막았다.' },
  { id: 'c-captain', title: '깡패 선장의 고백', text: '깡패 선장도 사진을 찍힌 뒤로 웃지 못하게 되었다. 그래서 남을 비웃는 것으로 버텨 왔다고 한다.' },
];

export const EVENTS: GameEvent[] = [
  {
    id: 'gull',
    title: '갈매기와 금화',
    scene: '🐦',
    text: '부두 난간 위에서 갈매기 한 마리가 반짝이는 금화를 물고 아울러를 비웃듯 쳐다본다.',
    choices: [
      { label: '갈매기를 쫓는다', outcome: { text: '한참을 뛰어다닌 끝에 금화를 되찾았다. 대신 바닥에 미끄러져 체면을 구겼다.', gold: 25, face: -4 } },
      { label: '"네 부리, 생각보다 못생겼다."', outcome: { text: '갈매기가 충격을 받고 금화를 떨어뜨렸다. 말발이 통했다.', gold: 12 } },
      { label: '무시하고 지나간다', outcome: { text: '갈매기가 실망한 표정이다. 아무 일도 없었다.' } },
    ],
  },
  {
    id: 'mapseller',
    title: '술 취한 지도 장수',
    scene: '🗺️',
    text: '"이 지도로 말할 것 같으면, 저택으로 가는 비밀 통로가... 딸꾹... 그려진 지도라네. 금화 20닢만 주게."',
    choices: [
      { label: '금화 20닢을 낸다', outcome: { text: '지도 귀퉁이에 절벽 아래 통로가 그려져 있다. 단서를 얻었다.', cost: 20, gold: -20, clue: 'c-map' } },
      { label: '"그 지도, 거꾸로 들었어."', outcome: { text: '지도 장수가 지도를 돌려 보더니 껄껄 웃는다. 이 말솜씨를 기억해 두었다.', card: 'upside' } },
    ],
  },
  {
    id: 'photo',
    title: '바람에 날린 사진',
    scene: '📷',
    text: '골목 바닥에 사진 한 장이 떨어져 있다. 주민들이 줄지어 서 있는데 아무도 웃고 있지 않다.',
    choices: [
      { label: '사진을 주워 살펴본다', outcome: { text: '뒷면에 "미소 보관 37호"라고 적혀 있다. 단서를 얻었다.', clue: 'c-photo' } },
      { label: '사진 속 사람들 흉내를 낸다', outcome: { text: '지나가던 아이가 깔깔 웃는다. 체면이 조금 살았다.', face: 6 } },
    ],
  },
  {
    id: 'monkey',
    title: '바나나와 원숭이',
    scene: '🐒',
    text: '술통 위에 앉은 원숭이가 아울러의 주머니를 뚫어지게 본다. 주머니에는 아침에 산 바나나가 있다.',
    choices: [
      { label: '바나나와 끈을 조합해 미끼를 만든다', outcome: { text: '원숭이가 미끼를 따라오더니 아울러의 어깨에 올라탔다. 원숭이 인형을 얻었다... 아니, 그냥 인형처럼 굳어 버렸다.', card: 'monkey' } },
      { label: '바나나를 그냥 준다', outcome: { text: '원숭이가 답례로 금화 한 닢을 던져 준다.', gold: 15 } },
    ],
  },
  {
    id: 'assistant',
    title: '사진사의 조수',
    scene: '🧑‍🎨',
    text: '삼각대를 멘 청년이 다가온다. "기념사진 한 장 어떠세요? 활짝 웃으시면 금화 40닢을 드려요!"',
    choices: [
      { label: '활짝 웃으며 사진을 찍는다', outcome: { text: '플래시가 번쩍였다. 금화는 받았지만 왠지 입꼬리가 무겁다. 최대 체면이 줄었다.', gold: 40, maxFace: -6 } },
      { label: '"너희 선생님은 왜 웃음을 모으는데?"', outcome: { text: '조수가 당황해 비밀을 흘리고는 달아났다. 단서를 얻었지만 쫓아가다 넘어졌다.', clue: 'c-assistant', face: -5 } },
    ],
  },
];

export function eventById(id: string): GameEvent {
  const e = EVENTS.find((ev) => ev.id === id);
  if (!e) throw new Error(`unknown event ${id}`);
  return e;
}

export function clueById(id: string): Clue | undefined {
  return CLUES.find((c) => c.id === id);
}
