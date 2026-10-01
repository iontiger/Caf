import type { EnemyDef } from './types';

export const ENEMIES: EnemyDef[] = [
  {
    id: 'drunk',
    name: '술 취한 선원',
    portrait: '🍺',
    maxFace: 28,
    rank: 'normal',
    defeatLine: '딸꾹... 오늘은 이만 봐준다...',
    intents: [
      { kind: 'taunt', tag: '외모', damage: 8, line: '머리는 갈매기 둥지냐?' },
      { kind: 'taunt', tag: '용기', damage: 9, line: '너 같은 겁쟁이는 처음 봐!' },
      { kind: 'bluff', block: 5, line: '딸꾹, 나 안 취했어.' },
    ],
  },
  {
    id: 'fishwife',
    name: '생선 장수',
    portrait: '🐟',
    maxFace: 32,
    rank: 'normal',
    defeatLine: '흥, 오늘 생선은 반값이다!',
    intents: [
      { kind: 'taunt', tag: '가문', damage: 9, line: '너희 집안은 대대로 미끼였지?' },
      { kind: 'pump', amount: 2, line: '칼 대신 다랑어를 꺼낸다.' },
      { kind: 'taunt', tag: '외모', damage: 10, line: '얼굴이 내 생선보다 비리네!' },
    ],
  },
  {
    id: 'cabin',
    name: '견습 해적 꼬마',
    portrait: '🏴‍☠️',
    maxFace: 26,
    rank: 'normal',
    defeatLine: '흐앙, 형 나중에 해적 시켜 줘!',
    intents: [
      { kind: 'taunt', tag: '실력', damage: 7, line: '나보다 칼을 못 쓰네!' },
      { kind: 'taunt', tag: '실력', damage: 8, line: '그거 칼이야, 숟가락이야?' },
      { kind: 'taunt', tag: '용기', damage: 9, line: '형 혹시 물 무서워해?' },
    ],
  },
  {
    id: 'rigger',
    name: '밧줄꾼 형제',
    portrait: '🪢',
    maxFace: 34,
    rank: 'normal',
    defeatLine: '우리 매듭이 풀리다니!',
    intents: [
      { kind: 'bluff', block: 6, line: '밧줄로 몸을 칭칭 감는다.' },
      { kind: 'taunt', tag: '용기', damage: 11, line: '돛대 꼭대기 올라와 볼래?' },
      { kind: 'taunt', tag: '가문', damage: 9, line: '너희 아빠도 밧줄에 걸려 넘어졌지!' },
    ],
  },
  {
    id: 'bosun',
    name: '외팔이 갑판장',
    portrait: '🦜',
    maxFace: 58,
    rank: 'elite',
    defeatLine: '앵무새야, 우리 오늘은 진 걸로 하자.',
    intents: [
      { kind: 'taunt', tag: '실력', damage: 13, line: '난 한 팔로도 너보다 낫다!' },
      { kind: 'pump', amount: 3, line: '앵무새가 응원가를 부른다.' },
      { kind: 'taunt', tag: '외모', damage: 14, line: '앵무새도 네 얼굴 보고 말을 잃었어!' },
      { kind: 'bluff', block: 8, line: '의수로 칼을 막아낸다.' },
    ],
  },
  {
    id: 'captain',
    name: '부두의 깡패 선장',
    portrait: '☠️',
    maxFace: 85,
    rank: 'boss',
    hiddenTags: true,
    defeatLine: '좋아, 꼬마... 저택의 사진사가 내 웃음도 가져갔다. 꼭대기로 가라.',
    intents: [
      { kind: 'taunt', tag: '가문', damage: 12, line: '네 조상은 내 배 밑창 닦던 놈이었지!' },
      { kind: 'taunt', tag: '용기', damage: 14, line: '밤바다 보고 오줌 지린 거 다 안다!' },
      { kind: 'bluff', block: 12, line: '외투를 휘날리며 거만하게 웃는다.' },
      { kind: 'taunt', tag: '외모', damage: 15, line: '그 꽁지머리, 생선 꼬리로 착각했다!' },
      { kind: 'pump', amount: 3, line: '부하들이 휘파람으로 응원한다.' },
      { kind: 'taunt', tag: '실력', damage: 18, line: '이 부두에서 내 칼을 이긴 놈은 없다!' },
    ],
  },
];

export function enemyDef(id: string): EnemyDef {
  const def = ENEMIES.find((e) => e.id === id);
  if (!def) throw new Error(`unknown enemy ${id}`);
  return def;
}

export const NORMAL_ENEMIES = ENEMIES.filter((e) => e.rank === 'normal').map((e) => e.id);
export const ELITE_ENEMIES = ENEMIES.filter((e) => e.rank === 'elite').map((e) => e.id);
export const ACT1_BOSS = 'captain';
