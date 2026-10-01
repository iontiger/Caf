import type { EnemyType } from './run';

export interface EnemyStats {
  name: string;
  hp: number;
  speed: number;
  damage: number;
  /** 도발 대사부터 공격이 나가기까지 */
  telegraphMs: number;
  range: number;
  width: number;
  height: number;
  gold: number;
  teeth: number;
  taunts: string[];
}

export const ENEMY_STATS: Record<EnemyType, EnemyStats> = {
  sailor: {
    name: '술 취한 선원', hp: 46, speed: 95, damage: 13, telegraphMs: 650, range: 64, width: 30, height: 46, gold: 6, teeth: 0,
    taunts: ['머리는 갈매기 둥지냐?', '너 같은 겁쟁이는 처음 봐!', '딸꾹, 그 칼 장난감이지?'],
  },
  crab: {
    name: '부두 게', hp: 22, speed: 60, damage: 10, telegraphMs: 450, range: 260, width: 34, height: 20, gold: 3, teeth: 0,
    taunts: ['집게 번쩍!', '옆으로 간다!'],
  },
  thrower: {
    name: '병 던지는 밧줄꾼', hp: 36, speed: 80, damage: 12, telegraphMs: 700, range: 380, width: 30, height: 46, gold: 7, teeth: 0,
    taunts: ['돛대 꼭대기 올라와 볼래?', '너희 아빠도 밧줄에 걸려 넘어졌지!', '받아라, 빈 병이다!'],
  },
  bosun: {
    name: '외팔이 갑판장', hp: 200, speed: 120, damage: 17, telegraphMs: 550, range: 80, width: 44, height: 60, gold: 25, teeth: 3,
    taunts: ['난 한 팔로도 너보다 낫다!', '앵무새도 네 얼굴 보고 말을 잃었어!', '꽥! 꽥! (앵무새가 따라 한다)'],
  },
  captain: {
    name: '부두의 깡패 선장', hp: 680, speed: 150, damage: 19, telegraphMs: 600, range: 96, width: 54, height: 74, gold: 0, teeth: 10,
    taunts: ['네 조상은 내 배 밑창 닦던 놈이었지!', '그 꽁지머리, 생선 꼬리로 착각했다!', '밤바다 보고 오줌 지린 거 다 안다!'],
  },
};

/** 받아치기에 성공하면 아울러가 던지는 대사 */
export const RETORTS = [
  '너도 거울은 본 적 있지?',
  '그 실력이면 갈매기도 안 무서워해.',
  '네 족보는 낚시 그물로 짰냐?',
  '닭이 너 보고 겁쟁이래.',
  '연습은 허수아비랑 했니?',
  '방금 그거, 네 얘기 한 거지?',
];

/** 깡패 선장의 속임수 대사. 말이 끝나기 전에 칼이 나온다 */
export const CAPTAIN_FAKEOUT = '이 부두에서 내 칼을 이긴 놈은... 지금 말하는 중이잖아!';
export const CAPTAIN_DEFEAT = '좋아, 꼬마... 저택의 사진사가 내 웃음도 가져갔다. 꼭대기로 가라.';
