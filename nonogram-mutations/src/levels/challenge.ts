// 挑战 15 关定义 — 规格 §3.1（彩色剪影 / 高难对角线 / 彩色×对角线 / 全规则叠加）
// 通关主线第 35 关后解锁（§3.2）。挑战 parTime = 基础 ×2（§7.6）；按关记录最少失误/最佳用时（§4，星级体系已移除）。
// 注意：挑战关实际棋盘 = 裁掉贴边全空行列后的紧网格（生成器 trimBorderEmpty），尺寸跟随图形，
// spec 中的 width/height 仅为生成上界。
import type { Level, LevelSpec } from '../state/types.js';
import { parTimeSec } from '../config.js';
import { buildLevelFromSpec } from './levels.js';

const S: LevelSpec[] = [];

function spec(
  n: number,
  partial: Omit<LevelSpec, 'id' | 'type' | 'index'>
): void {
  const id = 'c' + String(n).padStart(2, '0');
  S.push({
    ...partial,
    id,
    type: 'challenge',
    index: n - 1,
  } as LevelSpec);
}

function par(w: number, h: number, o: { colored?: boolean; diagonal?: boolean } = {}): number {
  return parTimeSec(w, h, { ...o, challenge: true });
}

// ---------- C1–5 彩色剪影（彩色 × 剪影） ----------
spec(1, { kind: 'silhouette', width: 12, height: 12, colors: [1, 4], diagonalEnabled: false, template: 'cduck11', title: '黄鸭鸭', parTimeSec: par(12, 12, { colored: true }), tutorial: ['perfect'] });
spec(2, { kind: 'silhouette', width: 14, height: 14, colors: [1, 2, 4], diagonalEnabled: false, template: 'cfish12', title: '热带鱼', parTimeSec: par(14, 14, { colored: true }) });
spec(3, { kind: 'silhouette', width: 13, height: 13, colors: [1, 3, 4], diagonalEnabled: false, template: 'cflower11', title: '小红花', parTimeSec: par(13, 13, { colored: true }) });
spec(4, { kind: 'silhouette', width: 15, height: 15, colors: [1, 2, 3, 4], diagonalEnabled: false, template: 'cparrot12', title: '鹦鹉', parTimeSec: par(15, 15, { colored: true }) });
spec(5, { kind: 'silhouette', width: 15, height: 15, colors: [1, 4, 5], diagonalEnabled: false, template: 'cbutterfly13', title: '彩蝶', parTimeSec: par(15, 15, { colored: true }) });

// ---------- C6–10 高难对角线（黑白，网格更大/形状更刁钻） ----------
spec(6, { kind: 'diagonal', width: 15, height: 15, diagonalEnabled: true, title: '斜阵 I', parTimeSec: par(15, 15, { diagonal: true }), gen: { density: 0.45 } });
spec(7, { kind: 'diagonal', width: 15, height: 15, diagonalEnabled: true, title: '斜阵 II', parTimeSec: par(15, 15, { diagonal: true }), gen: { density: 0.42 } });
spec(8, { kind: 'diagonal', width: 18, height: 18, diagonalEnabled: true, title: '斜影纵横', parTimeSec: par(18, 18, { diagonal: true }), gen: { density: 0.45 } });
spec(9, { kind: 'diagonal', width: 18, height: 18, diagonalEnabled: true, title: '斜风细雨', parTimeSec: par(18, 18, { diagonal: true }), gen: { density: 0.4 } });
spec(10, { kind: 'diagonal', width: 20, height: 20, diagonalEnabled: true, title: '对角风暴', parTimeSec: 720, gen: { density: 0.42, budget: 800 } });

// ---------- C11–13 彩色 × 对角线（仅 3 关，生成器给更大预算，§3.1/§11） ----------
spec(11, { kind: 'stack', width: 10, height: 10, colors: [1, 2], diagonalEnabled: true, title: '彩斜相逢', parTimeSec: par(10, 10, { colored: true, diagonal: true }), gen: { budget: 2000 } });
spec(12, { kind: 'stack', width: 10, height: 10, colors: [1, 2], diagonalEnabled: true, title: '彩斜 II', parTimeSec: par(10, 10, { colored: true, diagonal: true }), gen: { budget: 2000 } });
spec(13, { kind: 'stack', width: 12, height: 12, colors: [1, 3], diagonalEnabled: true, title: '彩斜 III', parTimeSec: par(12, 12, { colored: true, diagonal: true }), gen: { budget: 3000 } });

// ---------- C14–15 全规则叠加（彩色 × 对角线 × 剪影，≤20×20） ----------
spec(14, { kind: 'stack', width: 15, height: 15, colors: [1, 2, 3, 4], diagonalEnabled: true, template: 'cparrot12', title: '鹦鹉·全异化', parTimeSec: par(15, 15, { colored: true, diagonal: true }) });
spec(15, { kind: 'stack', width: 15, height: 15, colors: [1, 4, 5], diagonalEnabled: true, template: 'cbutterfly13', title: '彩蝶·终极', parTimeSec: par(15, 15, { colored: true, diagonal: true }) });

export const CHALLENGE_SPECS: LevelSpec[] = S;

let cached: Level[] | null = null;
export function getChallengeLevels(): Level[] {
  if (!cached) cached = CHALLENGE_SPECS.map(buildLevelFromSpec);
  return cached;
}
