// 彩色规则采样 — 规格 §7.5「彩色」：随机分配颜色区域（生成形状后上色）。
// 两种模式：
//  · voronoi（默认）：随机种子点 Voronoi 区域 → 部分区域置空 → 其余区域循环上色。
//    大块混合、异色可紧邻，用于后期（难度更高）。
//  · separate（教学过渡）：随机生长同色色块，色块之间强制 1 格空隙（四向），
//    图案 = 清晰分离的色斑，读数简单，用于玩家刚接触彩色规则的关卡。
// 线索由 deriveRuns 从实际网格推导，天然满足 §2.3 段间规则（极大同色段）。
import type { ColorId } from '../state/types.js';
import type { Matrix } from '../core/grid.js';
import { createGrid, hasEmptyLine } from '../core/grid.js';
import type { RNG } from '../core/prng.js';
import { randInt, shuffle } from '../core/prng.js';

export function sampleColored(
  rng: RNG,
  w: number,
  h: number,
  colors: ColorId[],
  density = 0.62
): Matrix {
  for (let attempt = 0; attempt < 8; attempt++) {
    const g = sampleOnce(rng, w, h, colors, density);
    if (g) return g;
  }
  // 兜底：简单条纹（仍会经唯一解校验，不合格会被生成器丢弃重试）
  const g = createGrid(w, h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) g[y][x] = (x + y) % 3 === 0 ? 0 : colors[(x + y) % colors.length];
  return g;
}

function sampleOnce(
  rng: RNG,
  w: number,
  h: number,
  colors: ColorId[],
  density: number
): Matrix | null {
  const nRegions = Math.max(colors.length * 2, Math.round((w * h) / 10)) + randInt(rng, 5);
  const seeds: Array<[number, number]> = [];
  for (let i = 0; i < nRegions; i++) seeds.push([randInt(rng, w), randInt(rng, h)]);

  // 每格归属最近种子（欧氏距离 + 轻微抖动 → 边界不规则）
  const region = new Int16Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let bestR = 0;
      let bestD = Infinity;
      for (let r = 0; r < nRegions; r++) {
        const dx = x - seeds[r][0];
        const dy = y - seeds[r][1];
        const d = dx * dx + dy * dy;
        if (d < bestD) {
          bestD = d;
          bestR = r;
        }
      }
      region[y * w + x] = bestR;
    }
  }

  // 区域 → 空 / 颜色
  const regionVal: ColorId[] = new Array(nRegions).fill(0);
  const order = shuffle(rng, Array.from({ length: nRegions }, (_, i) => i));
  const emptyTarget = Math.round(nRegions * (1 - density) * 1.25);
  const colorOrder = shuffle(rng, colors.slice());
  let ci = 0;
  for (let i = 0; i < nRegions; i++) {
    const r = order[i];
    if (i < emptyTarget) regionVal[r] = 0;
    else {
      regionVal[r] = colorOrder[ci % colorOrder.length];
      ci++;
    }
  }
  // 每种颜色至少出现一次（区域层面保证；格层面下面校验）
  for (const c of colors) {
    if (!regionVal.some((v) => v === c)) {
      // 找一个非空大区域改色
      for (const r of order) {
        if (regionVal[r] !== 0) {
          regionVal[r] = c;
          break;
        }
      }
    }
  }

  const g = createGrid(w, h);
  const colorCount = new Map<ColorId, number>();
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const v = regionVal[region[y * w + x]];
      g[y][x] = v;
      if (v !== 0) colorCount.set(v, (colorCount.get(v) ?? 0) + 1);
    }
  }
  // 校验：每种颜色格数 ≥2（避免孤零单格色）、总体密度合理、无整行/整列全空
  for (const c of colors) if ((colorCount.get(c) ?? 0) < 2) return null;
  let filled = 0;
  for (const v of colorCount.values()) filled += v;
  const ratio = filled / (w * h);
  if (ratio < 0.3 || ratio > 0.8) return null;
  if (hasEmptyLine(g, w, h)) return null;
  return g;
}

// ---------- 分离色块（教学过渡模式） ----------

/** 采样"分离色块"网格：若干同色连通斑，彼此间留 ≥1 格空隙（四向），
 *  因此任何异色（乃至同色不同块）都不会紧邻。失败（校验不过）返回 null，
 *  由生成器重试。 */
export function sampleSeparated(
  rng: RNG,
  w: number,
  h: number,
  colors: ColorId[],
  density = 0.55
): Matrix | null {
  for (let attempt = 0; attempt < 10; attempt++) {
    const g = separatedOnce(rng, w, h, colors, density);
    if (g) return g;
  }
  return null;
}

const DIRS4: ReadonlyArray<readonly [number, number]> = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

function separatedOnce(
  rng: RNG,
  w: number,
  h: number,
  colors: ColorId[],
  density: number
): Matrix | null {
  const g = createGrid(w, h);
  // near=1：已填 或 与已填四向相邻（新块禁入 → 保证 ≥1 格护沟）
  const near = new Uint8Array(w * h);
  const target = Math.round(w * h * density);
  const colorCount = new Map<ColorId, number>();
  let filled = 0;

  const freeSeeds: number[] = [];
  let guard = 0;
  while (filled < target && guard++ < 400) {
    // 找一个不在护沟内的种子
    freeSeeds.length = 0;
    for (let i = 0; i < w * h; i++) if (!near[i]) freeSeeds.push(i);
    if (freeSeeds.length === 0) break;
    const seed = freeSeeds[randInt(rng, freeSeeds.length)];
    const color = colors[randInt(rng, colors.length)];
    // 从种子四向随机生长出 2..4 格的同色斑
    const size = 2 + randInt(rng, 3);
    const blob: number[] = [seed];
    const inBlob = new Set<number>([seed]);
    while (blob.length < size) {
      const frontier: number[] = [];
      for (const b of blob) {
        const bx = b % w;
        const by = (b / w) | 0;
        for (const [dx, dy] of DIRS4) {
          const nx = bx + dx;
          const ny = by + dy;
          if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
          const ni = ny * w + nx;
          if (inBlob.has(ni) || near[ni]) continue;
          frontier.push(ni);
        }
      }
      if (frontier.length === 0) break;
      const pick = frontier[randInt(rng, frontier.length)];
      inBlob.add(pick);
      blob.push(pick);
    }
    // 落块并扩大护沟
    for (const b of blob) {
      const bx = b % w;
      const by = (b / w) | 0;
      g[by][bx] = color;
      filled++;
      colorCount.set(color, (colorCount.get(color) ?? 0) + 1);
      near[b] = 1;
      for (const [dx, dy] of DIRS4) {
        const nx = bx + dx;
        const ny = by + dy;
        if (nx >= 0 && nx < w && ny >= 0 && ny < h) near[ny * w + nx] = 1;
      }
    }
  }

  // 校验：每色 ≥3 格、密度区间、无整行/整列全空
  for (const c of colors) if ((colorCount.get(c) ?? 0) < 3) return null;
  const ratio = filled / (w * h);
  if (ratio < 0.34 || ratio > 0.72) return null;
  if (hasEmptyLine(g, w, h)) return null;
  return g;
}
