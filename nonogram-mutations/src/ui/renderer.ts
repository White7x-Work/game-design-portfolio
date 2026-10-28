// 棋盘渲染：网格/行列线索/斜向延伸带/红标/X/高亮 — 规格 §6
// 斜向带布局（与行列线索同约定：带锚定在"阅读起点"端、数字沿阅读方向排列、
// 离网格最远 = 第一段）：
//   主对角 ↘（NW→SE）：带锚定 NW 端 —— d<0 顶边锚（数字带在列线索区上方），
//     d≥0 左边锚（数字带在行线索区左侧），均以虚线连接线跨过线索区；
//   副对角 ↙（NE→SW）：带锚定 NE 端 —— 顶边/右边锚，向右上延伸。
// 空斜线（未显示 = 全空，§2.4）：不画任何「空」记号；点选反馈为"有对应线索带的
// 斜线才做斜线方向的整线高亮"（↘ 蓝 / ↙ 橙，见 drawBoard §3）。
import type { Level, Run } from '../state/types.js';
import type { Session } from '../state/session.js';
import { ART } from '../config.js';
import { antiDiagCells, mainDiagCells, diagCount } from '../core/clues.js';
import { font, roundRect, textColorOn, MONO } from './theme.js';

export interface BandGeom {
  family: 'main' | 'anti';
  di: number;
  runs: Run[];
  cells: Array<[number, number]>;
  /** 每个数字的中心（cell 坐标系，可为负/超出网格） */
  nums: Array<{ x: number; y: number; run: Run }>;
  stripA: { x: number; y: number };
  stripB: { x: number; y: number };
  /** 跨过行列线索区的虚线连接（从斜线锚点连到带首） */
  connector?: { x: number; y: number };
}

export interface BoardLayout {
  cell: number;
  gridX: number;
  gridY: number;
  W: number; // grid px
  H: number;
  rowWCells: number;
  colHCells: number;
  bands: BandGeom[];
}

export interface BoardUi {
  /** 当前高亮格（hover 优先，其次 selected）；-1 = 无 */
  activeCell: number;
  showDiag: boolean;
}

/** 构建主对角 ↘ 数字带：锚定斜线 NW 端 (ax,ay)，数字沿阅读方向排列（首段最远）。 */
function buildMainBand(
  di: number,
  runs: Run[],
  cells: Array<[number, number]>,
  ax: number,
  ay: number,
  k0: number
): BandGeom {
  const b: BandGeom = {
    family: 'main',
    di,
    runs,
    cells,
    nums: [],
    stripA: { x: 0, y: 0 },
    stripB: { x: 0, y: 0 },
    connector: { x: ax, y: ay },
  };
  rebuildMainBand(b, ax, ay, k0);
  return b;
}

/** 按 k0（带首与锚点的格距）重算主带数字/带段位置。 */
function rebuildMainBand(b: BandGeom, ax: number, ay: number, k0: number): void {
  const cnt = b.runs.length;
  b.nums = b.runs.map((run, j) => {
    const k = k0 + (cnt - 1 - j); // 首段(NW 端)最远，末段贴近网格
    return { x: ax - k + 0.5, y: ay - k + 0.5, run };
  });
  b.stripA = { x: ax - k0 + 1, y: ay - k0 + 1 };
  b.stripB = { x: ax - k0 - cnt + 1, y: ay - k0 - cnt + 1 };
}

