/** 主对角线索引：d = y-x ∈ [-(H-1), W-1]，存储下标 idx = d + (H-1) ∈ [0, W+H-2] */
export function mainDiagIndex(x, y, h) {
    return y - x + (h - 1);
}
/** 副对角线索引：d = x+y ∈ [0, W+H-2] */
export function antiDiagIndex(x, y) {
    return x + y;
}
export function diagCount(w, h) {
    return w + h - 1;
}
/** 主对角线 d(存储下标 idx) 上的格子，按 NW→SE 顺序（x 递增） */
export function mainDiagCells(w, h, di) {
    const d = di - (h - 1); // d = y - x
    const cells = [];
    const xStart = Math.max(0, -d);
    const xEnd = Math.min(w - 1, h - 1 - d);
    for (let x = xStart; x <= xEnd; x++)
        cells.push([x, x + d]);
    return cells;
}
/** 副对角线 d(=idx) 上的格子，按 NE→SW 顺序（x 递减） */
export function antiDiagCells(w, h, di) {
    const d = di; // d = x + y
    const cells = [];
    const xStart = Math.min(w - 1, d);
    const xEnd = Math.max(0, d - (h - 1));
    for (let x = xStart; x >= xEnd; x--)
        cells.push([x, d - x]);
    return cells;
}
/** 一维值序列 → 极大同色连续段列表（§2.2/§2.3 通用；0=空跳过）。
 *  推导出的 Run 序列天然满足"同色段之间 ≥1 空格"（极大性保证）。 */
export function deriveRuns(values) {
    const runs = [];
    let i = 0;
    const n = values.length;
    while (i < n) {
        const c = values[i];
        // 防御：仅 ≥1 的整数视为填色（NaN/0/负数一律当空跳过，保证前进）
        if (!(c >= 1)) {
            i++;
            continue;
        }
        let len = 0;
        while (i < n && values[i] === c) {
            len++;
            i++;
        }
        runs.push({ color: c, len });
    }
    return runs;
}
/** 从解推导全部线索。未显示的对角线 = undefined（全空语义）。 */
export function deriveClues(sol, w, h, opts) {
    const rows = [];
    for (let y = 0; y < h; y++)
        rows.push(deriveRuns(sol[y]));
    const cols = [];
    for (let x = 0; x < w; x++) {
        const col = [];
        for (let y = 0; y < h; y++)
            col.push(sol[y][x]);
        cols.push(deriveRuns(col));
    }
    const clues = { rows, cols };
    if (opts.diagonalEnabled) {
        const dirs = opts.diagonalDirections ?? ['main', 'anti'];
        const n = diagCount(w, h);
        if (dirs.includes('main')) {
            const dm = new Array(n);
            for (let di = 0; di < n; di++) {
                const vals = mainDiagCells(w, h, di).map(([x, y]) => sol[y][x]);
                const runs = deriveRuns(vals);
                // 显示规则：只显示"至少穿过 1 个非空格"的对角线（§2.4）
                dm[di] = runs.length > 0 ? runs : undefined;
            }
            clues.diagMain = dm;
        }
        if (dirs.includes('anti')) {
            const da = new Array(n);
            for (let di = 0; di < n; di++) {
                const vals = antiDiagCells(w, h, di).map(([x, y]) => sol[y][x]);
                const runs = deriveRuns(vals);
                da[di] = runs.length > 0 ? runs : undefined;
            }
            clues.diagAnti = da;
        }
    }
    return clues;
}
/** 把 Clues 展开为全部约束线（含未显示对角线的"全空"约束） */
export function buildLines(w, h, clues) {
    const lines = [];
    for (let y = 0; y < h; y++) {
        const cells = [];
        for (let x = 0; x < w; x++)
            cells.push(y * w + x);
        lines.push({ cells, clue: clues.rows[y], family: 'row', lineIdx: y });
    }
    for (let x = 0; x < w; x++) {
        const cells = [];
        for (let y = 0; y < h; y++)
            cells.push(y * w + x);
        lines.push({ cells, clue: clues.cols[x], family: 'col', lineIdx: x });
    }
    const n = diagCount(w, h);
    if (clues.diagMain) {
        for (let di = 0; di < n; di++) {
            const cells = mainDiagCells(w, h, di).map(([x, y]) => y * w + x);
            // undefined（未显示）→ [] 全空约束（§2.4 明确语义）
            lines.push({ cells, clue: clues.diagMain[di] ?? [], family: 'main', lineIdx: di });
        }
    }
    if (clues.diagAnti) {
        for (let di = 0; di < n; di++) {
            const cells = antiDiagCells(w, h, di).map(([x, y]) => y * w + x);
            lines.push({ cells, clue: clues.diagAnti[di] ?? [], family: 'anti', lineIdx: di });
        }
    }
    return lines;
}
/** 线索的紧凑文本（渲染/调试）："3"、"2 4"、彩色 "R3 B2" */
export function runsToText(runs) {
    if (runs.length === 0)
        return '';
    const colorAllOne = runs.every((r) => r.color === 1);
    if (colorAllOne)
        return runs.map((r) => String(r.len)).join(' ');
    const names = ['', 'R', 'B', 'G', 'Y', 'P'];
    return runs.map((r) => `${names[r.color] ?? r.color}${r.len}`).join(' ');
}
