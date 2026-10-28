// 回溯求解器 + 唯一性校验 — 规格 §7.3
// 算法：线约束候选枚举 + 一致性传播（constraint propagation），传播停滞时按
// "候选值最少的格子"分支回溯。计数解时找满 limit 即停（唯一性校验 limit=2，
// count==1 即唯一，见 §7.3 "不能找到第一个就停"——我们数到 2 才停）。
import type { Clues, Run } from '../state/types.js';
import { buildLines, type Line } from './clues.js';

export const UNKNOWN = 255;

/** 单条线枚举放置数上限：超过则本线不做 deductions（保持可靠声：只会少推导，不会错推导） */
const PLACEMENT_CAP = 200000;

export type Family = Line['family'];

export interface SolveResult {
  /** 找到的解数量（≤ limit） */
  count: number;
  /** 第一个解（扁平网格，值 0..K），未找到为 null */
  first: Uint8Array | null;
  /** DFS 节点预算耗尽（结果不完整）。唯一性校验时应视为"不唯一"（保守安全）。 */
  budgetExceeded: boolean;
}

interface LineBuf {
  line: Line;
  cells: Int32Array;
  /** needAfter[t] = 从第 t 个 token 起（含段间最小空隙）所需的最少格数 */
  needAfter: Int32Array;
  /** gapMin[t] = token t 之前的最小空隙（首 token=0；与前一同色=1；异色=0，§2.3） */
  gapMin: Int32Array;
}

function prepareLine(line: Line): LineBuf {
  const cells = Int32Array.from(line.cells);
  const nTok = line.clue.length;
  const needAfter = new Int32Array(nTok + 1);
  const gapMin = new Int32Array(nTok + 1);
  for (let t = 0; t < nTok; t++) {
    gapMin[t] = t === 0 ? 0 : line.clue[t - 1].color === line.clue[t].color ? 1 : 0;
  }
  gapMin[nTok] = 0;
  needAfter[nTok] = 0;
  for (let t = nTok - 1; t >= 0; t--) {
    needAfter[t] = line.clue[t].len + gapMin[t + 1] + needAfter[t + 1];
  }
  return { line, cells, needAfter, gapMin };
}

export class Solver {
  readonly nCells: number;
  readonly allMask: number;
  private bufs: LineBuf[];
  private acc: Uint16Array; // 单线枚举的值位掩码累积缓冲（长度 = 最长线）
  private vals: Uint8Array; // 单线当前放置缓冲
  private cellMasks: Uint16Array; // 每格候选值交集掩码
  private count = 0;
  private limit: number;
  private first: Uint8Array | null = null;
  private aborted = false;
  /** 迭代统计（开发期性能观察） */
  enumCalls = 0;

  constructor(
    lines: Line[],
    nCells: number,
    /** 颜色域大小 K（值域 0..K） */
    kColors: number
  ) {
    this.nCells = nCells;
    this.allMask = (1 << (kColors + 1)) - 1;
    this.bufs = lines.map(prepareLine);
    let maxLen = 1;
    for (const l of lines) maxLen = Math.max(maxLen, l.cells.length);
    this.acc = new Uint16Array(maxLen);
    this.vals = new Uint8Array(maxLen);
    this.cellMasks = new Uint16Array(nCells);
    this.limit = 2;
  }

  /** 计数解（至多 limit 个）。limit=2 用于唯一性校验；limit=1 用于"是否有解"。 */
  countSolutions(limit: number, initial?: Uint8Array): SolveResult {
    this.limit = limit;
    this.count = 0;
    this.first = null;
    this.aborted = false;
    this.budgetExceeded = false;
    const grid = initial ? initial.slice() : new Uint8Array(this.nCells).fill(UNKNOWN);
    this.dfs(grid);
    return { count: this.count, first: this.first, budgetExceeded: this.budgetExceeded };
  }

  // ---------- 单线枚举 ----------

  /** 枚举 line 的全部合法放置（与 grid 已知格一致），结果写入 this.acc（按位 OR）。
   *  返回放置总数；超过 PLACEMENT_CAP 时返回 -1（截断，acc 不完整，不可用于推导）。 */
  private enumerate(buf: LineBuf, grid: Uint8Array): number {
    const { cells, needAfter, gapMin } = buf;
    const clue = buf.line.clue;
    const n = cells.length;
    const acc = this.acc;
    const vals = this.vals;
    this.enumCalls++;
    acc.fill(0, 0, n);
    let count = 0;
    let truncated = false;

    const rec = (t: number, p: number): void => {
      if (truncated) return;
      if (t === clue.length) {
        // 剩余必须全空
        for (let i = p; i < n; i++) {
          const kv = grid[cells[i]];
          if (kv !== UNKNOWN && kv !== 0) return;
          vals[i] = 0;
        }
        count++;
        if (count > PLACEMENT_CAP) {
          truncated = true;
          return;
        }
        for (let i = 0; i < n; i++) acc[i] |= 1 << vals[i];
        return;
      }
      const tok: Run = clue[t];
      // 段前最小空隙必须为空
      let pos = p + gapMin[t];
      for (let i = p; i < pos; i++) {
        const kv = grid[cells[i]];
        if (kv !== UNKNOWN && kv !== 0) return;
        vals[i] = 0;
      }
      const nextGapMin = gapMin[t + 1];
      for (;;) {
        if (truncated) return;
        if (pos + tok.len + nextGapMin + needAfter[t + 1] <= n) {
          // 尝试在此放置 token
          let ok = true;
          for (let j = 0; j < tok.len; j++) {
            const kv = grid[cells[pos + j]];
            if (kv !== UNKNOWN && kv !== tok.color) {
              ok = false;
              break;
            }
          }
          if (ok) {
            for (let j = 0; j < tok.len; j++) vals[pos + j] = tok.color;
            rec(t + 1, pos + tok.len);
          }
        } else {
          return; // 空间不足，更大的 gap 更放不下
        }
        // gap 加 1：当前 pos 格必须可为空
        const kv = grid[cells[pos]];
        if (kv !== UNKNOWN && kv !== 0) return;
        vals[pos] = 0;
        pos++;
      }
    };

    rec(0, 0);
    return truncated ? -1 : count;
  }

