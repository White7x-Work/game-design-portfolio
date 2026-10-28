import { createGrid, hasEmptyLine } from '../core/grid.js';
/** 采样一个 w×h 黑白网格；density 为目标填色比例（0..1）。
 *  硬约束：非全空、非近全满；软约束（尽量）：无任何整行/整列全空。 */
export function sampleMono(rng, w, h, density = 0.5) {
    let best = null;
    for (let attempt = 0; attempt < 10; attempt++) {
        let g = createGrid(w, h);
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                g[y][x] = rng() < density ? 1 : 0;
            }
        }
        g = smoothPass(g, w, h);
        const filled = countFilled(g, w, h);
        const ratio = filled / (w * h);
        if (ratio < 0.18 || ratio > 0.82)
            continue;
        if (!hasEmptyLine(g, w, h))
            return g;
        if (!best)
            best = g;
    }
    return best ?? createGrid(w, h, 1); // 兜底（几乎不可达；生成器仍会做唯一解校验）
}
/** 一次 majority 平滑：9 邻域（含自身）填色数 ≥5 → 填；≤3 → 空；否则保持 */
function smoothPass(g, w, h) {
    const out = createGrid(w, h);
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            let n = 0;
            for (let dy = -1; dy <= 1; dy++) {
                for (let dx = -1; dx <= 1; dx++) {
                    const nx = x + dx;
                    const ny = y + dy;
                    if (nx >= 0 && nx < w && ny >= 0 && ny < h && g[ny][nx] === 1)
                        n++;
                }
            }
            out[y][x] = n >= 5 ? 1 : n <= 3 ? 0 : g[y][x];
        }
    }
    return out;
}
function countFilled(g, w, h) {
    let n = 0;
    for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++)
            if (g[y][x] !== 0)
                n++;
    return n;
}
