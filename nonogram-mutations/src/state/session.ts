// 单局求解状态 — 规格 §4（失误/X 标记）+ §5（工具行为）
import type { ColorId, Level } from './types.js';
import { deriveRuns } from '../core/clues.js';
import type { Run } from './types.js';

export type Tool = 'fill' | 'mark' | 'erase';

export interface ApplyResult {
  mistake: boolean;
  won: boolean;
  changed: boolean;
}

export class Session {
  readonly level: Level;
  readonly w: number;
  readonly h: number;
  /** 玩家填色（0..K）；X 标记单独一层（X 是笔记不是填色，§4） */
  readonly values: Uint8Array;
  readonly marks: Uint8Array;
  tool: Tool = 'fill';
  color: ColorId = 1;
  /** 累计失误次数（一旦发生，零失误星永久失去，§4） */
  mistakeCount = 0;
  won = false;
  /** 练习模式（换一题）：不计进度 */
  practice: boolean;

  private startedMs = 0;
  private accumulatedMs = 0;
  private running = false;

  constructor(level: Level, practice = false) {
    this.level = level;
    this.w = level.width;
    this.h = level.height;
    this.values = new Uint8Array(this.w * this.h);
    this.marks = new Uint8Array(this.w * this.h);
    this.practice = practice;
    this.color = level.colors?.[0] ?? 1;
  }

  // ---------- 计时（首次操作起算；暂停/隐藏不计） ----------
  private ensureStarted(): void {
    if (!this.startedMs) {
      this.startedMs = performance.now();
      this.running = true;
    }
  }
  pause(): void {
    if (this.running) {
      this.accumulatedMs += performance.now() - this.startedMs;
      this.running = false;
    }
  }
  resume(): void {
    if (!this.won) {
      this.startedMs = performance.now();
      this.running = true;
    }
  }
  timeSec(): number {
    let ms = this.accumulatedMs;
    if (this.running) ms += performance.now() - this.startedMs;
    return Math.floor(ms / 1000);
  }

  // ---------- 格子操作 ----------
  idx(x: number, y: number): number {
    return y * this.w + x;
  }
  sol(i: number): ColorId {
    const { solution, width } = this.level;
    return solution[Math.floor(i / width)][i % width];
  }
  /** 失误红标显示条件（§4）：填了与 solution 不符的确定性颜色 */
  isMistakeAt(i: number): boolean {
    return this.values[i] !== 0 && this.values[i] !== this.sol(i);
  }

  /** 按当前工具应用（点按/拖动连续应用） */
  applyTool(i: number, tool: Tool = this.tool, color: ColorId = this.color): ApplyResult {
    if (this.won) return { mistake: false, won: true, changed: false };
    this.ensureStarted();
    let changed = false;
    let mistake = false;
    if (tool === 'fill') {
      const c = this.level.colors && this.level.colors.length > 1 ? color : 1;
      if (this.values[i] !== c || this.marks[i]) {
        this.marks[i] = 0;
        if (this.values[i] !== c) {
          this.values[i] = c;
          if (c !== this.sol(i)) {
            mistake = true;
            this.mistakeCount++;
          }
        }
        changed = true;
      }
    } else if (tool === 'mark') {
      this.toggleMarkTool(i);
      changed = true;
    } else {
      // erase：清空填色与 X
      if (this.values[i] !== 0 || this.marks[i]) {
        this.values[i] = 0;
        this.marks[i] = 0;
        changed = true;
      }
    }
    const won = this.checkWin();
    if (won && !this.won) {
      this.won = true;
      this.pause();
    }
    return { mistake, won: this.won, changed };
  }

  /** 切换 X 标记（长按/右键/标记工具）。X 永不计失误（§4）。 */
  toggleMark(i: number, force?: boolean): void {
    if (this.won) return;
    this.ensureStarted();
    if (force === true) {
      this.marks[i] = 1;
      this.values[i] = 0;
    } else if (this.marks[i]) {
      this.marks[i] = 0;
    } else {
      this.marks[i] = 1;
      this.values[i] = 0;
    }
  }

  /** mark 工具的点按行为 = 切换 */
  private toggleMarkTool(i: number): void {
    if (this.marks[i]) this.marks[i] = 0;
    else {
      this.marks[i] = 1;
      this.values[i] = 0;
    }
  }

  checkWin(): boolean {
    const { solution, width } = this.level;
    for (let y = 0; y < this.h; y++) {
      const row = solution[y];
      for (let x = 0; x < width; x++) {
        if (this.values[y * width + x] !== row[x]) return false;
      }
    }
    return true;
  }

  // ---------- 线索完成态（渲染变灰用，纯 QoL，不改规则） ----------
  private runsEqual(a: Run[], b: Run[]): boolean {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (a[i].color !== b[i].color || a[i].len !== b[i].len) return false;
    return true;
  }

  rowDone(y: number): boolean {
    const vals: ColorId[] = [];
    for (let x = 0; x < this.w; x++) vals.push(this.values[y * this.w + x]);
    return this.runsEqual(deriveRuns(vals), this.level.clues.rows[y]);
  }
  colDone(x: number): boolean {
    const vals: ColorId[] = [];
    for (let y = 0; y < this.h; y++) vals.push(this.values[y * this.w + x]);
    return this.runsEqual(deriveRuns(vals), this.level.clues.cols[x]);
  }
  /** 对角线（含"未显示=全空"约束）完成态 */
  diagDone(cells: Array<[number, number]>, clue: Run[] | undefined): boolean {
    const vals = cells.map(([x, y]) => this.values[y * this.w + x]);
    return this.runsEqual(deriveRuns(vals), clue ?? []);
  }
}

