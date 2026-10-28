import { stringsToGrid, trimBorderEmpty } from '../core/grid.js';
import { deriveClues } from '../core/clues.js';
import { SOLUTIONS } from './solutions.js';
export function buildLevelFromSpec(spec) {
    const rows = SOLUTIONS[spec.id];
    if (!rows)
        throw new Error(`missing embedded solution for level ${spec.id} (run npm run gen-levels)`);
    const raw = stringsToGrid(rows);
    // 剪影/挑战：内嵌解按"裁掉贴边空行列"写入；构建时再防御性裁一次，保证紧网格不变量
    const t = spec.kind === 'silhouette' || spec.type === 'challenge' ? trimBorderEmpty(raw) : { grid: raw, w: raw[0].length, h: raw.length };
    const solution = t.grid;
    const w = t.w;
    const h = t.h;
    if (w > spec.width || h > spec.height) {
        throw new Error(`solution size mismatch for ${spec.id}`);
    }
    const clues = deriveClues(solution, w, h, {
        diagonalEnabled: spec.diagonalEnabled,
        diagonalDirections: spec.diagonalEnabled ? (spec.diagonalDirections ?? ['main', 'anti']) : undefined,
    });
    return {
        id: spec.id,
        kind: spec.kind,
        width: w,
        height: h,
        colors: spec.colors,
        diagonalEnabled: spec.diagonalEnabled,
        diagonalDirections: spec.diagonalDirections,
        solution,
        clues,
        parTimeSec: spec.parTimeSec,
        type: spec.type,
        index: spec.index,
        title: spec.title,
        tutorial: spec.tutorial,
    };
}
