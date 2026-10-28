// 全局常量 — 美术规格(§6)、网格上限(§3.1/D11)、parTime 策略(§7.6)、存储键(§8)

export const ART = {
  pageBg: '#F5F5F0',
  cellEmpty: '#FFFFFF',
  cellBorder: '#D8D8D0',
  fillBlack: '#1A1A1A',
  mistake: '#FF1744',
  xMark: '#9E9E9E',
  clueText: '#333333',
  diagMainBg: '#E3F2FD', // 主对角 ↘ 线索底
  diagAntiBg: '#FFF3E0', // 副对角 ↙ 线索底
  // 高对比色盘（下标 = ColorId-1）
  palette: ['#E53935', '#1E88E5', '#43A047', '#FDD835', '#8E24AA'],
  // UI 辅助色（非规格硬性项，取自同一扁平高对比体系）
  accent: '#1E88E5',
  accentDark: '#1565C0',
  panel: '#FFFFFF',
  panelBorder: '#E0E0D8',
  textMain: '#333333',
  textSub: '#8A8A82',
  lockGray: '#C9C9C1',
  recordGold: '#E6B800',
  overlay: 'rgba(26,26,26,0.55)',
  highlightRowCol: 'rgba(30,136,229,0.10)',
  highlightCell: 'rgba(30,136,229,0.22)',
  // 斜线高亮（点选反馈）：颜色跟随带族 —— ↘ 主对角蓝 / ↙ 副对角橙
  highlightDiagMain: 'rgba(30,136,229,0.18)',
  highlightDiagAnti: 'rgba(251,140,0,0.16)',
} as const;

export const LIMITS = {
  mainlineMaxGrid: 15, // D11：主线 ≤ 15×15
  challengeMaxGrid: 20, // D11：挑战 ≤ 20×20
  dailyGrid: 10, // §3.1：每日固定 10×10
  mainlineCount: 35,
  challengeCount: 15,
} as const;

export const STORAGE_KEYS = {
  progress: 'nomo.progress',
  dailyPrefix: 'nomo.daily.', // + YYYYMMDD
  tutorialPrefix: 'nomo.tut.', // + 教学页 id
} as const;

export const INPUT = {
  longPressMs: 450, // 长按判定
  longPressMoveTolerancePx: 12,
} as const;

export const GAME = {
  mistakeColor: ART.mistake,
  /** 求解器计数上限（唯一性校验只需知道是否 >1，见 §7.3） */
  solutionCountLimit: 2,
} as const;

// ---------- parTime 策略（§7.6） ----------
// base = 面积*0.6 + 15（10×10≈75→取60校准见下；15×15≈150）
// 规格锚点：10×10 黑白 ≈ 60s，15×15 ≈ 150s；彩色/对角线 ×1.5；挑战 ×2。
// 采用分段线性：base(area) 使 base(100)=60、base(225)=150 → base = 0.72*(area-100)+60（area<100 时按 0.55/cell 递减，5×5≈25s）
export function parTimeSec(
  w: number,
  h: number,
  opts: { colored?: boolean; diagonal?: boolean; challenge?: boolean } = {}
): number {
  const area = w * h;
  let base: number;
  if (area <= 100) base = 60 - (100 - area) * 0.47; // 5×5≈25, 8×8≈40
  else base = 60 + (area - 100) * 0.72; // 15×15=150, 20×20≈276
  let t = base;
  if (opts.colored) t *= 1.5;
  if (opts.diagonal) t *= 1.5;
  if (opts.challenge) t *= 2;
  return Math.max(20, Math.round(t / 5) * 5);
}
