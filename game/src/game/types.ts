export type Tag = '외모' | '용기' | '가문' | '실력';
export const TAGS: Tag[] = ['외모', '용기', '가문', '실력'];

export type CardKind = 'slash' | 'jab' | 'retort' | 'bluff' | 'prop';

export const KIND_LABEL: Record<CardKind, string> = {
  slash: '칼질',
  jab: '독설',
  retort: '응수',
  bluff: '허세',
  prop: '소품',
};

export type Rarity = 'starter' | 'common' | 'rare';

export interface CardDef {
  id: string;
  name: string;
  kind: CardKind;
  cost: number;
  /** 카드에 크게 적히는 대사 */
  line: string;
  rarity: Rarity;
  damage?: number;
  hits?: number;
  block?: number;
  /** 상대 약화: 상대가 주는 피해 25% 감소 */
  weak?: number;
  /** 상대 당황: 상대가 받는 피해 50% 증가 */
  flustered?: number;
  /** 응수 카드의 주제. 'any'는 모든 도발에 맞는다 */
  tag?: Tag | 'any';
  draw?: number;
  /** 상대 도발의 주제를 드러낸다 */
  reveal?: boolean;
  /** 상대의 다음 행동을 취소한다 */
  cancel?: boolean;
  laughter?: number;
  heal?: number;
  momentum?: number;
  /** 한 번 쓰면 이번 전투에서 사라진다 */
  exhaust?: boolean;
  /** 이 소문을 해금해야 카드 풀에 들어온다 */
  rumor?: string;
}

export interface CardInstance {
  uid: number;
  defId: string;
  upgraded: boolean;
}

export type Intent =
  | { kind: 'taunt'; tag: Tag; damage: number; line: string }
  | { kind: 'bluff'; block: number; line: string }
  | { kind: 'pump'; amount: number; line: string };

export interface EnemyDef {
  id: string;
  name: string;
  portrait: string;
  maxFace: number;
  /** 순서대로 반복하는 행동 */
  intents: Intent[];
  rank: 'normal' | 'elite' | 'boss';
  /** 보스는 도발 주제를 숨긴다. 보스에게 지면 메타 진행으로 드러난다 */
  hiddenTags?: boolean;
  defeatLine: string;
}

export type NodeType = 'fight' | 'elite' | 'event' | 'tavern' | 'shop' | 'treasure' | 'boss';

export interface MapNode {
  id: string;
  floor: number;
  index: number;
  type: NodeType;
  next: string[];
}

export interface GameMap {
  floors: MapNode[][];
}

export interface Meta {
  runs: number;
  wins: number;
  rumors: string[];
  clues: string[];
  revealedBosses: string[];
  bestFloor: number;
}

export interface RunState {
  seed: number;
  face: number;
  maxFace: number;
  gold: number;
  deck: CardInstance[];
  map: GameMap;
  /** 마지막으로 방문한 칸. null이면 아직 출발 전 */
  at: string | null;
  visited: string[];
  clues: string[];
  nextUid: number;
}
