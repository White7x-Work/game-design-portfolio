// 入口：初始化 canvas、游戏循环、路由（主界面/选关/对局/每日）— 规格 §7.2
import type { Level, LevelSpec } from './state/types.js';
import { ART } from './config.js';
import { loadProgress, saveProgress, recordWin, tutorialSeen, markTutorialSeen, challengeZoneUnlocked, isMainlineUnlocked, isChallengeUnlocked } from './state/progress.js';
import { Session, type Tool } from './state/session.js';
import { MAINLINE_SPECS, getMainlineLevels } from './levels/mainline.js';
import { CHALLENGE_SPECS, getChallengeLevels } from './levels/challenge.js';
import { getDailyLevel, todayKeyOf } from './levels/daily.js';
import { todayStr, mulberry32 } from './core/prng.js';
import { generateLevelAsync, regenSpec, poolFor } from './core/generator.js';
import { computeBoardLayout, drawBoard, hitCell, type BoardLayout } from './ui/renderer.js';
import { layoutToolbar, drawToolbar, type ToolbarLayout } from './ui/toolbar.js';
import { hitSwatch } from './ui/palette.js';
import { attachInput } from './ui/input.js';
import type { Btn } from './ui/theme.js';
import { hitBtn } from './ui/theme.js';
import {
  drawMenu, drawLevelSelect, drawHud, drawPause, drawWin, drawTutorial,
  drawGenerating, drawToast, drawHelp, HELP_PAGES,
  type Dims, type LevelGroup, type TutPageData,
} from './ui/screens.js';

// ============================================================
// 教学内容（首次进入对应关卡时显示；帮助中可重看）
// ============================================================
const TUT_PAGES: Record<string, TutPageData> = {
  basics1: {
    title: '欢迎来到数织',
    diagram: 'rowcol',
    body:
      '网格中藏着一幅图。\n' +
      '左侧数字 = 该行从左到右"连续填色段"的长度；顶部数字 = 该列从上到下。\n' +
      '同一段里格子相连；两段数字之间至少隔 1 个空格。\n' +
      '点按格子填色，填错会有红标提醒（不致命）。把 5×5 的图案解出来吧！',
  },
  basics2: {
    title: '标记与失误',
    body:
      '确信某格是空的 → 打 X 做备注：长按格子（触屏）或右键（鼠标），也可切到"标记"工具。\n' +
      'X 只是笔记，永远不会算失误。\n' +
      '填错颜色会立刻红标：不扣命、不阻断，擦掉改正即可，但会记入本关失误数。\n' +
      '通关后按关卡记录"最少失误次数"与"最佳用时"，追求零失误、破纪录。',
  },
  colors: {
    title: '彩色数织',
    diagram: 'colors',
    body:
      '线索数字带颜色了：先在底部色盘选色，再把格子填成对应颜色。\n' +
      '不同颜色的两段可以直接紧邻；相同颜色的两段之间必须至少隔 1 个空格。\n' +
      '"擦除"工具可以清空填错的格子。',
  },
  diagonals: {
    title: '对角线线索',
    diagram: 'diagonals',
    body:
      '本关新增两个斜方向的线索带：\n' +
      '↘ 主对角线 = 蓝色带，锚在斜线的左上端，从左上往右下读；\n' +
      '↙ 副对角线 = 橙色带，锚在斜线的右上端，从右上往左下读。\n' +
      '数字含义与行列完全一致（沿斜线方向的连续填色段）。\n' +
      '点按任意格子，会高亮它所在的斜线带。',
  },
  diagEmpty: {
    title: '没有线索带 = 全空！',
    body:
      '注意：只有"至少穿过 1 个填色格"的斜线才会画出线索带。\n' +
      '没有带的斜线 = 这条斜线上所有格子都是空的。\n' +
      '这是明确规则，不是未知信息——放心地给这些格子打 X 吧！',
  },
  silhouette: {
    title: '剪影阶段',
    body:
      '这一阶段的答案都是可爱的剪影：小猫、小鱼、天鹅、帆船……\n' +
      '规则没有变化，解完就能看到它们。',
  },
  perfect: {
    title: '挑战：零失误',
    body:
      '欢迎来到挑战区，这里有多种规则叠加的题目。\n' +
      '每关的目标 = 零失误通关。\n' +
      '可以反复重试：每关的"最少失误次数"与"最佳用时"会一直记录，向纪录发起冲击。',
  },
};

