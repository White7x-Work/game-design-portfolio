import { deriveClues } from '../core/clues.js';
import { countSolutions } from '../core/solver.js';
export function verdictForDiagonal(sol, w, h, dirs, kColors) {
    const full = deriveClues(sol, w, h, { diagonalEnabled: true, diagonalDirections: dirs });
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
export function diagonalDensity(kColors, base = 0.46) {
    return kColors === 1 ? base : base + 0.1;
}
