// 色盘 — 规格 §5：彩色关卡选色；只在彩色/对角线关卡显示，黑白关卡隐藏
import type { ColorId } from '../state/types.js';
import { ART } from '../config.js';

export interface Swatch {
  color: ColorId;
  /** 实际渲染色（黑白关卡为黑，彩色关卡为色盘色） */
  css: string;
  x: number;
  y: number;
  r: number;
}

export function layoutPalette(
  colors: Array<{ color: ColorId; css: string }>,
  area: { x: number; y: number; w: number; h: number }
): Swatch[] {
  const r = Math.min(area.h * 0.36, 20);
  const gap = r * 2.5;
  const totalW = gap * (colors.length - 1);
  const x0 = area.x + area.w / 2 - totalW / 2;
  const cy = area.y + area.h / 2;
  return colors.map((c, i) => ({ color: c.color, css: c.css, x: x0 + i * gap, y: cy, r }));
}

export function drawPalette(ctx: CanvasRenderingContext2D, swatches: Swatch[], selected: ColorId): void {
  for (const s of swatches) {
    ctx.save();
    if (s.color === selected) {
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r + 4, 0, Math.PI * 2);
      ctx.strokeStyle = ART.accentDark;
      ctx.lineWidth = 2.5;
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fillStyle = s.css;
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.18)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  }
}

export function hitSwatch(swatches: Swatch[], px: number, py: number): ColorId | null {
  for (const s of swatches) {
    const dx = px - s.x;
    const dy = py - s.y;
    if (dx * dx + dy * dy <= (s.r + 8) * (s.r + 8)) return s.color;
  }
  return null;
}