export function computeBoardLayout(
  level: Level,
  avail: { x: number; y: number; w: number; h: number },
  includeDiagMargins = true
): BoardLayout {
  const W = level.width;
  const H = level.height;
  const clues = level.clues;
  const rowWCells = Math.max(1, ...clues.rows.map((r) => r.length));
  const colHCells = Math.max(1, ...clues.cols.map((c) => c.length));

  // 带几何始终计算；收起模式（ui.showDiag=false）下只绘制激活带。
  // 空斜线（未显示=全空，§2.4）不生成任何带 —— 不画「空」记号；
  // 点选反馈改为：有对应线索带的斜线才做斜线方向的整线高亮（见 drawBoard §3）。
  const numBands: BandGeom[] = [];
  const n = diagCount(W, H);
  if (level.diagonalEnabled && clues.diagMain) {
    for (let di = 0; di < n; di++) {
      const runs = clues.diagMain[di];
      const d = di - (H - 1);
      // 锚点 = 斜线 NW 端格子：d<0 起于顶边 (−d,0)；d≥0 起于左边 (0,d)
      const ax = d < 0 ? -d : 0;
      const ay = d < 0 ? 0 : d;
      // 数字带避让线索区：顶边锚跨过列线索区，左边锚跨过行线索区
      const k0 = d < 0 ? colHCells + 1 : rowWCells + 1;
      const cells = mainDiagCells(W, H, di);
      if (runs && runs.length > 0) {
        numBands.push(buildMainBand(di, runs, cells, ax, ay, k0));
      }
    }
  }
  if (level.diagonalEnabled && clues.diagAnti) {
    for (let di = 0; di < n; di++) {
      const runs = clues.diagAnti[di];
      const d = di;
      // 锚点 = 斜线 NE 端格子：d≤W-1 起于顶边 (d,0)；d>W-1 起于右边 (W-1, d-(W-1))
      let nx: number, ny: number, k0: number;
      let connector: BandGeom['connector'];
      if (d <= W - 1) {
        nx = d;
        ny = 0;
        k0 = colHCells + 1; // 跨过列线索区
        connector = { x: nx + 1, y: 0 };
      } else {
        nx = W - 1;
        ny = d - (W - 1);
        k0 = 1;
      }
      const cells = antiDiagCells(W, H, di);
      if (runs && runs.length > 0) {
        const cnt = runs.length;
        const nums: BandGeom['nums'] = [];
        for (let j = 0; j < cnt; j++) {
          const k = k0 + (cnt - 1 - j); // 首段(NE 端)最远
          nums.push({ x: nx + k + 0.5, y: ny - k + 0.5, run: runs[j] });
        }
        numBands.push({
          family: 'anti',
          di,
          runs,
          cells,
          nums,
          stripA: { x: nx + k0, y: ny - k0 + 1 },
          stripB: { x: nx + k0 + cnt, y: ny - k0 - cnt + 1 },
          connector,
        });
      }
    }
  }

  // 主↘带重锚 NW 后与副↙带（NE 锚）共用上边距，两组数字阶梯可能交叉：
  // 确定性消解 —— 主带数字若与某副带数字落在同一格，把该主带整体沿斜线外推 1 步。
  if (clues.diagMain && clues.diagAnti) {
    const antiKeys = new Set<string>();
    for (const b of numBands) {
      if (b.family !== 'anti') continue;
      for (const nm of b.nums) antiKeys.add(Math.floor(nm.x) + ':' + Math.floor(nm.y));
    }
    for (const b of numBands) {
      if (b.family !== 'main' || b.di - (H - 1) >= 0) continue; // 左边锚的主带不与副带相遇
      let guard = 0;
      while (guard++ < 8) {
        const hit = b.nums.some((nm) => antiKeys.has(Math.floor(nm.x) + ':' + Math.floor(nm.y)));
        if (!hit) break;
        const d = b.di - (H - 1);
        const ax = d < 0 ? -d : 0;
        const ay = d < 0 ? 0 : d;
        const k0 = ax + 1 - b.stripA.x + 1; // 原 k0 + 1
        rebuildMainBand(b, ax, ay, k0);
      }
    }
  }

  const bands = numBands;

  // 边距（cell 单位）：由线索区 + 带包围盒决定（收起模式不计带边距 → 格子更大）
  let minX = 0;
  let maxX = W;
  let minY = 0;
  let maxY = H;
  if (includeDiagMargins) {
    for (const b of bands) {
      for (const p of [b.stripA, b.stripB, ...(b.connector ? [b.connector] : [])]) {
        minX = Math.min(minX, p.x);
        maxX = Math.max(maxX, p.x);
        minY = Math.min(minY, p.y);
        maxY = Math.max(maxY, p.y);
      }
      for (const nm of b.nums) {
        minX = Math.min(minX, nm.x - 0.5);
        maxX = Math.max(maxX, nm.x + 0.5);
        minY = Math.min(minY, nm.y - 0.5);
        maxY = Math.max(maxY, nm.y + 0.5);
      }
    }
  }
  const pad = 0.45;
  const leftCells = Math.max(rowWCells + 0.6, -minX + pad);
  const rightCells = Math.max(0.6, maxX - W + pad);
  const topCells = Math.max(colHCells + 0.6, -minY + pad);
  const bottomCells = Math.max(0.6, maxY - H + pad);

  const totalWCells = leftCells + W + rightCells;
  const totalHCells = topCells + H + bottomCells;
  let cell = Math.min(avail.w / totalWCells, avail.h / totalHCells);
  cell = Math.max(5, Math.min(cell, 40));

  const gridX = avail.x + (avail.w - totalWCells * cell) / 2 + leftCells * cell;
  const gridY = avail.y + (avail.h - totalHCells * cell) / 2 + topCells * cell;

  return {
    cell,
    gridX,
    gridY,
    W: W * cell,
    H: H * cell,
    rowWCells,
    colHCells,
    bands,
  };
}

