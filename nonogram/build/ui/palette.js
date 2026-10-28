import { ART } from '../config.js';
export function layoutPalette(colors, area) {
    const r = Math.min(area.h * 0.36, 20);
    const gap = r * 2.5;
    const totalW = gap * (colors.length - 1);
    const x0 = area.x + area.w / 2 - totalW / 2;
    const cy = area.y + area.h / 2;
    return colors.map((c, i) => ({ color: c.color, css: c.css, x: x0 + i * gap, y: cy, r }));
}
export function drawPalette(ctx, swatches, selected) {
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
export function hitSwatch(swatches, px, py) {
    for (const s of swatches) {
        const dx = px - s.x;
        const dy = py - s.y;
        if (dx * dx + dy * dy <= (s.r + 8) * (s.r + 8))
            return s.color;
    }
    return null;
}
