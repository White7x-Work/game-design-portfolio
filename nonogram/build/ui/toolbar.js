import { ART } from '../config.js';
import { drawBtn } from './theme.js';
import { layoutPalette, drawPalette } from './palette.js';
export function shouldShowPalette(level) {
    // §5：色盘只在彩色/对角线关卡显示，黑白关卡隐藏
    return !!(level.colors && level.colors.length > 1) || level.diagonalEnabled;
}
export function layoutToolbar(level, area, showDiag) {
    const tools = [
        { id: 'fill', label: '填色' },
        { id: 'mark', label: '标记' },
        { id: 'erase', label: '擦除' },
    ];
    const showPalette = shouldShowPalette(level);
    const btnW = Math.min(72, area.w / (showPalette ? 7.2 : 4.6));
    const btnH = Math.min(50, area.h - 8);
    const y = area.y + (area.h - btnH) / 2;
    const toolBtns = tools.map((t, i) => ({
        id: 'tool.' + t.id,
        x: area.x + 12 + i * (btnW + 8),
        y,
        w: btnW,
        h: btnH,
        label: t.label,
        style: 'tool',
    }));
    let diagToggle = null;
    let paletteAreaX = area.x + 12 + 3 * (btnW + 8) + 8;
    if (level.diagonalEnabled) {
        const tw = btnW + 14;
        diagToggle = {
            id: 'diag.toggle',
            x: area.x + area.w - tw - 12,
            y,
            w: tw,
            h: btnH,
            label: showDiag ? '斜线:开' : '斜线:关',
            style: 'tool',
            active: showDiag,
        };
        paletteAreaX = area.x + 12 + 3 * (btnW + 8) + 8;
    }
    const palRight = diagToggle ? diagToggle.x - 8 : area.x + area.w - 12;
    const isColored = !!(level.colors && level.colors.length > 1);
    const colorIds = showPalette ? (isColored ? level.colors : [1]) : [];
    const swatchDefs = colorIds.map((c) => ({
        color: c,
        css: isColored ? ART.palette[(c - 1) % ART.palette.length] : ART.fillBlack,
    }));
    const swatches = showPalette
        ? layoutPalette(swatchDefs, {
            x: paletteAreaX,
            y: area.y,
            w: Math.max(40, palRight - paletteAreaX),
            h: area.h,
        })
        : [];
    return { toolBtns, swatches, diagToggle, showPalette };
}
export function drawToolbar(ctx, layout, session) {
    for (const b of layout.toolBtns) {
        const tool = b.id.slice(5);
        b.active = session.tool === tool;
        // 图标 + 文字自行分层绘制，drawBtn 只画底
        drawBtn(ctx, { ...b, label: undefined });
        // 工具小图标
        drawToolIcon(ctx, tool, b.x + b.w / 2, b.y + b.h * 0.32, Math.min(b.w, b.h) * 0.3, b.active);
        // label 下移
        ctx.save();
        ctx.fillStyle = b.active ? '#fff' : '#333333';
        ctx.font = `600 ${Math.min(12, b.h * 0.24)}px system-ui, "PingFang SC", "Microsoft YaHei", sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(b.label ?? '', b.x + b.w / 2, b.y + b.h * 0.72);
        ctx.restore();
    }
    if (layout.showPalette && layout.swatches.length > 0) {
        drawPalette(ctx, layout.swatches, session.color);
    }
    if (layout.diagToggle)
        drawBtn(ctx, layout.diagToggle);
}
function drawToolIcon(ctx, tool, cx, cy, s, active) {
    ctx.save();
    ctx.strokeStyle = active ? '#fff' : '#333333';
    ctx.fillStyle = active ? '#fff' : '#333333';
    ctx.lineWidth = Math.max(1.5, s * 0.16);
    ctx.lineCap = 'round';
    if (tool === 'fill') {
        // 实心方块
        ctx.fillRect(cx - s * 0.55, cy - s * 0.55, s * 1.1, s * 1.1);
    }
    else if (tool === 'mark') {
        // X
        ctx.beginPath();
        ctx.moveTo(cx - s * 0.55, cy - s * 0.55);
        ctx.lineTo(cx + s * 0.55, cy + s * 0.55);
        ctx.moveTo(cx + s * 0.55, cy - s * 0.55);
        ctx.lineTo(cx - s * 0.55, cy + s * 0.55);
        ctx.stroke();
    }
    else {
        // 橡皮（斜置矩形）
        ctx.translate(cx, cy);
        ctx.rotate(-Math.PI / 6);
        ctx.strokeRect(-s * 0.7, -s * 0.42, s * 1.4, s * 0.84);
        ctx.beginPath();
        ctx.moveTo(-s * 0.1, -s * 0.42);
        ctx.lineTo(-s * 0.1, s * 0.42);
        ctx.stroke();
    }
    ctx.restore();
}