  // ---------- 传播 ----------

  /** 一致性传播。返回 true=可能仍有解（网格已就地收紧），false=矛盾。 */
  private propagate(grid: Uint8Array): boolean {
    const masks = this.cellMasks;
    masks.fill(this.allMask);
    for (let c = 0; c < this.nCells; c++) {
      const v = grid[c];
      if (v !== UNKNOWN) masks[c] = 1 << v;
    }
    let progress = true;
    while (progress) {
      progress = false;
      for (const buf of this.bufs) {
        const cnt = this.enumerate(buf, grid);
        if (cnt === 0) return false; // 矛盾
        if (cnt < 0) continue; // 截断：跳过推导（可靠性优先）
        const cells = buf.cells;
        const n = cells.length;
        for (let i = 0; i < n; i++) {
          const c = cells[i];
          if (grid[c] !== UNKNOWN) continue;
          let m = (masks[c] &= this.acc[i]);
          if (m === 0) return false; // 矛盾
          if ((m & (m - 1)) === 0) {
            // 单候选 → 确定
            grid[c] = bitIndex(m);
            progress = true;
          }
        }
      }
    }
    return true;
  }

  // ---------- DFS ----------

  /** DFS 节点安全上限（防病态输入卡死；超限 → budgetExceeded，按"不唯一"保守处理） */
  static readonly NODE_BUDGET = 400000;
  nodes = 0;
  private budgetExceeded = false;

  private dfs(grid: Uint8Array): void {
    if (this.aborted) return;
    if (++this.nodes > Solver.NODE_BUDGET) {
      this.budgetExceeded = true;
      this.aborted = true;
      return;
    }
    if (!this.propagate(grid)) return;
    // 找未知格
    let branch = -1;
    let bestSize = 99;
    let bestMask = 0;
    for (let c = 0; c < this.nCells; c++) {
      if (grid[c] !== UNKNOWN) continue;
      const m = this.cellMasks[c];
      const sz = popcount(m);
      if (sz < bestSize) {
        bestSize = sz;
        bestMask = m;
        branch = c;
        if (sz <= 2) break;
      }
    }
    if (branch < 0) {
      // 完整解
      this.count++;
      if (this.first === null) this.first = grid.slice();
      if (this.count >= this.limit) this.aborted = true;
      return;
    }
    // 按候选值分支
    let m = bestMask;
    while (m !== 0 && !this.aborted) {
      const b = m & -m;
      m ^= b;
      const g2 = grid.slice();
      g2[branch] = bitIndex(b);
      this.dfs(g2);
    }
  }
}

function bitIndex(singleBit: number): number {
  // singleBit 是 2 的幂
  switch (singleBit) {
    case 1: return 0;
    case 2: return 1;
    case 4: return 2;
    case 8: return 3;
    case 16: return 4;
    case 32: return 5;
    case 64: return 6;
    default: return 7;
  }
}

function popcount(m: number): number {
  let n = 0;
  while (m) {
    m &= m - 1;
    n++;
  }
  return n;
}

// ---------- 便捷入口 ----------

export interface CountOpts {
  /** 只计入这些约束族（默认全部）。生成器用 ['row','col'] 检查"行列单独是否唯一"。 */
  families?: Family[];
  limit?: number;
}

/** 对给定线索计数解（≤limit）。families 可过滤约束轴。 */
export function countSolutions(
  w: number,
  h: number,
  clues: Clues,
  kColors: number,
  opts: CountOpts = {}
): SolveResult {
  let lines = buildLines(w, h, clues);
  if (opts.families) {
    const set = new Set(opts.families);
    lines = lines.filter((l) => set.has(l.family));
  }
  const solver = new Solver(lines, w * h, kColors);
  return solver.countSolutions(opts.limit ?? 2);
}

/** 唯一解校验（§7.3 isUnique）：count==1 且未超节点预算（超预算按不唯一保守处理） */
export function isUnique(w: number, h: number, clues: Clues, kColors: number, opts: CountOpts = {}): boolean {
  const r = countSolutions(w, h, clues, kColors, { ...opts, limit: 2 });
  return !r.budgetExceeded && r.count === 1;
}
