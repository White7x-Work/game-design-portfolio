// 数据类型定义 — 见设计规格 §8
// 本文件是全项目共享的类型事实源。

/** 颜色/状态 id：0=空，1..K=填色（黑白关卡只有 1） */
export type ColorId = number;

/** 关卡规则类别 */
export type LevelKind = 'mono' | 'colored' | 'diagonal' | 'silhouette' | 'stack';

/** 对角线方向：main=↘主对角(d=y-x)，anti=↙副对角(d=x+y) */
export type DiagDir = 'main' | 'anti';

/** 一个连续填色段（token）：color=颜色(黑白恒为1)，len=长度 */
export interface Run {
  color: ColorId;
  len: number;
}

/** 线索集合。rows/cols 每行/列为 Run 列表（黑白 len 列表等价于 color=1 的 Run 列表）。
 *  diagMain 下标 = (y-x) + (H-1)；diagAnti 下标 = (x+y)。
 *  undefined = 未显示（该对角线全空，这是明确语义，见规格 §2.4）。 */
export interface Clues {
  rows: Run[][];
  cols: Run[][];
  diagMain?: (Run[] | undefined)[];
  diagAnti?: (Run[] | undefined)[];
}

export interface Level {
  id: string;
  kind: LevelKind;
  width: number;
  height: number;
  /** 彩色关卡色板（1..K）；黑白关卡为 [1] 或省略 */
  colors?: ColorId[];
  diagonalEnabled: boolean;
  /** diagonalEnabled 时生效；省略 = 双向 */
  diagonalDirections?: DiagDir[];
  /** H×W 唯一解 */
  solution: ColorId[][];
  /** 由 solution 推导 */
  clues: Clues;
  parTimeSec: number;
  type: 'mainline' | 'challenge' | 'daily';
  /** 主线/挑战内序号（0-based）；daily 无 */
  index?: number;
  title?: string;
  /** 教学关：首次进入时显示的教学页 id 列表 */
  tutorial?: string[];
}

/** 通关记录（星级体系已移除）：每关记录"最少失误次数"与"最佳用时" */
export interface LevelRecord {
  /** 历史最少失误次数（迁移自旧星级存档且无失误信息时可能缺省） */
  minMistakes?: number;
  /** 历史最佳用时（秒） */
  bestTimeSec: number;
}

export interface Progress {
  /** 已解锁到第几关（0-based，即下一可玩关的序号；35=主线全通） */
  unlockedMainline: number;
  unlockedChallenge: number;
  records: Record<string, LevelRecord>;
}

/** 关卡规格（生成器输入）：不含 solution/clues，由生成器补齐 */
export interface LevelSpec {
  id: string;
  kind: LevelKind;
  width: number;
  height: number;
  colors?: ColorId[];
  diagonalEnabled: boolean;
  diagonalDirections?: DiagDir[];
  parTimeSec: number;
  type: 'mainline' | 'challenge' | 'daily';
  index?: number;
  title?: string;
  tutorial?: string[];
  /** 剪影/图案模板 id（silhouette.ts 库）；省略则程序化随机采样 */
  template?: string;
  /** 生成器采样参数（密度等），见 generator.ts */
  gen?: GenOpts;
}

export interface GenOpts {
  /** 填色密度目标（黑白/剪影/彩色采样用），默认按规则取 0.5/0.62 */
  density?: number;
  /** 对角线关卡：是否优先"行列单独不唯一、加对角线后唯一"（承重），默认 true */
  preferLoadBearing?: boolean;
  /** 确定性迭代预算（采样次数上限）。必须用迭代数而非墙钟时间，保证跨设备可复现 */
  budget?: number;
  /** 彩色采样用"分离色块"：不同色块之间留 1 格空隙（早期教学，读数简单）；
   *  默认 false = Voronoi 大块混合（异色可紧邻，更接近后期难度） */
  separate?: boolean;
}
