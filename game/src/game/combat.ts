import { cardDef, cardValue } from './cards';
import type { Rng } from './rng';
import type { CardInstance, EnemyDef, Intent } from './types';

export const HAND_SIZE = 5;
export const MOMENTUM_PER_TURN = 3;
export const LAUGHTER_MAX = 5;
export const FINISHER_DAMAGE = 15;
/** 엉뚱한 응수를 하면 관중이 상대 편을 들어 도발 피해가 늘어난다 */
export const HECKLE_BONUS = 2;

export interface EnemyState {
  def: EnemyDef;
  face: number;
  block: number;
  weak: number;
  flustered: number;
  strength: number;
  intentIndex: number;
  /** null이면 이번 턴 행동이 취소된 것 */
  intent: Intent | null;
  heckle: number;
  /** 이번 턴 도발 주제가 보이는지 */
  tagRevealed: boolean;
  /** 매 턴 기본으로 주제가 보이는지 (일반 적, 또는 메타 진행으로 드러난 보스) */
  tagsKnown: boolean;
}

export interface PlayerState {
  face: number;
  maxFace: number;
  block: number;
  momentum: number;
}

export type LogKind = 'info' | 'counter' | 'miss' | 'enemy' | 'finisher';

export interface LogEntry {
  kind: LogKind;
  text: string;
}

export interface Combat {
  enemy: EnemyState;
  player: PlayerState;
  draw: CardInstance[];
  hand: CardInstance[];
  discard: CardInstance[];
  exhausted: CardInstance[];
  laughter: number;
  turn: number;
  log: LogEntry[];
  outcome: 'win' | 'lose' | null;
  rng: Rng;
}

export interface CombatSetup {
  enemy: EnemyDef;
  deck: CardInstance[];
  face: number;
  maxFace: number;
  rng: Rng;
  /** 메타 진행으로 보스의 도발 주제가 드러났는지 */
  tagsKnown: boolean;
}

export function startCombat(setup: CombatSetup): Combat {
  const { enemy, rng } = setup;
  const c: Combat = {
    enemy: {
      def: enemy,
      face: enemy.maxFace,
      block: 0,
      weak: 0,
      flustered: 0,
      strength: 0,
      intentIndex: 0,
      intent: enemy.intents[0],
      heckle: 0,
      tagRevealed: setup.tagsKnown || !enemy.hiddenTags,
      tagsKnown: setup.tagsKnown || !enemy.hiddenTags,
    },
    player: { face: setup.face, maxFace: setup.maxFace, block: 0, momentum: MOMENTUM_PER_TURN },
    draw: rng.shuffle([...setup.deck]),
    hand: [],
    discard: [],
    exhausted: [],
    laughter: 0,
    turn: 1,
    log: [],
    outcome: null,
    rng,
  };
  drawCards(c, HAND_SIZE);
  return c;
}

export function drawCards(c: Combat, n: number): void {
  for (let i = 0; i < n; i++) {
    if (c.draw.length === 0) {
      if (c.discard.length === 0) return;
      c.draw = c.rng.shuffle(c.discard);
      c.discard = [];
    }
    c.hand.push(c.draw.pop()!);
  }
}

export function tagVisible(c: Combat): boolean {
  return c.enemy.tagRevealed;
}

/** 지금 카드를 내면 받아치기가 되는지 (UI 강조용, 주제가 보일 때만) */
export function wouldCounter(c: Combat, card: CardInstance): boolean {
  const d = cardDef(card.defId);
  const intent = c.enemy.intent;
  if (d.kind !== 'retort' || !intent || intent.kind !== 'taunt') return false;
  return d.tag === 'any' || d.tag === intent.tag;
}

function hitEnemy(c: Combat, amount: number): number {
  const e = c.enemy;
  let dmg = e.flustered > 0 ? Math.floor(amount * 1.5) : amount;
  const absorbed = Math.min(e.block, dmg);
  e.block -= absorbed;
  dmg -= absorbed;
  e.face = Math.max(0, e.face - dmg);
  return dmg;
}

function checkEnd(c: Combat): void {
  if (c.enemy.face <= 0) {
    c.outcome = 'win';
    c.log.push({ kind: 'info', text: `${c.enemy.def.name}: "${c.enemy.def.defeatLine}"` });
  } else if (c.player.face <= 0) {
    c.outcome = 'lose';
  }
}

export function canPlay(c: Combat, handIndex: number): boolean {
  const card = c.hand[handIndex];
  return !!card && !c.outcome && cardDef(card.defId).cost <= c.player.momentum;
}

