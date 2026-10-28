// 触屏/鼠标输入 — 规格 §5：点按填色、拖动连涂、长按(触屏)/右键(鼠标)=X、按钮命中
import { INPUT } from '../config.js';

export interface InputCallbacks {
  /** 返回命中按钮 id；无按钮返回 null（浮层打开时应只含浮层按钮） */
  buttonAt(px: number, py: number): string | null;
  /** 返回格子索引；不在网格/不可交互返回 -1 */
  cellAt(px: number, py: number): number;
  onButton(id: string): void;
  onCellTap(i: number): void;
  onCellDrag(i: number): void;
  onCellMark(i: number): void; // 长按/右键 → X 切换
  onHover(i: number): void;
  /** 交互是否被浮层/生成中阻断（阻断时格子手势无效） */
  blocked(): boolean;
}

interface Gesture {
  pointerId: number;
  x0: number;
  y0: number;
  t0: number;
  moved: boolean;
  consumed: boolean; // 长按已触发
  lastCell: number;
  btn: string | null;
  longPressTimer: number | null;
  isTouch: boolean;
}

export function attachInput(canvas: HTMLCanvasElement, cb: InputCallbacks): () => void {
  let g: Gesture | null = null;

  const pos = (e: PointerEvent | MouseEvent) => {
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const clearLongPress = () => {
    if (g && g.longPressTimer !== null) {
      clearTimeout(g.longPressTimer);
      g.longPressTimer = null;
    }
  };

  const onDown = (e: PointerEvent) => {
    const { x, y } = pos(e);
    // 右键（鼠标）= X 标记（§5）
    if (e.button === 2) {
      e.preventDefault();
      if (!cb.blocked()) {
        const c = cb.cellAt(x, y);
        if (c >= 0) cb.onCellMark(c);
      }
      return;
    }
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    if (g) return; // 忽略多指第二触点（单手可玩，防误触）
    const btn = cb.buttonAt(x, y);
    g = {
      pointerId: e.pointerId,
      x0: x,
      y0: y,
      t0: performance.now(),
      moved: false,
      consumed: false,
      lastCell: -1,
      btn,
      longPressTimer: null,
      isTouch: e.pointerType !== 'mouse',
    };
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    // 长按（触屏）= X 备注（§5）；仅在格子上且未被浮层阻断时启动
    if (g.isTouch && !btn && !cb.blocked() && cb.cellAt(x, y) >= 0) {
      g.longPressTimer = window.setTimeout(() => {
        if (g && !g.moved) {
          g.consumed = true;
          const c = cb.cellAt(g.x0, g.y0);
          if (c >= 0) cb.onCellMark(c);
        }
      }, INPUT.longPressMs);
    }
    e.preventDefault();
  };

  const onMove = (e: PointerEvent) => {
    const { x, y } = pos(e);
    if (!g || e.pointerId !== g.pointerId) {
      // 鼠标悬停高亮
      if (e.pointerType === 'mouse' && !g) {
        cb.onHover(cb.blocked() ? -1 : cb.cellAt(x, y));
        canvas.style.cursor = cb.buttonAt(x, y) ? 'pointer' : 'default';
      }
      return;
    }
    const dx = x - g.x0;
    const dy = y - g.y0;
    if (!g.moved && dx * dx + dy * dy > INPUT.longPressMoveTolerancePx ** 2) {
      g.moved = true;
      clearLongPress();
      // 拖动开始：起点格先应用一次工具
      if (!g.consumed && !g.btn && !cb.blocked()) {
        const c0 = cb.cellAt(g.x0, g.y0);
        if (c0 >= 0) {
          cb.onCellDrag(c0);
          g.lastCell = c0;
        }
      }
    }
    if (g.moved && !g.consumed && !g.btn && !cb.blocked()) {
      const c = cb.cellAt(x, y);
      if (c >= 0 && c !== g.lastCell) {
        cb.onCellDrag(c);
        g.lastCell = c;
      }
    }
  };

  const onUp = (e: PointerEvent) => {
    if (!g || e.pointerId !== g.pointerId) return;
    clearLongPress();
    const { x, y } = pos(e);
    if (!g.consumed) {
      if (!g.moved) {
        // 点按
        if (g.btn) {
          const still = cb.buttonAt(x, y);
          if (still === g.btn) cb.onButton(g.btn);
        } else if (!cb.blocked()) {
          const c = cb.cellAt(x, y);
          if (c >= 0) cb.onCellTap(c);
        }
      }
      // 拖动结束无需额外处理
    }
    try {
      canvas.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    g = null;
  };

  const onCancel = (e: PointerEvent) => {
    if (g && e.pointerId === g.pointerId) {
      clearLongPress();
      g = null;
    }
  };

  const onLeave = () => {
    if (!g) cb.onHover(-1);
  };

  const onCtx = (e: Event) => e.preventDefault();

  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onCancel);
  canvas.addEventListener('pointerleave', onLeave);
  canvas.addEventListener('contextmenu', onCtx);

  return () => {
    canvas.removeEventListener('pointerdown', onDown);
    canvas.removeEventListener('pointermove', onMove);
    canvas.removeEventListener('pointerup', onUp);
    canvas.removeEventListener('pointercancel', onCancel);
    canvas.removeEventListener('pointerleave', onLeave);
    canvas.removeEventListener('contextmenu', onCtx);
  };
}
