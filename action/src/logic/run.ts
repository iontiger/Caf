import type { Giver } from './boons';
import { Rng } from './rng';

export const VIEW_W = 960;
export const VIEW_H = 540;
export const GROUND_Y = 480;

/** 아울러 점프 물리. 지형 검증 테스트도 이 값을 쓴다 */
export const GRAVITY = 1500;
export const JUMP_V = 620;
export const DOUBLE_JUMP_V = 560;

export function jumpHeight(v: number): number {
  return (v * v) / (2 * GRAVITY);
}

export type Theme = 'dock' | 'cave' | 'ship';
export type EnemyType = 'sailor' | 'crab' | 'thrower' | 'bosun' | 'captain';
export type RoomKind = 'combat' | 'elite' | 'shop' | 'boss';
export type Reward = { kind: 'smile'; giver: Giver } | { kind: 'gold' } | { kind: 'heal' } | { kind: 'teeth' };

export interface Platform {
  x: number;
  y: number;
  w: number;
}

export interface Layout {
  id: string;
  theme: Theme;
  width: number;
  platforms: Platform[];
}

export interface Spawn {
  type: EnemyType;
  x: number;
}

export interface RoomPlan {
  index: number;
  kind: RoomKind;
  layout: Layout;
  waves: Spawn[][];
}

const P = (x: number, y: number, w: number): Platform => ({ x, y, w });

export const LAYOUTS: Layout[] = [
  { id: 'dock-a', theme: 'dock', width: 1920, platforms: [P(360, 360, 240), P(900, 360, 200), P(1080, 250, 200), P(1500, 360, 240)] },
  { id: 'dock-b', theme: 'dock', width: 1920, platforms: [P(500, 370, 300), P(800, 260, 180), P(1300, 370, 300)] },
  { id: 'dock-c', theme: 'dock', width: 1920, platforms: [P(240, 360, 180), P(700, 360, 520), P(860, 250, 200), P(1560, 360, 200)] },
  { id: 'cave-a', theme: 'cave', width: 1920, platforms: [P(300, 370, 220), P(620, 260, 200), P(1000, 370, 260), P(1420, 300, 220)] },
  { id: 'cave-b', theme: 'cave', width: 1920, platforms: [P(420, 360, 360), P(1100, 360, 360), P(1220, 250, 140)] },
  { id: 'shop', theme: 'dock', width: 1280, platforms: [] },
  { id: 'deck', theme: 'ship', width: 960, platforms: [P(80, 340, 160), P(720, 340, 160)] },
];

export function layoutById(id: string): Layout {
  const l = LAYOUTS.find((x) => x.id === id);
  if (!l) throw new Error(`unknown layout ${id}`);
  return l;
}

/** 방 순서: 일반 3 → 엘리트 → 일반 → 상점 → 일반 → 보스 */
export const ROOM_KINDS: RoomKind[] = ['combat', 'combat', 'combat', 'elite', 'combat', 'shop', 'combat', 'boss'];

function wave(rng: Rng, width: number, types: EnemyType[]): Spawn[] {
  return types.map((type, i) => ({
    type,
    // 아울러가 왼쪽에서 들어오므로 적은 화면 오른쪽 절반부터 배치한다
    x: Math.round(width * 0.45 + ((i + 1) / (types.length + 1)) * width * 0.5 + rng.int(-40, 40)),
  }));
}

function combatWaves(rng: Rng, index: number, width: number): Spawn[][] {
  const pool: EnemyType[] = index < 2 ? ['sailor', 'crab'] : ['sailor', 'crab', 'thrower'];
  const size = index < 2 ? 2 : 3;
  const pick = () => Array.from({ length: size }, () => rng.pick(pool));
  const waves = [wave(rng, width, pick()), wave(rng, width, pick())];
  if (index >= 4) waves.push(wave(rng, width, [rng.pick(pool), 'thrower', 'sailor']));
  return waves;
}

export function planRun(seed: number): RoomPlan[] {
  const rng = new Rng(seed);
  const docks = LAYOUTS.filter((l) => l.theme === 'dock' && l.id !== 'shop');
  const caves = LAYOUTS.filter((l) => l.theme === 'cave');
  return ROOM_KINDS.map((kind, index) => {
    if (kind === 'shop') return { index, kind, layout: layoutById('shop'), waves: [] };
    if (kind === 'boss') return { index, kind, layout: layoutById('deck'), waves: [[{ type: 'captain', x: 720 }]] };
    const layout = index < 3 ? rng.pick(docks) : rng.pick(caves);
    if (kind === 'elite') {
      return { index, kind, layout, waves: [[{ type: 'bosun', x: layout.width - 500 }], wave(rng, layout.width, ['crab', 'crab'])] };
    }
    return { index, kind, layout, waves: combatWaves(rng, index, layout.width) };
  });
}

const GIVER_LIST: Giver[] = ['barkeep', 'keeper', 'fishwife'];

/** 방을 깨면 나오는 문 두 개의 보상. 보스 앞에서는 문이 하나다 */
export function doorRewards(rng: Rng, nextKind: RoomKind | undefined): Reward[] {
  if (nextKind === undefined) return [];
  if (nextKind === 'boss') return [{ kind: 'heal' }];
  if (nextKind === 'shop') return [{ kind: 'gold' }];
  const givers = rng.shuffle([...GIVER_LIST]);
  const options: Reward[] = [{ kind: 'smile', giver: givers[0] }];
  const roll = rng.next();
  options.push(roll < 0.45 ? { kind: 'smile', giver: givers[1] } : roll < 0.7 ? { kind: 'gold' } : roll < 0.85 ? { kind: 'heal' } : { kind: 'teeth' });
  return options;
}

export interface RunState {
  seed: number;
  plan: RoomPlan[];
  roomIndex: number;
  face: number;
  boons: string[];
  gold: number;
  rum: number;
  lastStandUsed: number;
  teethEarned: number;
  clues: string[];
}

export function newRunState(seed: number, maxFace: number, rum: number, startBoons: string[] = []): RunState {
  return {
    seed,
    plan: planRun(seed),
    roomIndex: 0,
    face: maxFace,
    boons: [...startBoons],
    gold: 0,
    rum,
    lastStandUsed: 0,
    teethEarned: 0,
    clues: [],
  };
}

export const SHOP_ITEMS = [
  { id: 'heal', name: '럼주 한 잔', text: '체면 +35', price: 30 },
  { id: 'rum', name: '럼병', text: '럼병 +1 (언제든 체면 +30)', price: 45 },
  { id: 'smile', name: '수상한 사진', text: '아무 주민의 미소 하나', price: 70 },
] as const;
