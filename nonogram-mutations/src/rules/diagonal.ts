// 对角线规则 — 规格 §2.4 / §7.5「对角线（黑白）」
// 核心判定：优先"行列单独不唯一、加对角线后唯一"（对角线线索承重）；
// 找不到则退化为"冗余但唯一"（由 generator 的预算循环控制）。
import type { Clues, DiagDir } from '../state/types.js';
import type { Matrix } from '../core/grid.js';
import { deriveClues } from '../core/clues.js';
import { countSolutions } from '../core/solver.js';

export interface DiagVerdict {
  /** 全部线索（行列+对角线）联合唯一解 */
  unique: boolean;
  /** 行列单独已唯一（此时对角线冗余，不承重） */
  rowsColsUnique: boolean;
  /** 承重：行列不唯一、加对角线后唯一 */
  loadBearing: boolean;
}

export function verdictForDiagonal(
  sol: Matrix,
  w: number,
  h: number,
  dirs: DiagDir[],
  kColors: number
): DiagVerdict {
  const full: Clues = deriveClues(sol, w, h, { diagonalEnabled: true, diagonalDirections: dirs });
  const rc = countSolutions(w, h, { rows: full.rows, cols: full.cols }, kColors, {
    families: ['row', 'col'],
    limit: 2,
  });
  if (!rc.budgetExceeded && rc.count === 0) {
    // 理论不可达（解自身满足行列线索）；防御性返回
    return { unique: false, rowsColsUnique: false, loadBearing: false };
  }
  if (!rc.budgetExceeded && rc.count === 1) {
    return { unique: true, rowsColsUnique: true, loadBearing: false };
  }
  const all = countSolutions(w, h, full, kColors, { limit: 2 });
  const unique = !all.budgetExceeded && all.count === 1;
  return { unique, rowsColsUnique: false, loadBearing: unique };
}

/** 对角线关卡采样密度建议（偏稀疏一点，行列更易"不唯一"，对角线更易承重） */
export function diagonalDensity(kColors: number, base = 0.46): number {
  return kColors === 1 ? base : base + 0.1;
}
