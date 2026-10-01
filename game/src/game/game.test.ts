import { describe, expect, it } from 'vitest';
import { CARDS, cardDef } from './cards';
import { endTurn, finisher, FINISHER_DAMAGE, HECKLE_BONUS, LAUGHTER_MAX, playCard, startCombat, type Combat } from './combat';
import { enemyDef, ENEMIES } from './enemies';
import { EVENTS } from './events';
import { generateMap, reachable } from './map';
import { applyRunEnd, emptyMeta, RUMORS } from './meta';
import { Rng } from './rng';
import { applyOutcome, newRun, rewardCards } from './run';
import type { CardInstance } from './types';

function combatWith(enemyId: string, hand: string[], tagsKnown = false): Combat {
  const deck: CardInstance[] = hand.map((defId, i) => ({ uid: i + 1, defId, upgraded: false }));
  const c = startCombat({ enemy: enemyDef(enemyId), deck, face: 50, maxFace: 50, rng: new Rng(1), tagsKnown });
  // 테스트에서는 손패 순서를 고정한다
  c.draw.push(...c.hand);
  c.hand = deck.slice(0, 5).map((card) => c.draw.splice(c.draw.indexOf(card), 1)[0]);
  return c;
}

function firstTaunt(enemyId: string): number {
  const intent = enemyDef(enemyId).intents[0];
  if (intent.kind !== 'taunt') throw new Error('첫 행동이 도발이 아니다');
  return intent.damage;
}

describe('말싸움 전투', () => {
  it('맞는 주제로 응수하면 피해 2배에 도발이 무효가 된다', () => {
    const c = combatWith('drunk', ['mirror']); // 첫 도발: 외모
    playCard(c, 0);
    expect(c.enemy.face).toBe(c.enemy.def.maxFace - 10);
    expect(c.enemy.intent).toBeNull();
    expect(c.laughter).toBe(1);
    endTurn(c);
    expect(c.player.face).toBe(50);
  });

  it('엉뚱한 응수는 기본 피해만 주고 도발이 세진다', () => {
    const c = combatWith('drunk', ['chicken']);
    const taunt = firstTaunt('drunk');
    playCard(c, 0);
    expect(c.enemy.face).toBe(c.enemy.def.maxFace - 5);
    endTurn(c);
    expect(c.player.face).toBe(50 - (taunt + HECKLE_BONUS));
  });

  it('허세 방어가 도발 피해를 막는다', () => {
    const c = combatWith('drunk', ['bluff']);
    playCard(c, 0);
    endTurn(c);
    expect(c.player.face).toBe(50 - Math.max(0, firstTaunt('drunk') - 5));
  });

  it('약화는 도발 피해를 25% 줄이고 당황은 받는 피해를 50% 늘린다', () => {
    const c = combatWith('fishwife', ['float', 'borrowed', 'poke']); // 첫 도발: 가문
    playCard(c, 0); // 피해 3, 약화 2
    playCard(c, 0); // 당황 2
    playCard(c, 0); // 피해 6 x1.5 = 9
    expect(c.enemy.face).toBe(c.enemy.def.maxFace - 3 - 9);
    endTurn(c);
    expect(c.player.face).toBe(50 - Math.floor(firstTaunt('fishwife') * 0.75));
  });

  it('관중 웃음이 가득 차면 필살 대사를 쓸 수 있다', () => {
    const c = combatWith('drunk', ['poke']);
    expect(finisher(c)).toBe(false);
    c.laughter = LAUGHTER_MAX;
    expect(finisher(c)).toBe(true);
    expect(c.enemy.face).toBe(c.enemy.def.maxFace - FINISHER_DAMAGE);
    expect(c.laughter).toBe(0);
  });

  it('기세가 모자라면 카드를 낼 수 없다', () => {
    const c = combatWith('drunk', ['swing', 'swing']);
    expect(playCard(c, 0)).toBe(true);
    expect(playCard(c, 0)).toBe(false);
  });

  it('보스의 도발 주제는 숨겨지고, 간파는 그 턴에만 유효하다', () => {
    const c = combatWith('captain', ['peek', 'poke', 'poke', 'poke', 'poke', 'poke', 'poke']);
    expect(c.enemy.tagRevealed).toBe(false);
    playCard(c, 0);
    expect(c.enemy.tagRevealed).toBe(true);
    endTurn(c);
    expect(c.enemy.tagRevealed).toBe(false);
  });

  it('메타 진행으로 드러난 보스는 처음부터 주제가 보인다', () => {
    const c = combatWith('captain', ['poke'], true);
    expect(c.enemy.tagRevealed).toBe(true);
  });

  it('체면이 0이 되면 진다', () => {
    const c = combatWith('captain', ['poke']);
    c.player.face = 1;
    endTurn(c);
    expect(c.outcome).toBe('lose');
  });

  it('상대 체면을 0으로 만들면 이긴다', () => {
    const c = combatWith('cabin', ['rope', 'poke']);
    c.enemy.face = 10;
    playCard(c, 0);
    expect(c.outcome).toBe('win');
  });
});

