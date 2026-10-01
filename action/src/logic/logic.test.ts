import { describe, expect, it } from 'vitest';
import { BOONS, computeStats, offerBoons } from './boons';
import { ENEMY_STATS } from './enemies';
import { buyUpgrade, emptyMeta, loadMeta, metaBonus, nextCost, saveMeta } from './meta';
import { Rng } from './rng';
import {
  DOUBLE_JUMP_V,
  doorRewards,
  GROUND_Y,
  JUMP_V,
  jumpHeight,
  LAYOUTS,
  planRun,
  ROOM_KINDS,
  VIEW_W,
} from './run';

describe('지형', () => {
  it('모든 발판은 2단 점프로 닿을 수 있다', () => {
    const reach = jumpHeight(JUMP_V) + jumpHeight(DOUBLE_JUMP_V);
    for (const layout of LAYOUTS) {
      // 각 발판은 바닥이나 다른 발판에서 닿을 수 있어야 한다
      const surfaces = [GROUND_Y, ...layout.platforms.map((p) => p.y)];
      for (const p of layout.platforms) {
        const from = surfaces.filter((y) => y > p.y);
        expect(from.some((y) => y - p.y <= reach - 10), `${layout.id} ${p.x}`).toBe(true);
        expect(p.x + p.w).toBeLessThanOrEqual(layout.width);
      }
      expect(layout.width).toBeGreaterThanOrEqual(VIEW_W);
    }
  });
});

describe('한 판 구성', () => {
  it('같은 시드면 같은 방 순서가 나온다', () => {
    expect(planRun(7).map((r) => r.layout.id)).toEqual(planRun(7).map((r) => r.layout.id));
  });

  it('방 8개, 마지막은 깡패 선장, 적은 방 안에 놓인다', () => {
    for (let seed = 1; seed < 100; seed++) {
      const plan = planRun(seed);
      expect(plan.map((r) => r.kind)).toEqual(ROOM_KINDS);
      expect(plan.at(-1)!.waves[0][0].type).toBe('captain');
      for (const room of plan) {
        for (const w of room.waves) for (const s of w) {
          expect(s.x).toBeGreaterThan(300);
          expect(s.x).toBeLessThan(room.layout.width - 40);
        }
      }
    }
  });

  it('보스 앞 문은 하나, 일반 방 뒤에는 미소가 꼭 하나 있다', () => {
    const rng = new Rng(3);
    expect(doorRewards(rng, 'boss')).toHaveLength(1);
    expect(doorRewards(rng, undefined)).toHaveLength(0);
    for (let i = 0; i < 50; i++) {
      const doors = doorRewards(rng, 'combat');
      expect(doors).toHaveLength(2);
      expect(doors[0].kind).toBe('smile');
    }
  });
});

describe('주민들의 미소', () => {
  it('미소는 능력치를 바꾸고, 합동 미소는 두 주민 미소가 있어야 나온다', () => {
    const base = computeStats([], { extraFace: 0, parryBonusMs: 0 });
    const s = computeStats(['bk-belly', 'kp-window', 'fw-slap'], { extraFace: 10, parryBonusMs: 40 });
    expect(s.maxFace).toBe(base.maxFace + 30);
    expect(s.parryWindowMs).toBeCloseTo((base.parryWindowMs + 40) * 1.5);
    expect(s.attackMul).toBeCloseTo(1.25);

    const rng = new Rng(1);
    for (let i = 0; i < 30; i++) {
      expect(offerBoons(rng, 'fishwife', []).some((b) => b.duo)).toBe(false);
    }
    const withBoth = Array.from({ length: 40 }, () => offerBoons(rng, 'fishwife', ['kp-flash', 'fw-slap'])).flat();
    expect(withBoth.some((b) => b.id === 'duo-squid')).toBe(true);
  });

  it('이미 가진 미소는 다시 나오지 않는다', () => {
    const owned = BOONS.filter((b) => b.giver === 'barkeep' && !b.duo).map((b) => b.id);
    expect(offerBoons(new Rng(2), 'barkeep', owned).every((b) => !owned.includes(b.id))).toBe(true);
  });
});

describe('메타 진행', () => {
  it('금니로 강화하고, 최대 단계에서 멈춘다', () => {
    const meta = emptyMeta();
    meta.teeth = 100;
    expect(buyUpgrade(meta, 'smile')).toBe(true);
    expect(buyUpgrade(meta, 'smile')).toBe(false);
    expect(nextCost(meta, 'smile')).toBeNull();
    expect(metaBonus(meta).startSmile).toBe(true);
    const poor = emptyMeta();
    expect(buyUpgrade(poor, 'face')).toBe(false);
  });

  it('저장과 불러오기, 깨진 저장은 새로 시작한다', () => {
    const store = new Map<string, string>();
    const storage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) };
    const meta = emptyMeta();
    meta.teeth = 9;
    saveMeta(storage, meta);
    expect(loadMeta(storage).teeth).toBe(9);
    for (const k of store.keys()) store.set(k, '{broken');
    expect(loadMeta(storage)).toEqual(emptyMeta());
  });

  it('모든 적에게 도발 대사가 있다', () => {
    for (const s of Object.values(ENEMY_STATS)) expect(s.taunts.length).toBeGreaterThan(0);
  });
});
