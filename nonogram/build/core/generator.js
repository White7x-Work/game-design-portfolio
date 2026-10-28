import { deriveClues } from './clues.js';
import { countSolutions, isUnique } from './solver.js';
import { trimBorderEmpty } from './grid.js';
import { sampleMono } from '../rules/mono.js';
import { sampleColored, sampleSeparated } from '../rules/colored.js';
import { verdictForDiagonal, diagonalDensity } from '../rules/diagonal.js';
import { getTemplate, placeTemplate, tplWidth, tplHeight, POOL_MONO_BIG, POOL_COLORED } from '../rules/silhouette.js';
/** 剪影/挑战关：裁掉贴边的全空行列（"多余无用行列"），线索/唯一性按裁剪后网格校验 */
function maybeTrim(spec, sol) {
    if (spec.kind === 'silhouette' || spec.type === 'challenge')
        return trimBorderEmpty(sol);
    return { grid: sol, w: spec.width, h: spec.height };
}
export function kColorsOf(spec) {
    return spec.colors && spec.colors.length > 0 ? Math.max(...spec.colors) : 1;
}
/** 默认确定性迭代预算（按规则复杂度，§7.4：挑战彩色×对角线给更大预算） */
export function defaultBudget(spec) {
    const k = kColorsOf(spec);
    if (spec.template)
        return 300; // 模板放置重试（唯一解失败率相对低）
    if (spec.diagonalEnabled)
        return k > 1 ? 1500 : 400;
    if (k > 1)
        return 800;
    return 500;
}
function isColoredSpec(spec) {
    return !!spec.colors && spec.colors.length > 1;
}
/** 单次采样（§7.5 分派） */
function sampleOnce(spec, rng, pool) {
    const w = spec.width;
    const h = spec.height;
    // 模板（剪影 / 教学迷你图案）
    const templateId = pool && pool.length > 0 ? pool[Math.floor(rng() * pool.length)] : spec.template;
    if (templateId) {
        return placeTemplate(getTemplate(templateId), w, h, rng);
    }
    if (isColoredSpec(spec)) {
        // 教学过渡：分离色块（gen.separate）；否则 Voronoi 大块混合。密度均可由 gen.density 指定
        if (spec.gen?.separate) {
            return sampleSeparated(rng, w, h, spec.colors, spec.gen.density ?? 0.55);
        }
        return sampleColored(rng, w, h, spec.colors, spec.gen?.density ?? 0.62);
    }
    // 对角线关卡：默认取对角建议密度，但 gen.density 可覆盖（m17/18 用更低的 0.40）
    const base = spec.diagonalEnabled
        ? (spec.gen?.density ?? diagonalDensity(kColorsOf(spec)))
        : (spec.gen?.density ?? 0.5);
    const density = Math.min(0.72, Math.max(0.3, base + (rng() - 0.5) * 0.14));
    return sampleMono(rng, w, h, density);
}
/** 同步生成（dev 工具 / 缓存未命中时用）。失败（超预算）返回 level=null，
 *  调用方按 §7.4 兜底：换模板/种子/降网格，或使用内嵌数据（人工兜底）。 */
