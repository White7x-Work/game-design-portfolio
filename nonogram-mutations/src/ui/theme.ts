// 共享绘制辅助：字体/圆角矩形/按钮/星星/图标/时间格式
import { ART } from '../config.js';

export const SANS =
  'system-ui, -apple-system, "Segoe UI", Roboto, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif';
export const MONO = 'ui-monospace, "SF Mono", "Cascadia Mono", Consolas, "Courier New", monospace';

export function font(px: number, weight: number | string = 500, mono = false): string {
  return `${weight} ${px}px ${mono ? MONO : SANS}`;
}

export function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

export interface Btn {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  label?: string;
  sub?: string;
  style?: 'primary' | 'ghost' | 'tool' | 'icon' | 'cell';
  active?: boolean;
  disabled?: boolean;
  color?: string; // swatch 颜色
}

export function hitBtn(b: Btn, px: number, py: number): boolean {
  return !b.disabled && px >= b.x && px <= b.x + b.w && py >= b.y && py <= b.y + b.h;
}

export function drawBtn(ctx: CanvasRenderingContext2D, b: Btn, pressed = false): void {
  const { x, y, w, h } = b;
  ctx.save();
  if (b.style === 'primary') {
    ctx.fillStyle = b.disabled ? ART.lockGray : pressed ? ART.accentDark : ART.accent;
    roundRect(ctx, x, y, w, h, 12);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = font(Math.min(18, h * 0.36), 600);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (b.label) ctx.fillText(b.label, x + w / 2, y + h / 2 + (b.sub ? -h * 0.12 : 0));
    if (b.sub) {
      ctx.font = font(Math.min(12, h * 0.2), 400);
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.fillText(b.sub, x + w / 2, y + h * 0.72);
    }
  } else if (b.style === 'tool') {
    ctx.fillStyle = b.active ? ART.accent : ART.panel;
    roundRect(ctx, x, y, w, h, 10);
    ctx.fill();
    ctx.strokeStyle = b.active ? ART.accentDark : ART.panelBorder;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = b.active ? '#fff' : ART.textMain;
    ctx.font = font(Math.min(13, h * 0.24), 600);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (b.label) ctx.fillText(b.label, x + w / 2, y + h / 2);
  } else if (b.style === 'icon') {
    if (b.active) {
      ctx.fillStyle = 'rgba(30,136,229,0.15)';
      roundRect(ctx, x, y, w, h, 8);
      ctx.fill();
    }
    ctx.fillStyle = b.disabled ? ART.lockGray : ART.textMain;
    ctx.font = font(Math.min(18, h * 0.5), 600);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (b.label) ctx.fillText(b.label, x + w / 2, y + h / 2);
  } else {
    // ghost
    ctx.fillStyle = pressed ? '#ECECE6' : ART.panel;
    roundRect(ctx, x, y, w, h, 12);
    ctx.fill();
    ctx.strokeStyle = ART.panelBorder;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = b.disabled ? ART.textSub : ART.textMain;
    ctx.font = font(Math.min(16, h * 0.32), 600);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (b.label) ctx.fillText(b.label, x + w / 2, y + h / 2 + (b.sub ? -h * 0.14 : 0));
    if (b.sub) {
      ctx.font = font(Math.min(12, h * 0.2), 400);
      ctx.fillStyle = ART.textSub;
      ctx.fillText(b.sub, x + w / 2, y + h * 0.72);
    }
  }
  ctx.restore();
}

export function fmtTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** hex → 相对亮度（0..1），用于决定 chip 上的文字颜色 */
export function luminance(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function textColorOn(hex: string): string {
  return luminance(hex) > 0.6 ? '#333333' : '#FFFFFF';
}

export function drawLock(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number): void {
  ctx.save();
  ctx.strokeStyle = ART.textSub;
  ctx.fillStyle = ART.textSub;
  ctx.lineWidth = Math.max(1.5, s * 0.12);
  ctx.beginPath();
  ctx.arc(cx, cy - s * 0.15, s * 0.28, Math.PI, 0);
  ctx.stroke();
  roundRect(ctx, cx - s * 0.42, cy - s * 0.1, s * 0.84, s * 0.62, s * 0.12);
  ctx.fill();
  ctx.restore();
}