// ---------- 绘制 ----------

function cellColor(level: Level, v: number): string {
  if (level.colors && level.colors.length > 1) return ART.palette[(v - 1) % ART.palette.length];
  return ART.fillBlack;
}

export function drawBoard(
  ctx: CanvasRenderingContext2D,
  level: Level,
  session: Session | null,
  layout: BoardLayout,
  ui: BoardUi
): void {
  const { cell, gridX, gridY } = layout;
  const W = level.width;
  const H = level.height;
  const showDiag = ui.showDiag;
  const colored = !!(level.colors && level.colors.length > 1);

  // 激活格 → 高亮行列 + 激活对角带
  const ac = ui.activeCell;
  const acx = ac >= 0 ? ac % W : -1;
  const acy = ac >= 0 ? Math.floor(ac / W) : -1;
  const activeMainDi = ac >= 0 ? acy - acx + (H - 1) : -1;
  const activeAntiDi = ac >= 0 ? acx + acy : -1;

  // ---- 1. 斜向延伸带（底层） ----
  for (const b of layout.bands) {
    const isMain = b.family === 'main';
    const isActive = isMain ? b.di === activeMainDi : b.di === activeAntiDi;
    if (!showDiag && !isActive) continue; // 收起模式：仅绘制激活带
    drawBand(ctx, layout, b, isMain, isActive, session, level);
  }

  // ---- 2. 行列线索 ----
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let y = 0; y < H; y++) {
    const runs = level.clues.rows[y];
    if (runs.length === 0) continue; // 空行线索渲染为空白（§2.2）
    const done = session ? session.rowDone(y) : false;
    ctx.save();
    if (done || y === acy) {
      if (done) ctx.globalAlpha = 0.32;
    }
    for (let j = 0; j < runs.length; j++) {
      const s = runs.length - 1 - j; // 末段贴近网格
      const cx = gridX - (s + 0.5) * cell;
      const cy = gridY + (y + 0.5) * cell;
      drawRunToken(ctx, runs[j], cx, cy, cell * 0.86, cell * 0.5, y === acy, colored);
    }
    ctx.restore();
    if (y === acy && !done) {
      // 行高亮描边
      ctx.save();
      ctx.strokeStyle = 'rgba(30,136,229,0.35)';
      ctx.lineWidth = 1;
      const s0 = runs.length;
      roundRect(ctx, gridX - s0 * cell + 1, gridY + y * cell + 1, s0 * cell - 2, cell - 2, 4);
      ctx.stroke();
      ctx.restore();
    }
  }
  for (let x = 0; x < W; x++) {
    const runs = level.clues.cols[x];
    if (runs.length === 0) continue;
    const done = session ? session.colDone(x) : false;
    ctx.save();
    if (done) ctx.globalAlpha = 0.32;
    for (let j = 0; j < runs.length; j++) {
      const s = runs.length - 1 - j;
      const cx = gridX + (x + 0.5) * cell;
      const cy = gridY - (s + 0.5) * cell;
      drawRunToken(ctx, runs[j], cx, cy, cell * 0.86, cell * 0.5, x === acx, colored);
    }
    ctx.restore();
    if (x === acx && !done) {
      ctx.save();
      ctx.strokeStyle = 'rgba(30,136,229,0.35)';
      ctx.lineWidth = 1;
      const s0 = runs.length;
      roundRect(ctx, gridX + x * cell + 1, gridY - s0 * cell + 1, cell - 2, s0 * cell - 2, 4);
      ctx.stroke();
      ctx.restore();
    }
  }

  // ---- 3. 网格底 + 行列高亮 ----
  ctx.fillStyle = ART.cellEmpty;
  ctx.fillRect(gridX, gridY, W * cell, H * cell);
  if (ac >= 0) {
    ctx.fillStyle = ART.highlightRowCol;
    ctx.fillRect(gridX, gridY + acy * cell, W * cell, cell);
    ctx.fillRect(gridX + acx * cell, gridY, cell, H * cell);
  }

  // 斜线高亮（点选反馈）：激活格所在的斜线"有对应线索带"时，沿斜线整条高亮，
  // 颜色跟随带族（↘ 蓝主对角 / ↙ 橙副对角）；空斜线无带不高亮 —— 遵守 §2.4"未显示=全空"，
  // 不引入「空」类记号
  if (ac >= 0 && level.diagonalEnabled) {
    const hasClue = (runs: Run[] | undefined) => !!runs && runs.length > 0;
    if (level.clues.diagMain && hasClue(level.clues.diagMain[activeMainDi])) {
      ctx.fillStyle = ART.highlightDiagMain;
      for (const [x, y] of mainDiagCells(W, H, activeMainDi)) {
        ctx.fillRect(gridX + x * cell, gridY + y * cell, cell, cell);
      }
    }
    if (level.clues.diagAnti && hasClue(level.clues.diagAnti[activeAntiDi])) {
      ctx.fillStyle = ART.highlightDiagAnti;
      for (const [x, y] of antiDiagCells(W, H, activeAntiDi)) {
        ctx.fillRect(gridX + x * cell, gridY + y * cell, cell, cell);
      }
    }
  }

  // ---- 4. 格子内容 ----
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const v = session ? session.values[i] : 0;
      const mk = session ? session.marks[i] : 0;
      const px = gridX + x * cell;
      const py = gridY + y * cell;
      if (v !== 0) {
        const wrong = session ? session.isMistakeAt(i) : false;
        ctx.fillStyle = wrong ? ART.mistake : cellColor(level, v);
        // 轻微外扩消除分数 cell 尺寸下的亚像素接缝（网格线随后覆盖边缘）
        ctx.fillRect(px - 0.25, py - 0.25, cell + 0.5, cell + 0.5);
      } else if (mk) {
        drawX(ctx, px, py, cell);
      }
    }
  }

  // ---- 5. 网格线（设备像素对齐：任意 dpr/放大倍率下边缘锐利） ----
  const dpr = ctx.getTransform().a || 1;
  ctx.save();
  // 细线
  let lwDev = Math.max(1, Math.round(dpr));
  ctx.strokeStyle = ART.cellBorder;
  ctx.lineWidth = lwDev / dpr;
  ctx.beginPath();
  for (let x = 1; x < W; x++) {
    if (x % 5 === 0) continue;
    const vx = crispPos(gridX + x * cell, dpr, lwDev);
    ctx.moveTo(vx, gridY);
    ctx.lineTo(vx, gridY + H * cell);
  }
  for (let y = 1; y < H; y++) {
    if (y % 5 === 0) continue;
    const vy = crispPos(gridY + y * cell, dpr, lwDev);
    ctx.moveTo(gridX, vy);
    ctx.lineTo(gridX + W * cell, vy);
  }
  ctx.stroke();
  // 5 格粗线（辅助数格）：宽度随格子比例收敛，放大布局时保持精致
  lwDev = Math.max(2, Math.round(Math.min(2.2, Math.max(1.4, cell * 0.04)) * dpr));
  ctx.strokeStyle = '#ACACA4';
  ctx.lineWidth = lwDev / dpr;
  ctx.beginPath();
  for (let x = 5; x < W; x += 5) {
    const vx = crispPos(gridX + x * cell, dpr, lwDev);
    ctx.moveTo(vx, gridY);
    ctx.lineTo(vx, gridY + H * cell);
  }
  for (let y = 5; y < H; y += 5) {
    const vy = crispPos(gridY + y * cell, dpr, lwDev);
    ctx.moveTo(gridX, vy);
    ctx.lineTo(gridX + W * cell, vy);
  }
  ctx.stroke();
  // 外框
  lwDev = Math.max(2, Math.round(Math.min(3, Math.max(1.8, cell * 0.05)) * dpr));
  ctx.strokeStyle = '#8A8A82';
  ctx.lineWidth = lwDev / dpr;
  ctx.strokeRect(
    crispPos(gridX, dpr, lwDev),
    crispPos(gridY, dpr, lwDev),
    Math.round(W * cell * dpr) / dpr,
    Math.round(H * cell * dpr) / dpr
  );
  ctx.restore();

  // ---- 6. 激活格描边 ----
  if (ac >= 0) {
    ctx.save();
    const slwDev = Math.max(2, Math.round(2 * dpr));
    ctx.strokeStyle = ART.accent;
    ctx.lineWidth = slwDev / dpr;
    const sx = crispPos(gridX + acx * cell + 1, dpr, slwDev);
    const sy = crispPos(gridY + acy * cell + 1, dpr, slwDev);
    ctx.strokeRect(sx, sy, cell - 2, cell - 2);
    ctx.restore();
  }
}

