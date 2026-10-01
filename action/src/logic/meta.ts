export type UpgradeId = 'face' | 'parry' | 'rum' | 'smile';

export interface Upgrade {
  id: UpgradeId;
  name: string;
  text: string;
  costs: number[];
}

/** 등대지기가 금니를 받고 해 주는 영구 강화 */
export const UPGRADES: Upgrade[] = [
  { id: 'face', name: '두꺼운 얼굴', text: '최대 체면 +10', costs: [4, 8, 14] },
  { id: 'parry', name: '등대지기의 눈', text: '받아치기 판정 +40ms', costs: [6, 12] },
  { id: 'rum', name: '비상용 럼병', text: '출격할 때 럼병 +1', costs: [5, 10] },
  { id: 'smile', name: '출항 기념사진', text: '출격할 때 미소 하나를 고르고 시작', costs: [12] },
];

export interface Meta {
  runs: number;
  wins: number;
  teeth: number;
  upgrades: Record<UpgradeId, number>;
  /** 깡패 선장에게 한 번 지면 공격 예고 표시가 생긴다 */
  bossTells: boolean;
  clues: string[];
  lastDeath: string | null;
  seenIntro: boolean;
}

export function emptyMeta(): Meta {
  return {
    runs: 0,
    wins: 0,
    teeth: 0,
    upgrades: { face: 0, parry: 0, rum: 0, smile: 0 },
    bossTells: false,
    clues: [],
    lastDeath: null,
    seenIntro: false,
  };
}

const KEY = 'dentphoto-village/action/meta/v1';

export interface Storage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function loadMeta(storage: Storage | null): Meta {
  try {
    const raw = storage?.getItem(KEY);
    if (!raw) return emptyMeta();
    const parsed = JSON.parse(raw) as Partial<Meta>;
    return { ...emptyMeta(), ...parsed, upgrades: { ...emptyMeta().upgrades, ...(parsed.upgrades ?? {}) } };
  } catch {
    return emptyMeta();
  }
}

export function saveMeta(storage: Storage | null, meta: Meta): void {
  try {
    storage?.setItem(KEY, JSON.stringify(meta));
  } catch {
    // 저장이 막힌 환경에서도 게임은 계속된다
  }
}

export function nextCost(meta: Meta, id: UpgradeId): number | null {
  const up = UPGRADES.find((u) => u.id === id)!;
  const level = meta.upgrades[id];
  return level < up.costs.length ? up.costs[level] : null;
}

export function buyUpgrade(meta: Meta, id: UpgradeId): boolean {
  const cost = nextCost(meta, id);
  if (cost === null || meta.teeth < cost) return false;
  meta.teeth -= cost;
  meta.upgrades[id] += 1;
  return true;
}

export function metaBonus(meta: Meta) {
  return {
    extraFace: meta.upgrades.face * 10,
    parryBonusMs: meta.upgrades.parry * 40,
    startRum: meta.upgrades.rum,
    startSmile: meta.upgrades.smile > 0,
  };
}

export const CLUE_CAPTAIN = { id: 'c-captain', title: '깡패 선장의 고백', text: '선장도 사진을 찍힌 뒤로 웃지 못하게 되었다. 그래서 남을 비웃는 것으로 버텨 왔다.' };

/** 술집 주인이 아울러를 되살린 뒤 하는 말 */
export function barkeepLine(meta: Meta): string {
  if (meta.runs === 0) return '"정신 차렸나? 사진사 놈 플래시에 찍히면 사진 속에 갇혀. 내가 현상액에 담가 꺼내 줄 테니, 겁먹지 말고 다녀와."';
  if (meta.lastDeath === 'captain') return '"깡패 선장한테 당했구먼. 그 양반 말 중간에 칼을 휘두르는 버릇이 있지. 이제 너도 알 거다."';
  if (meta.lastDeath === 'win') return '"선장을 이겼다고? 부두 사람들이 다 웃더라! 절벽 마을은... 다음에 길이 열리면 가 보자고."';
  if (meta.lastDeath === 'bosun') return '"갑판장 앵무새가 너 흉내를 내더라. 다음엔 그 녀석 입부터 막아."';
  const lines = [
    '"또 현상액 신세구먼. 젖은 옷은 저기 걸어 둬."',
    '"도발은 잘 들어. 말이 끝나는 순간이 칼이 오는 순간이야."',
    '"미소를 되찾을수록 이 술집도 시끄러워질 거다. 기대하라고."',
  ];
  return lines[meta.runs % lines.length];
}
