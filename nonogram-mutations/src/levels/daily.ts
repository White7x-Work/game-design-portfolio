// 每日一题 — 规格 §3.1/§8：按日期种子（YYYY-MM-DD）本地确定生成，无需服务器。
// 固定中档难度：10×10，黑白或 2 色彩色，不含对角线。同一天全设备同题。
import type { Level, LevelSpec } from '../state/types.js';
import { parTimeSec, LIMITS } from '../config.js';
import { dateSeed, mulberry32, todayCompact, todayStr, type RNG } from '../core/prng.js';
import { generateLevelAsync, generateLevel, type GenerateResult } from '../core/generator.js';
import { stringsToGrid, gridToStrings } from '../core/grid.js';
import { deriveClues } from '../core/clues.js';
import { loadDailyCache, saveDailyCache } from '../state/progress.js';

/** 由日期种子决定今天题面规格（黑白 or 2 色彩色；确定性，全设备一致） */
export function dailySpecFor(dateStr: string, rng: RNG): LevelSpec {
  const compact = String(dateSeed(dateStr));
  const useColor = rng() < 0.5;
  const g = LIMITS.dailyGrid;
  return {
    id: 'daily-' + compact,
    kind: useColor ? 'colored' : 'mono',
    width: g,
    height: g,
    colors: useColor ? [1, 2] : undefined,
    diagonalEnabled: false,
    parTimeSec: useColor ? parTimeSec(g, g, { colored: true }) : parTimeSec(g, g),
    type: 'daily',
    title: `${dateStr} 每日一题`,
    // 确定性预算（迭代数而非墙钟时间 → 跨设备结果一致）
    gen: { density: useColor ? undefined : 0.5, budget: useColor ? 900 : 1500 },
  };
}

function buildDailyLevel(spec: LevelSpec, rows: string[]): Level {
  const solution = stringsToGrid(rows);
  const clues = deriveClues(solution, spec.width, spec.height, { diagonalEnabled: false });
  return {
    id: spec.id,
    kind: spec.kind,
    width: spec.width,
    height: spec.height,
    colors: spec.colors,
    diagonalEnabled: false,
    solution,
    clues,
    parTimeSec: spec.parTimeSec,
    type: 'daily',
    title: spec.title,
  };
}

/** 获取今日（或指定日期）题目：优先缓存，未命中则确定性生成并缓存。 */
export async function getDailyLevel(
  dateStr = todayStr(),
  onProgress?: (iter: number, budget: number) => void
): Promise<Level> {
  const key = todayKeyOf(dateStr);
  const cached = loadDailyCache(key);
  const rng = mulberry32(dateSeed(dateStr));
  const spec = dailySpecFor(dateStr, rng);
  if (cached && cached.dateStr === dateStr && cached.rows.length === spec.height) {
    return buildDailyLevel(spec, cached.rows);
  }
  // 同一 rng 序列继续生成（dailySpecFor 只消耗 1 次 rng → 全设备一致）
  const res: GenerateResult = await generateLevelAsync(spec, rng, undefined, onProgress);
  if (res.level) {
    saveDailyCache(key, { dateStr, colored: !!spec.colors, rows: gridToStrings(res.level.solution) });
    return res.level;
  }
  // 兜底（确定性降级链，§7.4）：降密度重试黑白
  const fallbackSpec: LevelSpec = {
    ...spec,
    kind: 'mono',
    colors: undefined,
    parTimeSec: parTimeSec(spec.width, spec.height),
    gen: { density: 0.45, budget: 3000 },
  };
  const fb = generateLevel(fallbackSpec, rng);
  if (!fb.level) throw new Error('daily generation failed for ' + dateStr);
  saveDailyCache(key, { dateStr, colored: false, rows: gridToStrings(fb.level.solution) });
  return fb.level;
}

export function todayKeyOf(dateStr = todayStr()): string {
  return todayCompact(new Date(dateStr + 'T00:00:00'));
}