/** 把线中心对齐到设备像素网格：奇数设备线宽取半像素偏移，偶数取整 → 边缘不发虚 */
function crispPos(cssV: number, dpr: number, lwDev: number): number {
  const dev = Math.round(cssV * dpr) + (lwDev % 2 === 1 ? 0.5 : 0);
  return dev / dpr;
}

function drawBand(
  ctx: CanvasRenderingContext2D,
  layout: BoardLayout,
  b: BandGeom,
  isMain: boolean,
  isActive: boolean,
  session: Session | null,
  level: Level
): void {
  const { cell, gridX, gridY } = layout;
  const px = (p: { x: number; y: number }) => ({ x: gridX + p.x * cell, y: gridY + p.y * cell });
  const bg = isMain ? ART.diagMainBg : ART.diagAntiBg;
  const done = session ? session.diagDone(b.cells, b.runs) : false;

  ctx.save();
  if (done) ctx.globalAlpha = 0.35;

  // 连接线（顶边/左边锚定的带跨过列/行线索区，连到斜线锚点）
  if (b.connector) {
    const c0 = px(b.connector);
    const a = px(b.stripA);
    ctx.strokeStyle = bg;
    ctx.lineWidth = Math.max(2, cell * 0.16);
    ctx.setLineDash([cell * 0.18, cell * 0.22]);
    ctx.beginPath();
    ctx.moveTo(c0.x, c0.y);
    ctx.lineTo(a.x, a.y);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // 带底
  const a = px(b.stripA);
  const z = px(b.stripB);
  ctx.strokeStyle = bg;
  ctx.lineWidth = cell * 0.86;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(z.x, z.y);
  ctx.stroke();
  if (isActive) {
    ctx.strokeStyle = isMain ? 'rgba(30,136,229,0.55)' : 'rgba(251,140,0,0.55)';
    ctx.lineWidth = cell * 0.92;
    ctx.globalAlpha = (done ? 0.35 : 1) * 0.35;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(z.x, z.y);
    ctx.stroke();
    ctx.globalAlpha = done ? 0.35 : 1;
  }
  ctx.lineCap = 'butt';

  // 数字（字号略小于行列线索，§6）
  const colored = !!(level.colors && level.colors.length > 1);
  for (const nm of b.nums) {
    const p = px(nm);
    drawRunToken(ctx, nm.run, p.x, p.y, cell * 0.8, cell * 0.42, isActive, colored);
  }
  ctx.restore();
}

/** 线索 token：黑白 = 纯数字；彩色 = 色块 chip + 数字 */
function drawRunToken(
  ctx: CanvasRenderingContext2D,
  run: Run,
  cx: number,
  cy: number,
  chip: number,
  fontSize: number,
  emphasize: boolean,
  colored: boolean
): void {
  if (colored) {
    const c = ART.palette[(run.color - 1) % ART.palette.length];
    ctx.save();
    roundRect(ctx, cx - chip / 2, cy - chip / 2, chip, chip, chip * 0.22);
    ctx.fillStyle = c;
    ctx.fill();
    if (emphasize) {
      ctx.strokeStyle = 'rgba(0,0,0,0.25)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    ctx.fillStyle = textColorOn(c);
    ctx.font = font(fontSize * 1.05, 700, true);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(run.len), cx, cy + fontSize * 0.04);
    ctx.restore();
  } else {
    ctx.save();
    ctx.fillStyle = emphasize ? '#111111' : ART.clueText;
    ctx.font = font(fontSize * (emphasize ? 1.15 : 1), 700, true);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(run.len), cx, cy + fontSize * 0.04);
    ctx.restore();
  }
}

function drawX(ctx: CanvasRenderingContext2D, px: number, py: number, cell: number): void {
  const inset = cell * 0.28;
  ctx.save();
  ctx.strokeStyle = ART.xMark;
  ctx.lineWidth = Math.max(1.5, cell * 0.09);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(px + inset, py + inset);
  ctx.lineTo(px + cell - inset, py + cell - inset);
  ctx.moveTo(px + cell - inset, py + inset);
  ctx.lineTo(px + inset, py + cell - inset);
  ctx.stroke();
  ctx.restore();
}

/** 屏幕坐标 → 格子索引；不在网格内返回 -1 */
export function hitCell(layout: BoardLayout, level: Level, px: number, py: number): number {
  const x = Math.floor((px - layout.gridX) / layout.cell);
  const y = Math.floor((py - layout.gridY) / layout.cell);
  if (x < 0 || x >= level.width || y < 0 || y >= level.height) return -1;
  return y * level.width + x;
}

export { MONO };
