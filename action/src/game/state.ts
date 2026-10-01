import { computeStats, type Stats } from '../logic/boons';
import { loadMeta, metaBonus, saveMeta, type Meta } from '../logic/meta';
import { newRunState, type RunState } from '../logic/run';

const storage = (() => {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
})();

/** 장면 사이에 공유하는 게임 상태 */
export const session: { meta: Meta; run: RunState | null } = {
  meta: loadMeta(storage),
  run: null,
};

export function persist(): void {
  saveMeta(storage, session.meta);
}

export function currentStats(): Stats {
  const bonus = metaBonus(session.meta);
  return computeStats(session.run?.boons ?? [], bonus);
}

export function addTeeth(n: number): void {
  if (!session.run) return;
  session.run.teethEarned += n;
  // 금니는 쓰러져도 남도록 바로 저장한다
  session.meta.teeth += n;
  persist();
}

/** HUD가 매 프레임 읽는 값들 */
export const live: {
  laughter: number;
  boss: { name: string; hp: number; max: number } | null;
  prompt: string;
} = { laughter: 0, boss: null, prompt: '' };

export function startRun(seed = Math.floor(Math.random() * 1e9)): RunState {
  const bonus = metaBonus(session.meta);
  const stats = computeStats([], bonus);
  session.run = newRunState(seed, stats.maxFace, 1 + bonus.startRum);
  live.laughter = 0;
  live.boss = null;
  return session.run;
}

export function isTouch(): boolean {
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0 || location.search.includes('touch');
}
