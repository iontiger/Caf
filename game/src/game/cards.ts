import type { CardDef, CardInstance } from './types';

export const CARDS: CardDef[] = [
  // 칼질
  { id: 'poke', name: '엉성한 찌르기', kind: 'slash', cost: 1, damage: 6, rarity: 'starter', line: '에잇! ...어, 맞았네?' },
  { id: 'swing', name: '크게 휘두르기', kind: 'slash', cost: 2, damage: 12, rarity: 'common', line: '눈 감고 휘둘렀는데!' },
  { id: 'double', name: '연속 찌르기', kind: 'slash', cost: 1, damage: 3, hits: 2, rarity: 'common', line: '하나, 둘! 셋은 다음에.' },
  { id: 'trip', name: '발 걸기', kind: 'slash', cost: 1, damage: 4, weak: 1, rarity: 'common', line: '어머, 거기 밧줄 있었네.' },
  { id: 'rope', name: '돛줄 타고 내려찍기', kind: 'slash', cost: 2, damage: 16, rarity: 'rare', line: '이게 바로 해적의 낭만이지!' },

  // 독설
  { id: 'float', name: '배 걱정', kind: 'jab', cost: 1, damage: 3, weak: 2, rarity: 'common', line: '네 배는 물에 뜨긴 하니?' },
  { id: 'borrowed', name: '빌린 칼', kind: 'jab', cost: 1, flustered: 2, rarity: 'common', line: '그 칼, 엄마한테 빌린 거지?' },
  { id: 'smell', name: '생선 냄새', kind: 'jab', cost: 0, damage: 2, flustered: 1, rarity: 'common', line: '어디서 상한 고등어 냄새가...' },
  { id: 'upside', name: '거꾸로 든 지도', kind: 'jab', cost: 1, weak: 1, flustered: 1, draw: 1, rarity: 'rare', line: '그 지도, 거꾸로 들었어.' },

  // 응수
  { id: 'mirror', name: '거울 응수', kind: 'retort', cost: 1, tag: '외모', damage: 5, rarity: 'starter', line: '너도 거울은 본 적 있지?' },
  { id: 'chicken', name: '닭 응수', kind: 'retort', cost: 1, tag: '용기', damage: 5, rarity: 'starter', line: '닭이 너 보고 겁쟁이래.' },
  { id: 'family', name: '족보 응수', kind: 'retort', cost: 1, tag: '가문', damage: 5, rarity: 'common', line: '네 족보는 낚시 그물로 짰냐?' },
  { id: 'skill', name: '실력 응수', kind: 'retort', cost: 1, tag: '실력', damage: 5, rarity: 'starter', line: '그 실력이면 갈매기도 안 무서워해.' },
  { id: 'mirror2', name: '확대경 응수', kind: 'retort', cost: 2, tag: '외모', damage: 9, rarity: 'common', line: '가까이서 보니 더 심각하네.' },
  { id: 'chicken2', name: '꽁무니 응수', kind: 'retort', cost: 2, tag: '용기', damage: 9, rarity: 'common', line: '도망칠 때만 제일 빠르던데?' },
  { id: 'family2', name: '할머니 응수', kind: 'retort', cost: 2, tag: '가문', damage: 9, rarity: 'common', line: '너희 할머니가 나한테 사과하셨어.' },
  { id: 'skill2', name: '연습 응수', kind: 'retort', cost: 2, tag: '실력', damage: 9, rarity: 'common', line: '연습은 허수아비랑 했니?' },

  // 허세
  { id: 'bluff', name: '허세', kind: 'bluff', cost: 1, block: 5, rarity: 'starter', line: '난 원래 일부러 져 주는 거야.' },
  { id: 'deaf', name: '못 들은 척', kind: 'bluff', cost: 0, block: 3, rarity: 'common', line: '응? 파도 소리 때문에 안 들려.' },
  { id: 'loud', name: '큰소리', kind: 'bluff', cost: 2, block: 12, rarity: 'common', line: '내가 바로 전설의 해적, 아울러다!' },
  { id: 'peek', name: '눈치 보기', kind: 'bluff', cost: 0, block: 2, reveal: true, draw: 1, rarity: 'common', line: '흠, 저 표정은...' },

  // 소품
  { id: 'chickenToy', name: '고무 닭', kind: 'prop', cost: 0, cancel: true, exhaust: true, rarity: 'common', line: '꽤에에엑!' },
  { id: 'rum', name: '럼주 한 모금', kind: 'prop', cost: 0, heal: 4, draw: 2, exhaust: true, rarity: 'common', line: '크으, 정신이 번쩍!' },
  { id: 'monkey', name: '원숭이 인형', kind: 'prop', cost: 1, laughter: 2, exhaust: true, rarity: 'common', line: '관중 여러분, 제 친구를 소개합니다!' },
  { id: 'scope', name: '낡은 망원경', kind: 'prop', cost: 0, reveal: true, draw: 1, momentum: 1, exhaust: true, rarity: 'rare', line: '저 멀리 네 속셈이 보인다!' },

  // 소문으로 해금되는 카드
  { id: 'yours', name: '그건 네 얘기', kind: 'retort', cost: 1, tag: 'any', damage: 6, rarity: 'rare', rumor: 'r-yours', line: '그거 방금 네 얘기 한 거지?' },
  { id: 'crowd', name: '관중 선동', kind: 'jab', cost: 1, laughter: 2, flustered: 1, rarity: 'common', rumor: 'r-crowd', line: '여러분, 이 사람 좀 보세요!' },
  { id: 'goldTooth', name: '선장의 금니', kind: 'prop', cost: 0, momentum: 2, exhaust: true, rarity: 'rare', rumor: 'r-tooth', line: '반짝! 전설이 나를 돕는다.' },
  { id: 'lighthouse', name: '등대 불빛', kind: 'bluff', cost: 1, block: 8, reveal: true, rarity: 'common', rumor: 'r-light', line: '눈부시지? 등대지기 아저씨 비법이야.' },
  { id: 'secretRum', name: '술집 비법 럼', kind: 'prop', cost: 1, heal: 8, block: 4, exhaust: true, rarity: 'rare', rumor: 'r-rum', line: '이 맛에 돌아오는 거지.' },
];

