// 网格数据与格子状态（§2.1）
import type { ColorId } from '../state/types.js';

export type Matrix = ColorId[][]; // H×W

export function createGrid(w: number, h: number, fill: ColorId = 0): Matrix {
  const g: Matrix = [];
  for (let y = 0; y < h; y++) g.push(new Array<ColorId>(w).fill(fill));
  return g;
}

export function cloneGrid(g: Matrix): Matrix {
  return g.map((row) => row.slice());
}

export function gridsEqual(a: Matrix, b: Matrix): boolean {
  if (a.length !== b.length) return false;
  for (let y = 0; y < a.length; y++) {
    if (a[y].length !== b[y].length) return false;
    for (let x = 0; x < a[y].length; x++) if (a[y][x] !== b[y][x]) return false;
  }
  return true;
}

/** 扁平索引：idx = y*w + x */
export function idx(w: number, x: number, y: number): number {
  return y * w + x;
}

/** 是否存在整行/整列全空（观感差且浪费线索区，采样器一律拒绝） */
export function hasEmptyLine(g: Matrix, w: number, h: number): boolean {
  for (let y = 0; y < h; y++) {
    let empty = true;
    for (let x = 0; x < w; x++)
      if (g[y][x] !== 0) {
        empty = false;
        break;
      }
    if (empty) return true;
  }
  for (let x = 0; x < w; x++) {
    let empty = true;
    for (let y = 0; y < h; y++)
      if (g[y][x] !== 0) {
        empty = false;
        break;
      }
    if (empty) return true;
  }
  return false;
}

/** 裁掉贴边的全空行/列（剪影/挑战关：删除"多余无用行列"，棋盘紧贴图形）。
 *  只裁贴边（等价于裁到填色包围盒）——内部空线是有效线索，保留。 */
export function trimBorderEmpty(g: Matrix): { grid: Matrix; w: number; h: number } {
  const h0 = g.length;
  const w0 = h0 > 0 ? g[0].length : 0;
  let minY = h0, maxY = -1, minX = w0, maxX = -1;
  for (let y = 0; y < h0; y++) {
    for (let x = 0; x < w0; x++) {
      if (g[y][x] !== 0) {
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
      }
    }
  }
  if (maxY < 0 || maxX < 0) return { grid: g, w: w0, h: h0 }; // 全空（不应发生）
  const grid: Matrix = [];
  for (let y = minY; y <= maxY; y++) grid.push(g[y].slice(minX, maxX + 1));
  return { grid, w: maxX - minX + 1, h: maxY - minY + 1 };
}

/** 紧凑字符串行（'0'/'1'/.. 每格一字符）↔ 矩阵，用于关卡数据嵌入 */
export function gridToStrings(g: Matrix): string[] {
  return g.map((row) => row.map((v) => String(v)).join(''));
}

/** 解析单元格字符：'.'/' '=空，'#'=1，数字=对应颜色 */
function parseCellChar(ch: string): ColorId {
  if (ch === '.' || ch === ' ') return 0;
  if (ch === '#') return 1;
  const v = parseInt(ch, 10);
  return Number.isFinite(v) && v >= 1 ? v : 0;
}

export function stringsToGrid(rows: string[]): Matrix {
  return rows.map((r) => r.split('').map(parseCellChar));
}

/** ASCII 预览（. = 空，数字 = 颜色），开发期人工复核形状用 */
export function gridToAscii(g: Matrix, chars = '.#2345'): string {
  return g
    .map((row) =>
      row
        .map((v) => (v === 0 ? '.' : v === 1 ? chars[1] : chars[Math.min(v, chars.length - 1)]))
        .join('')
    )
    .join('\n');
}