// ============================================================
// 应用状态
// ============================================================

type Scene = 'menu' | 'levelsMain' | 'levelsChallenge' | 'game';

interface GameLayoutCache {
  board: BoardLayout;
  toolbar: ToolbarLayout;
}

interface GameCtx {
  level: Level;
  spec: LevelSpec | null; // daily = null（不可换一题）
  session: Session;
  practice: boolean;
  isDaily: boolean;
  returnScene: Scene;
  hoverCell: number;
  selectedCell: number;
  showDiag: boolean;
  overlay: 'none' | 'pause' | 'win' | 'tutorial';
  tutQueue: string[];
  winAt: number;
  /** 本关历史最佳用时（练习模式无） */
  winBestSec: number | undefined;
  /** 本关历史最少失误（练习模式无） */
  winMinMistakes: number | undefined;
  /** 本次是否刷新任一纪录（练习模式恒 false） */
  winNewRecord: boolean;
  generating: null | { msg: string; frac: number };
  layout: GameLayoutCache | null;
}

const canvas = document.getElementById('board') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;

const app = {
  dpr: 1,
  cssW: 0,
  cssH: 0,
  scene: 'menu' as Scene,
  progress: loadProgress(),
  game: null as GameCtx | null,
  helpOpen: false,
  helpPage: 0,
  helpFrom: 'menu' as 'menu' | 'game',
  globalGen: null as { msg: string; frac: number } | null,
  frameBtns: [] as Btn[],
  toast: null as { msg: string; until: number } | null,
};

function showToast(msg: string, ms = 2200): void {
  app.toast = { msg, until: performance.now() + ms };
}

// ============================================================
// 画布尺寸
// ============================================================
function resize(): void {
  // CSS 尺寸由 styles.css（position:fixed; inset:0）决定，这里只同步后备缓冲。
  // 关键修复：不再用取整的 window.innerWidth 去设置 style 宽高 —— 分数 CSS 视口
  // （缩放/非整数 dpr）下浏览器会非均匀重采样画布，导致网格线粗细不一。
  // 改为读取 getBoundingClientRect 的分数尺寸，并用"有效 dpr = 缓冲宽 / CSS 宽"
  // 作为绘制换算，使 CSS 坐标精确映射到设备像素（消除取整残差）。
  const rect = canvas.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
  const bw = Math.round(rect.width * dpr);
  const bh = Math.round(rect.height * dpr);
  if (app.cssW === rect.width && app.cssH === rect.height && canvas.width === bw && canvas.height === bh) {
    return;
  }
  app.cssW = rect.width;
  app.cssH = rect.height;
  canvas.width = bw;
  canvas.height = bh;
  app.dpr = bw / rect.width; // 有效 dpr（含缩放与缓冲取整）
}

// ============================================================
// 关卡启动 / 结算
// ============================================================