describe('지도', () => {
  it('같은 시드면 같은 지도가 나온다', () => {
    expect(generateMap(42)).toEqual(generateMap(42));
  });

  it('모든 칸에서 보스까지 갈 수 있다', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const map = generateMap(seed);
      const boss = map.floors.at(-1)![0];
      expect(boss.type).toBe('boss');
      for (const row of map.floors.slice(0, -1)) {
        for (const node of row) expect(node.next.length).toBeGreaterThan(0);
      }
      for (let f = 1; f < map.floors.length; f++) {
        for (const node of map.floors[f]) {
          expect(map.floors[f - 1].some((n) => n.next.includes(node.id))).toBe(true);
        }
      }
      expect(reachable(map, null)).toEqual(map.floors[0]);
      expect(map.floors[0].every((n) => n.type === 'fight')).toBe(true);
    }
  });
});

describe('데이터', () => {
  it('모든 카드, 적, 이벤트 참조가 유효하다', () => {
    for (const r of RUMORS) expect(cardDef(r.card).rumor).toBe(r.id);
    for (const e of EVENTS) for (const ch of e.choices) if (ch.outcome.card) expect(() => cardDef(ch.outcome.card!)).not.toThrow();
    expect(ENEMIES.filter((e) => e.rank === 'boss')).toHaveLength(1);
    expect(CARDS.filter((c) => c.kind === 'retort').every((c) => c.tag)).toBe(true);
  });
});

describe('런과 메타 진행', () => {
  it('소문을 해금하기 전에는 보상에 나오지 않는다', () => {
    const meta = emptyMeta();
    for (let s = 0; s < 50; s++) {
      for (const card of rewardCards(new Rng(s), meta, true)) expect(card.rumor).toBeUndefined();
    }
  });

  it('판이 끝나면 소문 하나와 단서가 쌓이고, 보스에게 지면 주제가 드러난다', () => {
    const meta = emptyMeta();
    const gain = applyRunEnd(meta, { won: false, floor: 7, clues: ['c-photo'], lostToBoss: 'captain' });
    expect(gain.rumor?.id).toBe(RUMORS[0].id);
    expect(meta.clues).toEqual(['c-photo']);
    expect(meta.revealedBosses).toEqual(['captain']);
    const again = applyRunEnd(meta, { won: false, floor: 3, clues: ['c-photo'], lostToBoss: null });
    expect(again.rumor?.id).toBe(RUMORS[1].id);
    expect(again.newClues).toEqual([]);
  });

  it('이벤트 결과는 체면을 0 아래로 떨어뜨리지 않는다', () => {
    const run = newRun(1);
    run.face = 2;
    applyOutcome(run, { text: '', face: -10 });
    expect(run.face).toBe(1);
  });
});
