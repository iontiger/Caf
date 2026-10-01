import { cardDef, rewardPool, STARTER_DECK } from './cards';
import { ACT1_BOSS, ELITE_ENEMIES, NORMAL_ENEMIES } from './enemies';
import { EVENTS, type Outcome } from './events';
import { generateMap } from './map';
import type { Rng } from './rng';
import type { CardDef, CardInstance, Meta, MapNode, RunState } from './types';

export const START_FACE = 50;
export const SHOP_REMOVE_PRICE = 50;
export const SHOP_HEAL_PRICE = 25;
export const SHOP_HEAL_AMOUNT = 15;
export const REST_HEAL_RATIO = 0.3;

export function newRun(seed: number): RunState {
  const run: RunState = {
    seed,
    face: START_FACE,
    maxFace: START_FACE,
    gold: 30,
    deck: [],
    map: generateMap(seed),
    at: null,
    visited: [],
    clues: [],
    nextUid: 1,
  };
  for (const id of STARTER_DECK) addCard(run, id);
  return run;
}

export function addCard(run: RunState, defId: string): CardInstance {
  const card = { uid: run.nextUid++, defId, upgraded: false };
  run.deck.push(card);
  return card;
}

export function removeCard(run: RunState, uid: number): void {
  run.deck = run.deck.filter((c) => c.uid !== uid);
}

export function moveTo(run: RunState, node: MapNode): void {
  run.at = node.id;
  run.visited.push(node.id);
}

export function currentFloor(run: RunState): number {
  return run.at === null ? 0 : Number(run.at.split('-')[0]) + 1;
}

export function pickEnemy(node: MapNode, rng: Rng): string {
  if (node.type === 'boss') return ACT1_BOSS;
  if (node.type === 'elite') return rng.pick(ELITE_ENEMIES);
  return rng.pick(NORMAL_ENEMIES);
}

/** 이미 본 이벤트는 피하고, 다 봤으면 아무거나 */
export function pickEvent(rng: Rng, seen: string[]): string {
  const fresh = EVENTS.filter((e) => !seen.includes(e.id));
  return rng.pick(fresh.length ? fresh : EVENTS).id;
}

export function rewardCards(rng: Rng, meta: Meta, elite: boolean): CardDef[] {
  const pool = rewardPool(meta.rumors);
  const picks: CardDef[] = [];
  while (picks.length < 3) {
    const wantRare = rng.next() < (elite ? 0.5 : 0.15);
    const candidates = pool.filter((c) => (wantRare ? c.rarity === 'rare' : c.rarity !== 'rare') && !picks.includes(c));
    const from = candidates.length ? candidates : pool.filter((c) => !picks.includes(c));
    picks.push(rng.pick(from));
  }
  return picks;
}

export function rewardGold(rng: Rng, type: MapNode['type']): number {
  if (type === 'elite') return rng.int(25, 35);
  if (type === 'boss') return 0;
  return rng.int(10, 18);
}

export interface ShopItem {
  card: CardDef;
  price: number;
  sold: boolean;
}

export function shopStock(rng: Rng, meta: Meta): ShopItem[] {
  return rewardCards(rng, meta, true).map((card) => ({
    card,
    price: (card.rarity === 'rare' ? 60 : 35) + rng.int(-5, 5),
    sold: false,
  }));
}

export function buy(run: RunState, item: ShopItem): boolean {
  if (item.sold || run.gold < item.price) return false;
  run.gold -= item.price;
  item.sold = true;
  addCard(run, item.card.id);
  return true;
}

export function restHeal(run: RunState): number {
  const amount = Math.ceil(run.maxFace * REST_HEAL_RATIO);
  const before = run.face;
  run.face = Math.min(run.maxFace, run.face + amount);
  return run.face - before;
}

export function upgradeCard(run: RunState, uid: number): boolean {
  const card = run.deck.find((c) => c.uid === uid);
  if (!card || card.upgraded) return false;
  card.upgraded = true;
  return true;
}

export function canChoose(run: RunState, outcome: Outcome): boolean {
  return outcome.cost === undefined || run.gold >= outcome.cost;
}

export function applyOutcome(run: RunState, outcome: Outcome): void {
  if (outcome.gold) run.gold = Math.max(0, run.gold + outcome.gold);
  if (outcome.maxFace) {
    run.maxFace = Math.max(1, run.maxFace + outcome.maxFace);
    run.face = Math.min(run.face, run.maxFace);
  }
  if (outcome.face) run.face = Math.max(1, Math.min(run.maxFace, run.face + outcome.face));
  if (outcome.card) {
    cardDef(outcome.card);
    addCard(run, outcome.card);
  }
  if (outcome.clue && !run.clues.includes(outcome.clue)) run.clues.push(outcome.clue);
}

export function treasure(rng: Rng, run: RunState): { gold: number; card: CardDef } {
  const gold = rng.int(25, 40);
  run.gold += gold;
  const props = rewardPool([]).filter((c) => c.kind === 'prop');
  const card = rng.pick(props);
  addCard(run, card.id);
  return { gold, card };
}