function startLevel(
  level: Level,
  spec: LevelSpec | null,
  opts: { practice?: boolean; daily?: boolean; returnScene?: Scene; withTutorial?: boolean } = {}
): void {
  const session = new Session(level, !!opts.practice);
  // 斜线带默认展开；若格子过小（窄屏）则默认收起（§11 风险缓解）
  let showDiag = level.diagonalEnabled;
  if (level.diagonalEnabled) {
    const probe = computeBoardLayout(level, { x: 0, y: 0, w: app.cssW - 16, h: app.cssH - 150 }, true);
    if (probe.cell < 17) showDiag = false;
  }
  const tutQueue: string[] = [];
  if (opts.withTutorial !== false && !opts.practice && level.tutorial) {
    for (const id of level.tutorial) if (!tutorialSeen(id)) tutQueue.push(id);
  }
  app.game = {
    level,
    spec,
    session,
    practice: !!opts.practice,
    isDaily: !!opts.daily,
    returnScene: opts.returnScene ?? (level.type === 'challenge' ? 'levelsChallenge' : level.type === 'daily' ? 'menu' : 'levelsMain'),
    hoverCell: -1,
    selectedCell: -1,
    showDiag,
    overlay: tutQueue.length > 0 ? 'tutorial' : 'none',
    tutQueue,
    winAt: 0,
    winBestSec: undefined,
    winMinMistakes: undefined,
    winNewRecord: false,
    generating: null,
    layout: null,
  };
  app.scene = 'game';
  app.helpOpen = false;
}

function levelById(id: string): { level: Level; spec: LevelSpec } | null {
  if (id.startsWith('m')) {
    const i = MAINLINE_SPECS.findIndex((s) => s.id === id);
    if (i < 0) return null;
    return { level: getMainlineLevels()[i], spec: MAINLINE_SPECS[i] };
  }
  if (id.startsWith('c')) {
    const i = CHALLENGE_SPECS.findIndex((s) => s.id === id);
    if (i < 0) return null;
    return { level: getChallengeLevels()[i], spec: CHALLENGE_SPECS[i] };
  }
  return null;
}

function onWin(): void {
  const g = app.game;
  if (!g || g.overlay === 'win') return;
  g.winAt = performance.now();
  g.overlay = 'win';
  if (!g.practice) {
    const mistakes = g.session.mistakeCount;
    const timeSec = g.session.timeSec();
    // 先对比旧纪录（recordWin 会就地合并），判断本次是否刷新
    const prev = app.progress.records[g.level.id];
    g.winNewRecord =
      prev?.bestTimeSec === undefined ||
      timeSec < prev.bestTimeSec ||
      prev?.minMistakes === undefined ||
      mistakes < prev.minMistakes;
    recordWin(app.progress, g.level.id, g.level.type, g.level.index ?? 0, mistakes, timeSec);
    const rec = app.progress.records[g.level.id];
    g.winBestSec = rec?.bestTimeSec;
    g.winMinMistakes = rec?.minMistakes;
  } else {
    g.winBestSec = undefined;
    g.winMinMistakes = undefined;
    g.winNewRecord = false;
  }
}

function nextLevelExists(): boolean {
  const g = app.game;
  if (!g || g.practice || g.isDaily || g.level.index === undefined) return false;
  const max = g.level.type === 'mainline' ? MAINLINE_SPECS.length : CHALLENGE_SPECS.length;
  return g.level.index + 1 < max;
}

function goNextLevel(): void {
  const g = app.game;
  if (!g || g.level.index === undefined) return;
  const prefix = g.level.type === 'mainline' ? 'm' : 'c';
  const nextId = prefix + String(g.level.index + 2).padStart(2, '0');
  const found = levelById(nextId);
  if (found) startLevel(found.level, found.spec, { returnScene: g.returnScene });
}