export function playCard(c: Combat, handIndex: number): boolean {
  if (!canPlay(c, handIndex)) return false;
  const card = c.hand[handIndex];
  const d = cardDef(card.defId);
  c.player.momentum -= d.cost;
  c.hand.splice(handIndex, 1);
  c.log.push({ kind: 'info', text: `아울러: "${d.line}"` });

  if (d.kind === 'retort') {
    const intent = c.enemy.intent;
    const countered = wouldCounter(c, card);
    const base = cardValue(d.damage, card);
    if (countered) {
      const dealt = hitEnemy(c, base * 2);
      c.enemy.intent = null;
      c.laughter = Math.min(LAUGHTER_MAX, c.laughter + 1);
      c.log.push({ kind: 'counter', text: `받아치기! 피해 ${dealt}, 도발이 무효가 됐다. 관중이 웃는다.` });
    } else {
      const dealt = hitEnemy(c, base);
      if (intent && intent.kind === 'taunt') {
        c.enemy.heckle += HECKLE_BONUS;
        c.laughter = Math.max(0, c.laughter - 1);
        c.log.push({ kind: 'miss', text: `엉뚱한 소리! 피해 ${dealt}. 관중이 상대 편을 든다 (도발 +${HECKLE_BONUS}).` });
      } else {
        c.log.push({ kind: 'info', text: `피해 ${dealt}.` });
      }
    }
  } else if (d.damage !== undefined) {
    const hits = d.hits ?? 1;
    let total = 0;
    for (let i = 0; i < hits && c.enemy.face > 0; i++) total += hitEnemy(c, cardValue(d.damage, card));
    c.log.push({ kind: 'info', text: `피해 ${total}.` });
  }

  if (d.block !== undefined) c.player.block += cardValue(d.block, card);
  if (d.weak) c.enemy.weak += d.weak;
  if (d.flustered) c.enemy.flustered += d.flustered;
  if (d.heal) c.player.face = Math.min(c.player.maxFace, c.player.face + cardValue(d.heal, card));
  if (d.laughter) c.laughter = Math.min(LAUGHTER_MAX, c.laughter + d.laughter);
  if (d.momentum) c.player.momentum += d.momentum;
  if (d.reveal && !c.enemy.tagRevealed) {
    c.enemy.tagRevealed = true;
    c.log.push({ kind: 'info', text: '상대의 속셈이 보인다.' });
  }
  if (d.cancel && c.enemy.intent) {
    c.enemy.intent = null;
    c.log.push({ kind: 'counter', text: '상대가 어리둥절해서 할 말을 잊었다!' });
  }

  if (d.exhaust) c.exhausted.push(card);
  else c.discard.push(card);
  if (d.draw) drawCards(c, d.draw);

  checkEnd(c);
  return true;
}

export function canFinish(c: Combat): boolean {
  return !c.outcome && c.laughter >= LAUGHTER_MAX;
}

/** 관중 웃음이 가득 차면 쓰는 필살 대사. 방어를 무시한다 */
export function finisher(c: Combat): boolean {
  if (!canFinish(c)) return false;
  c.laughter = 0;
  c.enemy.face = Math.max(0, c.enemy.face - FINISHER_DAMAGE);
  c.log.push({ kind: 'finisher', text: `필살 대사! "이 정도면 너도 웃기지?" 관중이 뒤집어진다. 피해 ${FINISHER_DAMAGE}.` });
  checkEnd(c);
  return true;
}

export function intentDamage(c: Combat): number {
  const intent = c.enemy.intent;
  if (!intent || intent.kind !== 'taunt') return 0;
  const raw = intent.damage + c.enemy.strength + c.enemy.heckle;
  return c.enemy.weak > 0 ? Math.floor(raw * 0.75) : raw;
}

export function endTurn(c: Combat): void {
  if (c.outcome) return;
  c.discard.push(...c.hand);
  c.hand = [];

  const e = c.enemy;
  const intent = e.intent;
  if (intent) {
    if (intent.kind === 'taunt') {
      let dmg = intentDamage(c);
      const absorbed = Math.min(c.player.block, dmg);
      c.player.block -= absorbed;
      dmg -= absorbed;
      c.player.face = Math.max(0, c.player.face - dmg);
      c.log.push({ kind: 'enemy', text: `${e.def.name}: "${intent.line}" 체면 피해 ${dmg}.` });
    } else if (intent.kind === 'bluff') {
      e.block += intent.block;
      c.log.push({ kind: 'enemy', text: `${e.def.name}: ${intent.line} (방어 ${intent.block})` });
    } else {
      e.strength += intent.amount;
      c.log.push({ kind: 'enemy', text: `${e.def.name}: ${intent.line} (도발 +${intent.amount})` });
    }
  }
  checkEnd(c);
  if (c.outcome) return;

  // 다음 라운드 준비
  e.weak = Math.max(0, e.weak - 1);
  e.flustered = Math.max(0, e.flustered - 1);
  e.heckle = 0;
  e.intentIndex = (e.intentIndex + 1) % e.def.intents.length;
  e.intent = e.def.intents[e.intentIndex];
  e.tagRevealed = e.tagsKnown;
  c.player.block = 0;
  c.player.momentum = MOMENTUM_PER_TURN;
  c.turn += 1;
  drawCards(c, HAND_SIZE);
}
