import { Rng } from './rng';
import type { GameMap, MapNode, NodeType } from './types';

/** 1막: 지도 6칸 + 보스 */
export const ACT1_FLOORS = 6;

const WEIGHTS: [NodeType, number][] = [
  ['fight', 45],
  ['event', 22],
  ['elite', 10],
  ['shop', 10],
  ['treasure', 8],
  ['tavern', 5],
];

function rollType(rng: Rng, floor: number): NodeType {
  if (floor === 0) return 'fight';
  if (floor === ACT1_FLOORS - 1) return 'tavern';
  const options = WEIGHTS.filter(([t]) => !(t === 'elite' && floor < 2));
  const total = options.reduce((s, [, w]) => s + w, 0);
  let roll = rng.next() * total;
  for (const [t, w] of options) {
    roll -= w;
    if (roll < 0) return t;
  }
  return 'fight';
}

export function generateMap(seed: number): GameMap {
  const rng = new Rng(seed);
  const floors: MapNode[][] = [];
  for (let f = 0; f < ACT1_FLOORS; f++) {
    const count = rng.int(2, 3);
    const row: MapNode[] = [];
    for (let i = 0; i < count; i++) {
      row.push({ id: `${f}-${i}`, floor: f, index: i, type: rollType(rng, f), next: [] });
    }
    floors.push(row);
  }
  floors.push([{ id: `${ACT1_FLOORS}-0`, floor: ACT1_FLOORS, index: 0, type: 'boss', next: [] }]);

  for (let f = 0; f < floors.length - 1; f++) {
    const row = floors[f];
    const nextRow = floors[f + 1];
    for (const node of row) {
      // 위치 비율이 가까운 칸으로 연결하고, 가끔 옆 칸으로 갈래를 하나 더 만든다
      const ratio = row.length === 1 ? 0.5 : node.index / (row.length - 1);
      const j = Math.round(ratio * (nextRow.length - 1));
      node.next.push(nextRow[j].id);
      const side = j + (rng.next() < 0.5 ? -1 : 1);
      if (side >= 0 && side < nextRow.length && rng.next() < 0.5) node.next.push(nextRow[side].id);
    }
    // 들어오는 길이 없는 칸이 없도록 한다
    for (const target of nextRow) {
      if (!row.some((n) => n.next.includes(target.id))) {
        const ratio = nextRow.length === 1 ? 0.5 : target.index / (nextRow.length - 1);
        row[Math.round(ratio * (row.length - 1))].next.push(target.id);
      }
    }
    for (const node of row) node.next.sort();
  }
  return { floors };
}

export function findNode(map: GameMap, id: string): MapNode {
  for (const row of map.floors) {
    const node = row.find((n) => n.id === id);
    if (node) return node;
  }
  throw new Error(`unknown node ${id}`);
}

/** 지금 갈 수 있는 칸 */
export function reachable(map: GameMap, at: string | null): MapNode[] {
  if (at === null) return map.floors[0];
  return findNode(map, at).next.map((id) => findNode(map, id));
}

export const NODE_INFO: Record<NodeType, { icon: string; label: string }> = {
  fight: { icon: '⚔️', label: '말싸움' },
  elite: { icon: '🦜', label: '엘리트' },
  event: { icon: '❓', label: '이벤트' },
  tavern: { icon: '🍻', label: '술집' },
  shop: { icon: '💰', label: '상점' },
  treasure: { icon: '🧰', label: '보물' },
  boss: { icon: '☠️', label: '보스' },
};
