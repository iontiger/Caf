import type { Rng } from './rng';

export type Giver = 'barkeep' | 'keeper' | 'fishwife';

export const GIVERS: Record<Giver, { name: string; color: number; icon: string }> = {
  barkeep: { name: '술집 주인', color: 0xffb347, icon: '🍺' },
  keeper: { name: '등대지기', color: 0xfff1a8, icon: '🏮' },
  fishwife: { name: '생선 장수', color: 0x7fd6c2, icon: '🐟' },
};

/** 판 안에서 아울러의 능력치. 미소와 영구 강화가 이것을 바꾼다 */
export interface Stats {
  maxFace: number;
  attackMul: number;
  counterMul: number;
  parryWindowMs: number;
  healOnParry: number;
  /** 0이면 독 없음. 초당 피해 */
  poisonDps: number;
  poisonBurst: boolean;
  flashOnDodge: boolean;
  stunOnParryMs: number;
  lastStand: number;
  laughterMul: number;
  /** 기절한 적에게 주는 독 배수 (합동 미소) */
  stunnedPoisonMul: number;
}

export interface Boon {
  id: string;
  giver: Giver;
  /** 합동 미소는 두 주민의 미소가 하나씩 있어야 나온다 */
  duo?: Giver;
  name: string;
  text: string;
  /** 미소를 돌려받은 주민의 한마디 */
  quote: string;
  apply: (s: Stats) => void;
}

export const BOONS: Boon[] = [
  {
    id: 'bk-toast', giver: 'barkeep', name: '건배의 미소', text: '받아치기에 성공할 때마다 체면 +5',
    quote: '"이 맛에 장사하지! 한 잔 받아라, 아울러."', apply: (s) => { s.healOnParry += 5; },
  },
  {
    id: 'bk-belly', giver: 'barkeep', name: '술배의 미소', text: '최대 체면 +20',
    quote: '"배 든든하면 웬만한 욕은 다 소화돼."', apply: (s) => { s.maxFace += 20; },
  },
  {
    id: 'bk-again', giver: 'barkeep', name: '한 번 더의 미소', text: '쓰러질 때 한 번 체면 30%로 버틴다',
    quote: '"술집 문 닫기 전까진 아무도 못 쓰러져."', apply: (s) => { s.lastStand += 1; },
  },
  {
    id: 'kp-window', giver: 'keeper', name: '등대 눈빛의 미소', text: '받아치기 판정 시간 +50%',
    quote: '"멀리 오는 파도도 다 보이는 법이지."', apply: (s) => { s.parryWindowMs *= 1.5; },
  },
  {
    id: 'kp-flash', giver: 'keeper', name: '섬광의 미소', text: '구르기 끝에 섬광, 주변 적 기절',
    quote: '"불빛 한 번이면 다들 눈을 감지."', apply: (s) => { s.flashOnDodge = true; },
  },
  {
    id: 'kp-beam', giver: 'keeper', name: '불빛 반격의 미소', text: '받아치기 반격 피해 +60%, 기절 시간 +50%',
    quote: '"빛은 되돌아오는 거야. 말도 그렇고."', apply: (s) => { s.counterMul *= 1.6; s.stunOnParryMs *= 1.5; },
  },
  {
    id: 'fw-stink', giver: 'fishwife', name: '비린내의 미소', text: '공격이 비린내 독을 남긴다 (초당 피해 4, 3초)',
    quote: '"생선 냄새 맡으면 다들 기운이 쭉 빠지지."', apply: (s) => { s.poisonDps = Math.max(s.poisonDps, 4); },
  },
  {
    id: 'fw-burst', giver: 'fishwife', name: '상한 생선의 미소', text: '독에 걸린 적이 쓰러지면 주변에 독이 터진다',
    quote: '"오래 묵힌 건 터지기 마련이야."', apply: (s) => { s.poisonBurst = true; s.poisonDps = Math.max(s.poisonDps, 2); },
  },
  {
    id: 'fw-slap', giver: 'fishwife', name: '다랑어 따귀의 미소', text: '기본 공격 피해 +25%',
    quote: '"따귀는 다랑어로 때려야 제맛이지."', apply: (s) => { s.attackMul *= 1.25; },
  },
  {
    id: 'duo-squid', giver: 'keeper', duo: 'fishwife', name: '빛나는 오징어의 미소', text: '기절한 적이 받는 독 피해 3배',
    quote: '"등대 불빛 아래서 오징어가 제일 잘 잡히지!" (등대지기와 생선 장수)', apply: (s) => { s.stunnedPoisonMul = 3; },
  },
  {
    id: 'duo-nightcap', giver: 'barkeep', duo: 'keeper', name: '등대 아래 한 잔의 미소', text: '받아치기마다 관중 웃음 2배',
    quote: '"한 잔 하고 불 켜면 밤바다도 무섭지 않아." (술집 주인과 등대지기)', apply: (s) => { s.laughterMul *= 2; },
  },
];

export function boonById(id: string): Boon {
  const b = BOONS.find((x) => x.id === id);
  if (!b) throw new Error(`unknown boon ${id}`);
  return b;
}

export interface MetaStatBonus {
  extraFace: number;
  parryBonusMs: number;
}

export function computeStats(boonIds: string[], meta: MetaStatBonus): Stats {
  const s: Stats = {
    maxFace: 100 + meta.extraFace,
    attackMul: 1,
    counterMul: 1,
    parryWindowMs: 200 + meta.parryBonusMs,
    healOnParry: 0,
    poisonDps: 0,
    poisonBurst: false,
    flashOnDodge: false,
    stunOnParryMs: 1400,
    lastStand: 0,
    laughterMul: 1,
    stunnedPoisonMul: 1,
  };
  for (const id of boonIds) boonById(id).apply(s);
  return s;
}

function duoUnlocked(b: Boon, owned: string[]): boolean {
  if (!b.duo) return true;
  const givers = new Set(owned.map((id) => boonById(id).giver));
  return givers.has(b.giver) && givers.has(b.duo);
}

/** 한 주민이 내미는 미소 선택지. 합동 미소는 조건이 맞으면 섞여 나온다 */
export function offerBoons(rng: Rng, giver: Giver, owned: string[], count = 3): Boon[] {
  const pool = BOONS.filter(
    (b) => !owned.includes(b.id) && (b.giver === giver || b.duo === giver) && duoUnlocked(b, owned),
  );
  const picks = rng.shuffle([...pool]);
  return picks.slice(0, count);
}