const BY_ID = new Map(CARDS.map((c) => [c.id, c]));

export function cardDef(id: string): CardDef {
  const def = BY_ID.get(id);
  if (!def) throw new Error(`unknown card ${id}`);
  return def;
}

export const STARTER_DECK = ['poke', 'poke', 'poke', 'poke', 'bluff', 'bluff', 'bluff', 'mirror', 'chicken', 'skill'];

/** 강화하면 피해, 방어, 회복이 3씩 오른다 */
export const UPGRADE_BONUS = 3;

export function cardValue(base: number | undefined, card: CardInstance): number {
  if (base === undefined) return 0;
  return base + (card.upgraded ? UPGRADE_BONUS : 0);
}

export function describeCard(card: CardInstance): string {
  const d = cardDef(card.defId);
  const parts: string[] = [];
  if (d.kind === 'retort') {
    parts.push(d.tag === 'any' ? '모든 도발에 응수' : `[${d.tag}] 도발에 응수하면 2배 + 도발 무효`);
  }
  if (d.damage !== undefined) parts.push(`피해 ${cardValue(d.damage, card)}${d.hits ? ` x${d.hits}` : ''}`);
  if (d.block !== undefined) parts.push(`방어 ${cardValue(d.block, card)}`);
  if (d.weak) parts.push(`약화 ${d.weak}`);
  if (d.flustered) parts.push(`당황 ${d.flustered}`);
  if (d.heal) parts.push(`체면 회복 ${cardValue(d.heal, card)}`);
  if (d.laughter) parts.push(`관중 웃음 +${d.laughter}`);
  if (d.momentum) parts.push(`기세 +${d.momentum}`);
  if (d.reveal) parts.push('도발 주제 간파');
  if (d.cancel) parts.push('상대 다음 행동 취소');
  if (d.draw) parts.push(`카드 ${d.draw}장 뽑기`);
  if (d.exhaust) parts.push('사라짐');
  return parts.join(' · ');
}

/** 메타 진행에서 해금된 소문을 반영한 보상 카드 풀 */
export function rewardPool(rumors: string[]): CardDef[] {
  return CARDS.filter((c) => c.rarity !== 'starter' && (!c.rumor || rumors.includes(c.rumor)));
}
