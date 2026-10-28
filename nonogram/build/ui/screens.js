import { ART } from '../config.js';
import { drawBtn, drawLock, font, roundRect, fmtTime, SANS } from './theme.js';
// ---------- 通用 ----------
function panel(ctx, dims, pw, ph) {
    ctx.fillStyle = ART.overlay;
    ctx.fillRect(0, 0, dims.w, dims.h);
    const x = (dims.w - pw) / 2;
    const y = Math.max(24, (dims.h - ph) / 2);
    ctx.fillStyle = ART.panel;
    roundRect(ctx, x, y, pw, ph, 18);
    ctx.fill();
    return { x, y, w: pw, h: ph };
}
export function wrapText(ctx, text, maxW) {
    const lines = [];
    for (const para of text.split('\n')) {
        let cur = '';
        for (const ch of para) {
            const test = cur + ch;
            if (ctx.measureText(test).width > maxW && cur.length > 0) {
                lines.push(cur);
                cur = ch;
            }
            else {
                cur = test;
            }
        }
        lines.push(cur);
    }
    return lines;
}
export function drawMenu(ctx, dims, data) {
    const btns = [];
    const p = data.progress;
    const cw = Math.min(380, dims.w - 56);
    const cx = (dims.w - cw) / 2;
    // 装饰 mini 数织（5×5 心形）
    const mini = 14;
    const heart = ['.#.#.', '#####', '#####', '.###.', '..#..'];
    const mx = dims.w / 2 - (mini * 5) / 2;
    const my = Math.max(36, dims.h * 0.1);
    for (let y = 0; y < 5; y++) {
        for (let x = 0; x < 5; x++) {
            ctx.fillStyle = heart[y][x] === '#' ? ART.fillBlack : ART.cellEmpty;
            ctx.fillRect(mx + x * mini, my + y * mini, mini - 1, mini - 1);
        }
    }
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const ty = my + mini * 5 + 44;
    ctx.fillStyle = ART.textMain;
    ctx.font = font(Math.min(40, dims.w * 0.09), 800);
    ctx.fillText('数织异化', dims.w / 2, ty);
    ctx.fillStyle = ART.textSub;
    ctx.font = font(14, 400);
    ctx.fillText('Nonogram Mutations · 规则异化玩法展示', dims.w / 2, ty + 30);
    const bh = 64;
    const gap = 14;
    let by = ty + 66;
    const cDone = countDoneOf(p, 'c');
    const mDone = countDoneOf(p, 'm');
    const mk = (id, label, sub, style, disabled = false) => {
        const b = { id, x: cx, y: by, w: cw, h: bh, label, sub, style, disabled };
        btns.push(b);
        drawBtn(ctx, b);
        by += bh + gap;
    };
    // 试玩模式：全部关卡开放，菜单只展示通关进度
    mk('menu.main', '主线征程', `${mDone}/35 已通关`, 'primary');
    mk('menu.challenge', '挑战', `${cDone}/15 已通关`, 'ghost');
    mk('menu.daily', '每日一题', data.dailyDone
        ? `${data.dailyDate} · 已完成${data.dailyBestSec !== undefined ? ` · 最佳 ${fmtTime(data.dailyBestSec)}` : ''}`
        : `${data.dailyDate} · 今天来一发`, 'ghost');
    mk('menu.help', '玩法说明', '规则 · 操作 · 记录', 'ghost');
    return btns;
}
function countDoneOf(p, prefix) {
    let n = 0;
    for (const id of Object.keys(p.records)) {
        if (id.startsWith(prefix))
            n++;
    }
    return n;
}
export function drawLevelSelect(ctx, dims, data) {
    const btns = [];
    // 顶栏
    const back = { id: 'back', x: 12, y: 12, w: 44, h: 44, label: '‹', style: 'icon' };
    btns.push(back);
    drawBtn(ctx, back);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = ART.textMain;
    ctx.font = font(20, 700);
    ctx.fillText(data.title, dims.w / 2, 34);
    const gap = 8;
    const pad = 16;
    const y0 = 70;
    const availH = dims.h - y0 - 16;
    const availW = dims.w - pad * 2;
    const cols = availW >= 680 ? 10 : 7;
    // 按钮尺寸：宽度约束 + 高度约束（组标题 22px + 行距）
    let s = Math.min(56, (availW - (cols - 1) * gap) / cols);
    const rowsOf = (n) => Math.ceil(n / cols);
    const contentH = (size) => {
        let h = 0;
        for (const gr of data.groups) {
            h += 24 + rowsOf(gr.entries.length) * (size + gap) - gap + 14;
        }
        return h;
    };
    while (contentH(s) > availH && s > 28)
        s -= 2;
    const gridW = cols * s + (cols - 1) * gap;
    const x0 = (dims.w - gridW) / 2;
    let cy = y0 + Math.max(0, (availH - contentH(s)) / 2);
    for (const gr of data.groups) {
        // 组标题（彩色圆点 + 分类名）
        ctx.save();
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = gr.color;
        ctx.beginPath();
        ctx.arc(x0 + 5, cy + 11, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = ART.textSub;
        ctx.font = font(12.5, 700);
        ctx.fillText(gr.label, x0 + 16, cy + 12);
        // 组内进度（已通关数）
        const done = gr.entries.filter((e) => e.bestSec !== undefined).length;
        ctx.textAlign = 'right';
        ctx.font = font(11, 500);
        ctx.fillStyle = ART.textSub;
        ctx.fillText(`已通关 ${done}/${gr.entries.length}`, x0 + gridW, cy + 12);
        ctx.restore();
        cy += 24;
        gr.entries.forEach((e, i) => {
            const col = i % cols;
            const row = Math.floor(i / cols);
            const x = x0 + col * (s + gap);
            const y = cy + row * (s + gap);
            const b = { id: 'lvl.' + e.id, x, y, w: s, h: s, style: 'cell', disabled: e.locked };
            btns.push(b);
            ctx.save();
            ctx.fillStyle = e.locked ? '#ECEAE2' : e.current ? '#E3F2FD' : ART.panel;
            roundRect(ctx, x, y, s, s, 10);
            ctx.fill();
            ctx.strokeStyle = e.current ? ART.accent : ART.panelBorder;
            ctx.lineWidth = e.current ? 2 : 1;
            ctx.stroke();
            // 组色顶条（与分组标题呼应）
            if (!e.locked) {
                ctx.fillStyle = gr.color;
                ctx.globalAlpha = 0.75;
                roundRect(ctx, x + 6, y + 4, s - 12, 3, 1.5);
                ctx.fill();
                ctx.globalAlpha = 1;
            }
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            if (e.locked) {
                drawLock(ctx, x + s / 2, y + s / 2, s * 0.34);
            }
            else if (e.bestSec === undefined) {
                // 未通关：只有关号
                ctx.fillStyle = ART.textMain;
                ctx.font = font(s * 0.36, 700);
                ctx.fillText(e.label, x + s / 2, y + s * 0.48);
            }
            else {
                // 已通关：关号 + 最少失误/最佳用时记录（窄格自动缩字号防溢出）
                ctx.fillStyle = ART.textMain;
                ctx.font = font(s * 0.32, 700);
                ctx.fillText(e.label, x + s / 2, y + s * 0.4);
                const recTxt = `${e.minMistakes !== undefined ? `${e.minMistakes}误 ` : ''}${fmtTime(e.bestSec)}`;
                let fsRec = Math.max(9, s * 0.2);
                ctx.font = font(fsRec, 500);
                while (fsRec > 7 && ctx.measureText(recTxt).width > s - 8) {
                    fsRec -= 0.5;
                    ctx.font = font(fsRec, 500);
                }
                ctx.fillStyle = e.minMistakes === 0 ? '#43A047' : ART.textSub;
                ctx.fillText(recTxt, x + s / 2, y + s * 0.74);
            }
            ctx.restore();
        });
        cy += rowsOf(gr.entries.length) * (s + gap) - gap + 14;
    }
    return btns;
}
export function drawHud(ctx, dims, data) {
    const btns = [];
    const h = 52;
    ctx.fillStyle = ART.panel;
    ctx.fillRect(0, 0, dims.w, h);
    ctx.strokeStyle = ART.panelBorder;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, h + 0.5);
    ctx.lineTo(dims.w, h + 0.5);
    ctx.stroke();
    const back = { id: 'back', x: 8, y: 6, w: 40, h: 40, label: '‹', style: 'icon' };
    btns.push(back);
    drawBtn(ctx, back);
    const pause = { id: 'pause', x: dims.w - 48, y: 6, w: 40, h: 40, label: '‖', style: 'icon' };
    btns.push(pause);
    drawBtn(ctx, pause);
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillStyle = ART.textMain;
    ctx.font = font(15, 700);
    ctx.fillText(data.title, 56, 19);
    ctx.fillStyle = ART.textSub;
    ctx.font = font(11, 400);
    ctx.fillText(data.sub, 56, 37);
    ctx.textAlign = 'right';
    // 时间只做记录（不与限时比较、无超时红字）
    ctx.fillStyle = ART.textMain;
    ctx.font = font(15, 700, true);
    ctx.fillText(fmtTime(data.timeSec), dims.w - 58, 19);
    if (data.mistakes > 0) {
        ctx.fillStyle = ART.mistake;
        ctx.font = font(11, 600);
        ctx.fillText(`失误 ×${data.mistakes}`, dims.w - 58, 37);
    }
    else {
        ctx.fillStyle = ART.textSub;
        ctx.font = font(11, 400);
        ctx.fillText('零失误', dims.w - 58, 37);
    }
    if (data.practice) {
        ctx.fillStyle = '#FFF3E0';
        ctx.fillRect(0, h, dims.w, 20);
        ctx.fillStyle = '#E65100';
        ctx.font = font(11, 600);
        ctx.textAlign = 'center';
        ctx.fillText('练习模式 · 不计进度', dims.w / 2, h + 10);
    }
    return btns;
}
export function drawPause(ctx, dims, opts) {
    const pw = Math.min(360, dims.w - 48);
    // 面板高度随按钮数量与纪录行动态计算（矮屏先压按钮高度/间距）
    const n = opts.canRegen ? 5 : 4;
    const head = opts.record ? 88 : 66; // 标题区（含可选纪录行）
    let btnH = 48;
    let step = 58; // 按钮高 + 间距
    let ph = head + (n - 1) * step + btnH + 24; // 标题区 + 按钮 + 底边距
    const maxPh = Math.max(200, dims.h - 24);
    if (ph > maxPh) {
        const avail = maxPh - head - 24;
        btnH = Math.max(34, Math.floor((avail - (n - 1) * 8) / n));
        step = btnH + 8;
        ph = Math.min(maxPh, head + (n - 1) * step + btnH + 24);
    }
    const p = panel(ctx, dims, pw, ph);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = ART.textMain;
    ctx.font = font(20, 700);
    ctx.fillText('暂停', p.x + pw / 2, p.y + (opts.record ? 30 : 36));
    if (opts.record) {
        ctx.fillStyle = ART.textSub;
        ctx.font = font(12, 500);
        const r = opts.record;
        const txt = r.minMistakes !== undefined
            ? `纪录：${r.minMistakes}误 · ${fmtTime(r.bestSec)}`
            : `纪录：最佳 ${fmtTime(r.bestSec)}`;
        ctx.fillText(txt, p.x + pw / 2, p.y + 56);
    }
    const btns = [];
    const bw = pw - 56;
    let by = p.y + head;
    const mk = (id, label, style, disabled = false) => {
        const b = { id, x: p.x + 28, y: by, w: bw, h: btnH, label, style, disabled };
        btns.push(b);
        drawBtn(ctx, b);
        by += step;
    };
    mk('resume', '继续游戏', 'primary');
    mk('restart', '重新开始', 'ghost');
    if (opts.canRegen)
        mk('regen', '换一题（练习模式）', 'ghost');
    mk('gamehelp', '玩法说明', 'ghost');
    mk('quit', '返回', 'ghost');
    return btns;
}
/** 结算图形：把解画成迷你像素画（带浅色卡片衬底） */
function drawArtwork(ctx, level, cx, cy, size) {
    const w = level.width;
    const h = level.height;
    const colored = !!(level.colors && level.colors.length > 1);
    const cs = size / Math.max(w, h);
    const ox = cx - (w * cs) / 2;
    const oy = cy - (h * cs) / 2;
    // 卡片衬底
    ctx.save();
    ctx.fillStyle = '#FAFAF6';
    roundRect(ctx, ox - 12, oy - 12, w * cs + 24, h * cs + 24, 12);
    ctx.fill();
    ctx.strokeStyle = ART.panelBorder;
    ctx.lineWidth = 1;
    ctx.stroke();
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const v = level.solution[y][x];
            if (v === 0)
                continue;
            ctx.fillStyle = colored ? ART.palette[(v - 1) % ART.palette.length] : ART.fillBlack;
            ctx.fillRect(ox + x * cs - 0.3, oy + y * cs - 0.3, cs + 0.6, cs + 0.6);
        }
    }
    ctx.restore();
}
export function drawWin(ctx, dims, data) {
    const pw = Math.min(400, dims.w - 40);
    const btnCount = (data.hasNext ? 1 : 0) + 2;
    const fixed = 50 + 32 + 44 + 50 + (data.newRecord ? 24 : 0) + btnCount * 52 + 26;
    const phMax = Math.min(620, dims.h - 16);
    const art = Math.max(64, Math.min(170, phMax - fixed - 14));
    const ph = Math.min(dims.h - 16, fixed + art + 14);
    const p = panel(ctx, dims, pw, ph);
    const cxp = p.x + pw / 2;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = ART.textMain;
    ctx.font = font(22, 800);
    ctx.fillText(data.title, cxp, p.y + 30);
    // 完整图形（弹出动画：轻微缩放）
    const appear = Math.max(0, Math.min(1, data.t * 1.6));
    const artScale = 0.86 + 0.14 * easeOutBack(Math.min(1, appear));
    let cy = p.y + 50 + art / 2 + 7;
    ctx.save();
    ctx.globalAlpha = appear;
    ctx.translate(cxp, cy);
    ctx.scale(artScale, artScale);
    ctx.translate(-cxp, -cy);
    drawArtwork(ctx, data.level, cxp, cy, art);
    ctx.restore();
    cy += art / 2 + 7 + 22;
    // 关卡名揭晓
    ctx.fillStyle = ART.textMain;
    ctx.font = font(19, 800);
    ctx.fillText(`「${data.name}」`, cxp, cy);
    cy += 30;
    // 成绩记录：失误（本次 + 历史最少）
    ctx.font = font(13.5, 500);
    ctx.fillStyle = data.mistakes === 0 ? '#43A047' : ART.mistake;
    const minTxt = data.minMistakes !== undefined ? ` · 最少 ×${data.minMistakes}` : '';
    ctx.fillText(`${data.mistakes === 0 ? '零失误 ✓' : `失误 ×${data.mistakes}`}${minTxt}`, cxp, cy);
    cy += 21;
    // 成绩记录：用时（本次 + 历史最佳）
    ctx.font = font(13.5, 500);
    ctx.fillStyle = ART.textMain;
    const bestTxt = data.bestSec !== undefined ? ` · 最佳 ${fmtTime(data.bestSec)}` : '';
    ctx.fillText(`用时 ${fmtTime(data.timeSec)}${bestTxt}`, cxp, cy);
    cy += 21;
    // 新纪录提示
    if (data.newRecord) {
        ctx.fillStyle = ART.recordGold;
        ctx.font = font(13, 800);
        ctx.fillText('新纪录！', cxp, cy + 1);
        cy += 24;
    }
    const btns = [];
    const bw = pw - 56;
    let by = cy + 4;
    const mk = (id, label, style) => {
        const b = { id, x: p.x + 28, y: by, w: bw, h: 44, label, style };
        btns.push(b);
        drawBtn(ctx, b);
        by += 52;
    };
    if (data.hasNext)
        mk('win.next', '下一关', 'primary');
    mk('win.replay', '再玩一次', data.hasNext ? 'ghost' : 'primary');
    mk('win.home', data.isDaily ? '返回主菜单' : '返回选关', 'ghost');
    return btns;
}
function easeOutBack(t) {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}
export function drawTutorial(ctx, dims, page, idx, total) {
    const pw = Math.min(400, dims.w - 40);
    const hasDiag = !!page.diagram;
    const ph = hasDiag ? 470 : 330;
    const p = panel(ctx, dims, pw, ph);
    const cxp = p.x + pw / 2;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = ART.accent;
    ctx.font = font(12, 700);
    ctx.fillText(`新规则 ${idx + 1}/${total}`, cxp, p.y + 28);
    ctx.fillStyle = ART.textMain;
    ctx.font = font(21, 800);
    ctx.fillText(page.title, cxp, p.y + 56);
    let ty = p.y + 88;
    if (hasDiag) {
        drawDiagram(ctx, page.diagram, cxp, ty + 52, pw - 64);
        ty += 150;
    }
    ctx.textAlign = 'left';
    ctx.fillStyle = ART.textMain;
    ctx.font = font(14, 400);
    const lines = wrapText(ctx, page.body, pw - 64);
    for (const ln of lines) {
        ctx.fillText(ln, p.x + 32, ty + 10);
        ty += 24;
    }
    const btns = [];
    const by = p.y + ph - 62;
    const skip = { id: 'tut.skip', x: p.x + 28, y: by, w: (pw - 70) / 2, h: 44, label: '跳过', style: 'ghost' };
    const next = {
        id: 'tut.next',
        x: p.x + 42 + (pw - 70) / 2,
        y: by,
        w: (pw - 70) / 2,
        h: 44,
        label: idx + 1 >= total ? '开始游戏' : '下一页',
        style: 'primary',
    };
    btns.push(skip, next);
    drawBtn(ctx, skip);
    drawBtn(ctx, next);
    return btns;
}
function drawDiagram(ctx, kind, cx, cy, maxW) {
    let cs = Math.min(26, maxW / 7.5);
    if (kind === 'diagonals')
        cs = Math.min(21, maxW / 8); // 该图上下都要外扩线索带，格子更小
    ctx.save();
    if (kind === 'rowcol') {
        // 5 格行 + 线索 [2,1] → ##.#.
        const cells = [1, 1, 0, 1, 0];
        const x0 = cx - (cs * 5) / 2;
        const y0 = cy - cs / 2 + 14;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = ART.clueText;
        ctx.font = font(cs * 0.55, 700, true);
        ctx.fillText('2', x0 - cs * 0.8, y0 + cs * 0.5 - cs * 0.55);
        ctx.fillText('1', x0 - cs * 0.8, y0 + cs * 0.5 + cs * 0.55);
        for (let i = 0; i < 5; i++) {
            ctx.fillStyle = cells[i] ? ART.fillBlack : ART.cellEmpty;
            ctx.fillRect(x0 + i * cs, y0, cs - 1, cs - 1);
            ctx.strokeStyle = ART.cellBorder;
            ctx.lineWidth = 1;
            ctx.strokeRect(x0 + i * cs, y0, cs - 1, cs - 1);
        }
        ctx.fillStyle = ART.textSub;
        ctx.font = font(11, 400);
        ctx.fillText('线索 [2,1]：两段填色，长度 2 和 1，中间至少隔 1 空', cx, y0 + cs + 16);
    }
    else if (kind === 'colors') {
        // RRR BB（异色紧邻合法）
        const seq = [1, 1, 1, 2, 2];
        const x0 = cx - (cs * 5) / 2;
        const y0 = cy - cs / 2;
        for (let i = 0; i < 5; i++) {
            ctx.fillStyle = ART.palette[seq[i] - 1];
            ctx.fillRect(x0 + i * cs, y0, cs - 1, cs - 1);
        }
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = ART.textSub;
        ctx.font = font(11, 400);
        ctx.fillText('红3 蓝2 可紧邻；同为红色的两段之间必须 ≥1 空格', cx, y0 + cs + 16);
    }
    else if (kind === 'diagonals') {
        // 4×4 网格 + ↘ 蓝带（锚 NW 端，左上）+ ↙ 橙带（锚 NE 端，右上）
        const n = 4;
        const x0 = cx - (cs * n) / 2;
        const y0 = cy - (cs * n) / 2 + cs * 0.4;
        for (let y = 0; y < n; y++) {
            for (let x = 0; x < n; x++) {
                const fill = x === y || x + y === 3;
                ctx.fillStyle = fill ? ART.fillBlack : ART.cellEmpty;
                ctx.fillRect(x0 + x * cs, y0 + y * cs, cs - 1, cs - 1);
                ctx.strokeStyle = ART.cellBorder;
                ctx.strokeRect(x0 + x * cs, y0 + y * cs, cs - 1, cs - 1);
            }
        }
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        // ↘ 蓝带（左上角外）：主对角 d=0 有 4 连段 → "4"
        ctx.strokeStyle = ART.diagMainBg;
        ctx.lineWidth = cs * 0.7;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(x0 - cs * 0.15, y0 - cs * 0.15);
        ctx.lineTo(x0 - cs * 1.05, y0 - cs * 1.05);
        ctx.stroke();
        ctx.fillStyle = ART.clueText;
        ctx.font = font(cs * 0.5, 700, true);
        ctx.fillText('4', x0 - cs * 1.55, y0 - cs * 1.55);
        // ↙ 橙带（右上角外）：副对角 d=3 有 4 连段 → "4"
        ctx.strokeStyle = ART.diagAntiBg;
        ctx.beginPath();
        ctx.moveTo(x0 + n * cs + cs * 0.15, y0 - cs * 0.15);
        ctx.lineTo(x0 + n * cs + cs * 1.05, y0 - cs * 1.05);
        ctx.stroke();
        ctx.fillText('4', x0 + n * cs + cs * 1.55, y0 - cs * 1.55);
        ctx.lineCap = 'butt';
        ctx.font = font(11, 400);
        ctx.fillStyle = ART.textSub;
        ctx.fillText('↘ 蓝带 / ↙ 橙带：沿斜线方向的连续填色段', cx, y0 + n * cs + cs * 0.9);
    }
    ctx.restore();
}
// ---------- 生成中浮层 ----------
export function drawGenerating(ctx, dims, msg, frac) {
    const pw = Math.min(320, dims.w - 48);
    const ph = 130;
    const p = panel(ctx, dims, pw, ph);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = ART.textMain;
    ctx.font = font(15, 600);
    ctx.fillText(msg, p.x + pw / 2, p.y + 42);
    // 进度条（不确定进度时来回扫描）
    const bw = pw - 64;
    const bx = p.x + 32;
    const by = p.y + 72;
    ctx.fillStyle = '#ECEAE2';
    roundRect(ctx, bx, by, bw, 8, 4);
    ctx.fill();
    ctx.fillStyle = ART.accent;
    const w2 = frac > 0 ? Math.max(12, bw * Math.min(1, frac)) : bw * 0.3;
    const x2 = frac > 0 ? bx : bx + ((Date.now() / 12) % (bw - w2));
    roundRect(ctx, x2, by, w2, 8, 4);
    ctx.fill();
    ctx.fillStyle = ART.textSub;
    ctx.font = font(11, 400);
    ctx.fillText('所有题目保证逻辑唯一解', p.x + pw / 2, p.y + 100);
}
// ---------- 提示条 ----------
export function drawToast(ctx, dims, msg) {
    ctx.save();
    ctx.font = font(13, 600);
    const tw = ctx.measureText(msg).width + 36;
    const x = (dims.w - tw) / 2;
    const y = dims.h - 96;
    ctx.fillStyle = 'rgba(26,26,26,0.85)';
    roundRect(ctx, x, y, tw, 36, 18);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(msg, dims.w / 2, y + 18);
    ctx.restore();
}
// ---------- 帮助 ----------
export const HELP_PAGES = [
    {
        title: '数织是什么',
        body: '网格中藏着一幅图。每行左侧的数字 = 该行从左到右连续填色段的长度；每列顶部的数字 = 该列从上到下。\n' +
            '两个数字段之间至少有 1 个空格。空白（无数字）的行/列 = 整行全空。\n' +
            '把所有线索对上，图案自然浮现。每一题都保证逻辑唯一解，不需要猜。',
    },
    {
        title: '操作方式',
        body: '点按格子：用当前颜色填色（工具条可切换 填色/标记/擦除）。\n' +
            '长按（触屏）或右键（鼠标）：给格子打 X 备注，表示"推断此处为空"。X 是笔记，永远不会算失误。\n' +
            '彩色关卡先在色盘选色再填。\n' +
            '填错会立刻红标提示：不扣命、不阻断，擦掉改正即可，但本关"零失误"星会失去。',
    },
    {
        title: '彩色数织',
        body: '线索数字带颜色：格子要填成对应颜色。\n' +
            '不同颜色的两段可以紧邻（无需空格）；相同颜色的两段之间必须至少隔 1 个空格。\n' +
            '例：红3 蓝2 红1 = 先 3 格红，再 2 格蓝（可紧贴红），再 1 格红（可紧贴蓝）。',
    },
    {
        title: '对角线线索（本作创新）',
        body: '部分关卡在两个斜方向增加线索带：\n' +
            '↘ 主对角线（蓝色带）：从左上往右下读，带画在斜线起点端（左上/左侧）。\n' +
            '↙ 副对角线（橙色带）：从右上往左下读，带画在斜线起点端（右上/右侧）。\n' +
            '规则与行列完全相同：数字 = 沿斜线方向的连续填色段。\n' +
            '重要：没有画出线索带的斜线 = 这条斜线上全部为空！这是明确信息，大胆使用。\n' +
            '（窄屏下斜线带可能默认收起，点选格子可临时查看所在斜线，工具条可开关。）',
    },
    {
        title: '失误与用时记录',
        body: '通关即记录成绩：每关独立记录"最少失误次数"与"最佳用时"。\n' +
            '失误 = 填错颜色被红标的次数；零失误通关显示绿色标记。\n' +
            '可以反复重试刷新纪录，结算会提示"新纪录！"。\n' +
            '主线与挑战区现已全部开放（试玩模式，任选关卡）；每日一题按日期本地生成，全设备同题。',
    },
];
export function drawHelp(ctx, dims, page) {
    const pw = Math.min(440, dims.w - 32);
    const ph = Math.min(560, dims.h - 40);
    const p = panel(ctx, dims, pw, ph);
    const pg = HELP_PAGES[page];
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = ART.accent;
    ctx.font = font(12, 700);
    ctx.fillText(`玩法说明 ${page + 1}/${HELP_PAGES.length}`, p.x + pw / 2, p.y + 28);
    ctx.fillStyle = ART.textMain;
    ctx.font = font(20, 800);
    ctx.fillText(pg.title, p.x + pw / 2, p.y + 58);
    ctx.textAlign = 'left';
    ctx.font = font(14, 400);
    ctx.fillStyle = ART.textMain;
    const lines = wrapText(ctx, pg.body, pw - 64);
    let ty = p.y + 92;
    for (const ln of lines) {
        if (ty > p.y + ph - 90)
            break;
        ctx.fillText(ln, p.x + 32, ty);
        ty += 25;
    }
    const btns = [];
    const by = p.y + ph - 62;
    const bw = (pw - 84) / 3;
    const prev = { id: 'help.prev', x: p.x + 24, y: by, w: bw, h: 44, label: '‹ 上页', style: 'ghost', disabled: page === 0 };
    const back = { id: 'help.back', x: p.x + 36 + bw, y: by, w: bw, h: 44, label: '返回', style: 'primary' };
    const next = {
        id: 'help.next',
        x: p.x + 48 + bw * 2,
        y: by,
        w: bw,
        h: 44,
        label: '下页 ›',
        style: 'ghost',
        disabled: page >= HELP_PAGES.length - 1,
    };
    btns.push(prev, back, next);
    drawBtn(ctx, prev);
    drawBtn(ctx, back);
    drawBtn(ctx, next);
    return btns;
}
export { SANS };