export function generateLevel(spec, rng, pool) {
    const k = kColorsOf(spec);
    const budget = spec.gen?.budget ?? defaultBudget(spec);
    const dirs = spec.diagonalDirections ?? ['main', 'anti'];
    const preferLB = spec.diagonalEnabled && k === 1 && (spec.gen?.preferLoadBearing ?? true);
    let fallback = null; // 冗余但唯一（§7.5 退化）
    for (let iter = 0; iter < budget; iter++) {
        const raw = sampleOnce(spec, rng, pool);
        if (!raw)
            continue;
        const t = maybeTrim(spec, raw);
        const sol = t.grid;
        const w = t.w;
        const h = t.h;
        const clues = deriveClues(sol, w, h, {
            diagonalEnabled: spec.diagonalEnabled,
            diagonalDirections: spec.diagonalEnabled ? dirs : undefined,
        });
        if (spec.diagonalEnabled && preferLB) {
            const v = verdictForDiagonal(sol, w, h, dirs, k);
            if (!v.unique)
                continue;
            if (v.loadBearing) {
                return { level: finish(spec, sol, clues, w, h), iters: iter + 1, loadBearing: true };
            }
            if (!fallback)
                fallback = t;
            continue;
        }
        if (!isUnique(w, h, clues, k))
            continue;
        return { level: finish(spec, sol, clues, w, h), iters: iter + 1, loadBearing: preferLB ? false : undefined };
    }
    if (fallback) {
        const clues = deriveClues(fallback.grid, fallback.w, fallback.h, {
            diagonalEnabled: true,
            diagonalDirections: dirs,
        });
        return { level: finish(spec, fallback.grid, clues, fallback.w, fallback.h), iters: budget, loadBearing: false };
    }
    return { level: null, iters: budget };
}
function finish(spec, solution, clues, w, h) {
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
/** 异步分块生成（运行时"换一题"/每日一题用，避免长任务卡 UI）。
 *  结果与同步版完全一致（同一 rng 调用序列，仅让出事件循环）。 */
export async function generateLevelAsync(spec, rng, pool, onProgress) {
    const k = kColorsOf(spec);
    const budget = spec.gen?.budget ?? defaultBudget(spec);
    const dirs = spec.diagonalDirections ?? ['main', 'anti'];
    const preferLB = spec.diagonalEnabled && k === 1 && (spec.gen?.preferLoadBearing ?? true);
    let fallback = null;
    let chunkStart = performance.now();
    for (let iter = 0; iter < budget; iter++) {
        if (performance.now() - chunkStart > 24) {
            onProgress?.(iter, budget);
            await new Promise((r) => setTimeout(r, 0));
            chunkStart = performance.now();
        }
        const raw = sampleOnce(spec, rng, pool);
        if (!raw)
            continue;
        const t = maybeTrim(spec, raw);
        const sol = t.grid;
        const w = t.w;
        const h = t.h;
        const clues = deriveClues(sol, w, h, {
            diagonalEnabled: spec.diagonalEnabled,
            diagonalDirections: spec.diagonalEnabled ? dirs : undefined,
        });
        if (spec.diagonalEnabled && preferLB) {
            const v = verdictForDiagonal(sol, w, h, dirs, k);
            if (!v.unique)
                continue;
            if (v.loadBearing)
                return { level: finish(spec, sol, clues, w, h), iters: iter + 1, loadBearing: true };
            if (!fallback)
                fallback = t;
            continue;
        }
        if (!isUnique(w, h, clues, k))
            continue;
        return { level: finish(spec, sol, clues, w, h), iters: iter + 1 };
    }
    if (fallback) {
        const clues = deriveClues(fallback.grid, fallback.w, fallback.h, {
            diagonalEnabled: true,
            diagonalDirections: dirs,
        });
        return { level: finish(spec, fallback.grid, clues, fallback.w, fallback.h), iters: budget, loadBearing: false };
    }
    return { level: null, iters: budget };
}
/** 再生成（§10.2：同规则、新种子、唯一解）。新种子 → 新题；模板关从同池换形状。
 *  剪影/挑战的实际棋盘为裁掉贴边空行列后的紧网格（尺寸跟随图形）。 */
export function regenSpec(spec) {
    return { ...spec, gen: { ...spec.gen, budget: undefined } };
}
/** 再生成（换一题）池：只保留与关卡网格足够贴合的模板（每轴空隙 ≤4），
 *  避免换出大片空白行/列；若全部被过滤则退回完整池。 */
export function poolFor(spec) {
    if (!spec.template)
        return undefined;
    const k = kColorsOf(spec);
    const base = k > 1 ? POOL_COLORED : POOL_MONO_BIG;
    const snug = base.filter((id) => {
        const t = getTemplate(id);
        return (tplWidth(t) <= spec.width &&
            tplHeight(t) <= spec.height &&
            spec.width - tplWidth(t) <= 4 &&
            spec.height - tplHeight(t) <= 4);
    });
    return snug.length > 0 ? snug : base;
}
export { countSolutions };