async function regenLevel(): Promise<void> {
  const g = app.game;
  if (!g || !g.spec || g.generating) return;
  g.overlay = 'none';
  g.generating = { msg: '重新生成中…', frac: -1 };
  const spec2 = regenSpec(g.spec);
  const rng = mulberry32((Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0);
  try {
    const res = await generateLevelAsync(spec2, rng, poolFor(g.spec), (it, budget) => {
      if (g.generating) g.generating.frac = it / budget;
    });
    if (res.level) {
      const keepReturn = g.returnScene;
      const keepSpec = g.spec;
      startLevel(res.level, keepSpec, { practice: true, returnScene: keepReturn, withTutorial: false });
      // 不再弹 toast：练习模式信息由常驻横幅（"练习模式 · 不计进度"）表达，避免重复提示
    } else {
      g.generating = null;
      g.overlay = 'pause';
      g.session.resume();
      showToast('生成超出预算，请再试一次');
    }
  } catch (e) {
    g.generating = null;
    g.overlay = 'pause';
    g.session.resume();
    showToast('生成失败：' + (e instanceof Error ? e.message : String(e)));
  }
}

async function startDaily(): Promise<void> {
  if (app.globalGen) return;
  app.globalGen = { msg: '生成今日题目…', frac: -1 };
  try {
    const level = await getDailyLevel(todayStr(), (it, budget) => {
      if (app.globalGen) app.globalGen.frac = it / budget;
    });
    app.globalGen = null;
    startLevel(level, null, { daily: true, returnScene: 'menu' });
  } catch (e) {
    app.globalGen = null;
    showToast('每日一题生成失败：' + (e instanceof Error ? e.message : String(e)));
  }
}

function exitGame(): void {
  const g = app.game;
  app.game = null;
  app.scene = g ? g.returnScene : 'menu';
}

// ============================================================
// 绘制
// ============================================================

const HUD_H = 52;
const TOOLBAR_H = 64;

function draw(): void {
  resize();
  const dims: Dims = { w: app.cssW, h: app.cssH };
  ctx.setTransform(app.dpr, 0, 0, app.dpr, 0, 0);
  ctx.fillStyle = ART.pageBg;
  ctx.fillRect(0, 0, dims.w, dims.h);
  app.frameBtns = [];

  if (app.scene === 'menu') {
    const dailyKey = todayKeyOf();
    const rec = app.progress.records['daily-' + dailyKey];
    app.frameBtns = drawMenu(ctx, dims, {
      progress: app.progress,
      dailyDate: todayStr(),
      dailyDone: !!rec,
      dailyBestSec: rec?.bestTimeSec,
    });
  } else if (app.scene === 'levelsMain' || app.scene === 'levelsChallenge') {
    const mainline = app.scene === 'levelsMain';
    app.frameBtns = drawLevelSelect(ctx, dims, {
      title: mainline ? '主线征程' : '挑战',
      groups: levelGroups(mainline),
    });
  } else if (app.scene === 'game' && app.game) {
    drawGame(dims);
  }

  // 全局浮层
  if (app.helpOpen) {
    app.frameBtns = drawHelp(ctx, dims, app.helpPage);
  } else if (app.globalGen) {
    drawGenerating(ctx, dims, app.globalGen.msg, app.globalGen.frac);
    app.frameBtns = [];
  }

  if (app.toast) {
    if (performance.now() > app.toast.until) app.toast = null;
    else drawToast(ctx, dims, app.toast.msg);
  }
}

const MAIN_GROUP_DEFS: Array<{ label: string; color: string; from: number; to: number }> = [
  { label: 'S1 · 黑白入门', color: '#1A1A1A', from: 0, to: 8 },
  { label: 'S2 · 彩色玩法', color: '#E53935', from: 8, to: 16 },
  { label: 'S3 · 对角线', color: '#1E88E5', from: 16, to: 26 },
  { label: 'S4 · 形状剪影', color: '#43A047', from: 26, to: 35 },
];
const CHALLENGE_GROUP_DEFS: Array<{ label: string; color: string; from: number; to: number }> = [
  { label: '彩色 × 剪影', color: '#E53935', from: 0, to: 5 },
  { label: '高难对角线', color: '#1E88E5', from: 5, to: 10 },
  { label: '彩色 × 对角线', color: '#8E24AA', from: 10, to: 13 },
  { label: '全规则叠加', color: '#FDD835', from: 13, to: 15 },
];

function levelGroups(mainline: boolean): LevelGroup[] {
  const p = app.progress;
  const specs = mainline ? MAINLINE_SPECS : CHALLENGE_SPECS;
  const defs = mainline ? MAIN_GROUP_DEFS : CHALLENGE_GROUP_DEFS;
  return defs.map((gd) => ({
    label: mainline ? `${gd.label}（${gd.from + 1}–${gd.to}）` : `${gd.label}（C${gd.from + 1}–C${gd.to}）`,
    color: gd.color,
    entries: specs.slice(gd.from, gd.to).map((s, j) => {
      const i = gd.from + j;
      const rec = p.records[s.id];
      const locked = mainline ? !isMainlineUnlocked(p, i) : !isChallengeUnlocked(p, i);
      return {
        id: s.id,
        label: String(i + 1),
        minMistakes: rec?.minMistakes,
        bestSec: rec?.bestTimeSec,
        locked,
        current:
          !locked &&
          (mainline
            ? i === Math.min(p.unlockedMainline, 35) - 1
            : i === Math.max(p.unlockedChallenge, 1) - 1),
      };
    }),
  }));
}

function kindLabel(level: Level): string {
  const parts: string[] = [];
  if (level.colors && level.colors.length > 1) parts.push(`${level.colors.length}色`);
  else parts.push('黑白');
  if (level.diagonalEnabled) parts.push('斜线');
  return parts.join(' · ');
}

function drawGame(dims: Dims): void {
  const g = app.game!;
  const level = g.level;
  const session = g.session;
  const practiceBanner = g.practice ? 20 : 0;

  // HUD
  const hudTitle =
    level.type === 'daily'
      ? '每日一题'
      : level.type === 'mainline'
        ? `第 ${(level.index ?? 0) + 1} 关`
        : `挑战 C${String((level.index ?? 0) + 1).padStart(2, '0')}`;
  // 关卡名不在对局中展示（防剧透），结算时与完整图形一起揭晓
  const hudSub = `${level.width}×${level.height} · ${kindLabel(level)}`;
  const hudBtns = drawHud(ctx, dims, {
    title: hudTitle,
    sub: hudSub,
    timeSec: session.timeSec(),
    mistakes: session.mistakeCount,
    practice: g.practice,
  });

  // 棋盘区
  const boardArea = { x: 8, y: HUD_H + practiceBanner + 4, w: dims.w - 16, h: dims.h - HUD_H - practiceBanner - TOOLBAR_H - 12 };
  const board = computeBoardLayout(level, boardArea, g.showDiag);
  const toolbar = layoutToolbar(level, { x: 0, y: dims.h - TOOLBAR_H, w: dims.w, h: TOOLBAR_H }, g.showDiag);
  g.layout = { board, toolbar };

  const activeCell = g.hoverCell >= 0 ? g.hoverCell : g.selectedCell;
  drawBoard(ctx, level, session, board, { activeCell, showDiag: g.showDiag });
  drawToolbar(ctx, toolbar, session);

  // 按钮收集（浮层打开时只保留浮层按钮）
  if (g.overlay === 'none' && !g.generating) {
    app.frameBtns = [...hudBtns, ...toolbar.toolBtns, ...(toolbar.diagToggle ? [toolbar.diagToggle] : [])];
  } else {
    app.frameBtns = [];
  }

  // 浮层
  if (g.generating) {
    drawGenerating(ctx, dims, g.generating.msg, g.generating.frac);
  } else if (g.overlay === 'pause') {
    const recKey = g.isDaily ? 'daily-' + todayKeyOf() : g.level.id;
    const rec = g.practice ? undefined : app.progress.records[recKey];
    app.frameBtns = drawPause(ctx, dims, {
      canRegen: !!g.spec && !g.isDaily,
      record: rec ? { minMistakes: rec.minMistakes, bestSec: rec.bestTimeSec } : null,
    });
  } else if (g.overlay === 'win') {
    const t = (performance.now() - g.winAt) / 900;
    app.frameBtns = drawWin(ctx, dims, {
      timeSec: session.timeSec(),
      bestSec: g.winBestSec,
      mistakes: session.mistakeCount,
      minMistakes: g.winMinMistakes,
      newRecord: g.winNewRecord,
      isDaily: g.isDaily,
      hasNext: nextLevelExists(),
      title: g.isDaily ? '今日完成！' : level.type === 'challenge' ? '挑战达成！' : '过关！',
      name: g.isDaily ? '每日一题' : level.title ?? '',
      level,
      t,
    });
  } else if (g.overlay === 'tutorial') {
    const id = g.tutQueue[0];
    const page = TUT_PAGES[id];
    if (page) {
      const total = g.tutQueue.length;
      app.frameBtns = drawTutorial(ctx, dims, page, 0, total);
    } else {
      g.overlay = 'none';
    }
  }
}

// ============================================================
// 输入分发
// ============================================================

function blocked(): boolean {
  if (app.helpOpen || app.globalGen) return true;
  const g = app.game;
  return !!g && (g.overlay !== 'none' || !!g.generating);
}

function buttonAt(px: number, py: number): string | null {
  // 色盘优先（对局中、无浮层）
  const g = app.game;
  if (app.scene === 'game' && g && g.layout && !blocked() && g.layout.toolbar.swatches.length > 0) {
    const c = hitSwatch(g.layout.toolbar.swatches, px, py);
    if (c !== null) return 'swatch.' + c;
  }
  for (let i = app.frameBtns.length - 1; i >= 0; i--) {
    if (hitBtn(app.frameBtns[i], px, py)) return app.frameBtns[i].id;
  }
  return null;
}

function cellAt(px: number, py: number): number {
  const g = app.game;
  if (app.scene !== 'game' || !g || !g.layout || blocked()) return -1;
  return hitCell(g.layout.board, g.level, px, py);
}

function applyCell(i: number): void {
  const g = app.game;
  if (!g) return;
  g.selectedCell = i;
  const res = g.session.applyTool(i);
  if (res.won && g.overlay !== 'win') onWin();
}

function onButton(id: string): void {
  // 帮助浮层
  if (app.helpOpen) {
    if (id === 'help.prev') app.helpPage = Math.max(0, app.helpPage - 1);
    else if (id === 'help.next') app.helpPage = Math.min(HELP_PAGES.length - 1, app.helpPage + 1);
    else if (id === 'help.back' || id === 'back') app.helpOpen = false;
    return;
  }
  switch (id) {
    case 'menu.main':
      app.scene = 'levelsMain';
      return;
    case 'menu.challenge':
      if (challengeZoneUnlocked(app.progress)) app.scene = 'levelsChallenge';
      return;
    case 'menu.daily':
      void startDaily();
      return;
    case 'menu.help':
      app.helpFrom = 'menu';
      app.helpPage = 0;
      app.helpOpen = true;
      return;
    case 'back':
      if (app.scene === 'game') exitGame();
      else if (app.scene === 'levelsMain' || app.scene === 'levelsChallenge') app.scene = 'menu';
      return;
  }
  if (id.startsWith('lvl.')) {
    const found = levelById(id.slice(4));
    if (found) startLevel(found.level, found.spec, {});
    return;
  }
  // 对局内
  const g = app.game;
  if (!g) return;
  switch (id) {
    case 'pause':
      g.session.pause();
      g.overlay = 'pause';
      return;
    case 'resume':
      g.overlay = 'none';
      g.session.resume();
      return;
    case 'restart':
      startLevel(g.level, g.spec, {
        practice: g.practice,
        daily: g.isDaily,
        returnScene: g.returnScene,
        withTutorial: false,
      });
      return;
    case 'regen':
      void regenLevel();
      return;
    case 'gamehelp':
      app.helpFrom = 'game';
      app.helpPage = 0;
      app.helpOpen = true;
      return;
    case 'quit':
      exitGame();
      return;
    case 'win.next':
      goNextLevel();
      return;
    case 'win.replay':
      startLevel(g.level, g.spec, {
        practice: g.practice,
        daily: g.isDaily,
        returnScene: g.returnScene,
        withTutorial: false,
      });
      return;
    case 'win.home':
      exitGame();
      return;
    case 'tut.next': {
      const cur = g.tutQueue.shift();
      if (cur) markTutorialSeen(cur);
      if (g.tutQueue.length === 0) g.overlay = 'none';
      return;
    }
    case 'tut.skip': {
      for (const t of g.tutQueue) markTutorialSeen(t);
      g.tutQueue = [];
      g.overlay = 'none';
      return;
    }
    case 'tool.fill':
      g.session.tool = 'fill';
      return;
    case 'tool.mark':
      g.session.tool = 'mark';
      return;
    case 'tool.erase':
      g.session.tool = 'erase';
      return;
    case 'diag.toggle':
      g.showDiag = !g.showDiag;
      return;
  }
  if (id.startsWith('swatch.')) {
    const c = parseInt(id.slice(7), 10);
    g.session.color = c;
    g.session.tool = 'fill';
  }
}

attachInput(canvas, {
  buttonAt,
  cellAt,
  onButton,
  onCellTap: applyCell,
  onCellDrag: applyCell,
  onCellMark(i) {
    const g = app.game;
    if (!g) return;
    g.selectedCell = i;
    g.session.toggleMark(i);
  },
  onHover(i) {
    if (app.game) app.game.hoverCell = i;
  },
  blocked,
});

// 页面隐藏 → 暂停计时
document.addEventListener('visibilitychange', () => {
  const g = app.game;
  if (document.hidden && g && g.overlay === 'none' && !g.generating) {
    g.session.pause();
    g.overlay = 'pause';
  }
});

// 防止双击缩放/滚动干扰（styles.css 已设 touch-action:none，双保险）
document.addEventListener('gesturestart', (e) => e.preventDefault());

// ============================================================
// 主循环
// ============================================================
function frame(): void {
  draw();
  requestAnimationFrame(frame);
}

resize();
saveProgress(app.progress); // 归一化写回
requestAnimationFrame(frame);

// QA/调试钩子（不影响玩法；便于自动化验收与人工排查）
interface NomoDebug {
  app: typeof app;
  startLevelById(id: string): void;
  startDailyNow(): Promise<void>;
  fillSolutionFast(): void;
  scene(): string;
  gameInfo(): unknown;
  render(): void;
}
const dbg: NomoDebug = {
  app,
  render() {
    resize();
    draw();
  },
  startLevelById(id: string) {
    const found = levelById(id);
    if (found) startLevel(found.level, found.spec, { withTutorial: false });
  },
  startDailyNow: startDaily,
  fillSolutionFast() {
    const g = app.game;
    if (!g) return;
    const { solution, width } = g.level;
    for (let y = 0; y < g.level.height; y++)
      for (let x = 0; x < width; x++) {
        const i = y * width + x;
        g.session.values[i] = solution[y][x];
      }
    g.session.won = true;
    g.session.pause();
    onWin();
  },
  scene: () => app.scene,
  gameInfo() {
    const g = app.game;
    if (!g) return null;
    return {
      id: g.level.id,
      kind: g.level.kind,
      w: g.level.width,
      h: g.level.height,
      diagonal: g.level.diagonalEnabled,
      dirs: g.level.diagonalDirections,
      colors: g.level.colors,
      showDiag: g.showDiag,
      overlay: g.overlay,
      tutQueue: g.tutQueue.slice(),
      mistakes: g.session.mistakeCount,
      tool: g.session.tool,
      color: g.session.color,
      cell: g.layout?.board.cell,
      bands: g.layout?.board.bands.length,
      par: g.level.parTimeSec,
    };
  },
};
(window as unknown as { __nomo: NomoDebug }).__nomo = dbg;

export type { Tool };
