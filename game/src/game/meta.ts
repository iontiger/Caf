import type { Meta } from './types';

export interface Rumor {
  id: string;
  /** 술집 주인이 들려주는 소문 */
  text: string;
  /** 해금되는 카드 */
  card: string;
}

/** 판이 끝날 때마다 순서대로 하나씩 해금된다 */
export const RUMORS: Rumor[] = [
  { id: 'r-yours', card: 'yours', text: '"부두 놈들 말싸움은 결국 다 자기 얘기야. 그대로 돌려줘 봐."' },
  { id: 'r-crowd', card: 'crowd', text: '"관중을 네 편으로 만들면 반은 이긴 거라네."' },
  { id: 'r-light', card: 'lighthouse', text: '"등대지기 영감이 그러는데, 불빛 앞에선 누구나 속셈이 드러난대."' },
  { id: 'r-tooth', card: 'goldTooth', text: '"금니 선장 얘기 들어 봤나? 그 금니를 지니면 기세가 오른다더군."' },
  { id: 'r-rum', card: 'secretRum', text: '"자, 우리 집 비법 럼이다. 쓰러질 것 같을 때 마셔."' },
];

const KEY = 'dentphoto-village/meta/v1';

export function emptyMeta(): Meta {
  return { runs: 0, wins: 0, rumors: [], clues: [], revealedBosses: [], bestFloor: 0 };
}

export interface Storage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function loadMeta(storage: Storage | null): Meta {
  try {
    const raw = storage?.getItem(KEY);
    if (!raw) return emptyMeta();
    return { ...emptyMeta(), ...(JSON.parse(raw) as Partial<Meta>) };
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

export interface RunSummary {
  won: boolean;
  floor: number;
  clues: string[];
  /** 보스에게 졌는지 */
  lostToBoss: string | null;
}

export interface MetaGain {
  rumor: Rumor | null;
  newClues: string[];
  bossRevealed: string | null;
}

/** 판이 끝나면 소문 하나를 해금하고 단서를 수첩에 옮긴다 */
export function applyRunEnd(meta: Meta, summary: RunSummary): MetaGain {
  meta.runs += 1;
  if (summary.won) meta.wins += 1;
  meta.bestFloor = Math.max(meta.bestFloor, summary.floor);

  const rumor = RUMORS.find((r) => !meta.rumors.includes(r.id)) ?? null;
  if (rumor) meta.rumors.push(rumor.id);

  const newClues = summary.clues.filter((c) => !meta.clues.includes(c));
  meta.clues.push(...newClues);

  let bossRevealed: string | null = null;
  if (summary.lostToBoss && !meta.revealedBosses.includes(summary.lostToBoss)) {
    meta.revealedBosses.push(summary.lostToBoss);
    bossRevealed = summary.lostToBoss;
  }
  return { rumor, newClues, bossRevealed };
}
