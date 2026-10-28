import { parTimeSec } from '../config.js';
import { buildLevelFromSpec } from './levels.js';
const S = [];
// 各阶段学习曲线（下标 = 阶段内第几关）：首关宽松，逐步收敛
const PAR_MULT = {
    s1: [2.5, 2.0, 1.6, 1.4, 1.2, 1.2, 1.1, 1.1],
    s2: [2.2, 1.9, 1.7, 1.6, 1.45, 1.3, 1.15, 1.05],
    s3: [2.2, 2.0, 1.8, 1.6, 1.5, 1.4, 1.25, 1.15, 1.05, 1.0],
    s4: [1.3, 1.2, 1.1, 1.05, 1.0, 1.0, 1.0, 1.0, 1.0],
};
function stageMult(n) {
    if (n <= 8)
        return PAR_MULT.s1[n - 1];
    if (n <= 16)
        return PAR_MULT.s2[n - 9];
    if (n <= 26)
        return PAR_MULT.s3[n - 17];
    return PAR_MULT.s4[n - 27];
}
function spec(n, partial) {
    const id = 'm' + String(n).padStart(2, '0');
    // 基础 par（含规则系数：彩色/对角线 ×1.5）再乘学习曲线
    const opts = partial.kind === 'colored' ? { colored: true } : partial.kind === 'diagonal' ? { diagonal: true } : {};
    const base = parTimeSec(partial.width, partial.height, opts);
    const par = Math.max(20, Math.round((base * stageMult(n)) / 5) * 5);
    S.push({
        ...partial,
        parTimeSec: partial.parTimeSec ?? par,
        id,
        type: 'mainline',
        index: n - 1,
    });
}
// ---------- S1 黑白入门（1–8）：5×5 → 10×10，教行列线索、X 标记、失误红标 ----------
spec(1, { kind: 'mono', width: 5, height: 5, diagonalEnabled: false, template: 'heart5', title: '初见数织', tutorial: ['basics1'] });
spec(2, { kind: 'mono', width: 5, height: 5, diagonalEnabled: false, template: 'cross5', title: '十字星光', tutorial: ['basics2'] });
spec(3, { kind: 'mono', width: 6, height: 6, diagonalEnabled: false, template: 'diamond6', title: '钻石' });
spec(4, { kind: 'mono', width: 6, height: 6, diagonalEnabled: false, template: 'frame6', title: '相框' });
spec(5, { kind: 'mono', width: 8, height: 7, diagonalEnabled: false, template: 'heart8', title: '大心心' });
spec(6, { kind: 'mono', width: 8, height: 8, diagonalEnabled: false, template: 'hourglass8', title: '沙漏' });
spec(7, { kind: 'mono', width: 10, height: 10, diagonalEnabled: false, title: '随机初探', gen: { density: 0.5 } });
spec(8, { kind: 'mono', width: 10, height: 10, diagonalEnabled: false, title: '渐入佳境', gen: { density: 0.55 } });
// ---------- S2 彩色（9–16）：10×10，2–3 色，平滑过渡 ----------
// 先用"分离色块"（色块间留 1 格空隙，读数简单）熟悉选色填涂，
// 中间尝一次稀疏 Voronoi，再回到 3 色分离块，最后 Voronoi 密度爬坡到常规难度。
spec(9, { kind: 'colored', width: 10, height: 10, colors: [1, 2], diagonalEnabled: false, title: '双色初绽', tutorial: ['colors'], gen: { separate: true, density: 0.5 } });
spec(10, { kind: 'colored', width: 10, height: 10, colors: [1, 2], diagonalEnabled: false, title: '红蓝之舞', gen: { separate: true } });
spec(11, { kind: 'colored', width: 10, height: 10, colors: [1, 2], diagonalEnabled: false, title: '双色拼贴', gen: { density: 0.5 } });
spec(12, { kind: 'colored', width: 10, height: 10, colors: [1, 2, 3], diagonalEnabled: false, title: '三色世界', gen: { separate: true } });
spec(13, { kind: 'colored', width: 10, height: 10, colors: [1, 2, 3], diagonalEnabled: false, title: '彩虹碎片', gen: { separate: true } });
spec(14, { kind: 'colored', width: 10, height: 10, colors: [1, 2, 3], diagonalEnabled: false, title: '马赛克', gen: { density: 0.55 } });
spec(15, { kind: 'colored', width: 10, height: 10, colors: [1, 2, 3], diagonalEnabled: false, title: '调色盘', gen: { density: 0.6 } });
spec(16, { kind: 'colored', width: 10, height: 10, colors: [1, 2, 3], diagonalEnabled: false, title: '彩色结业', gen: { density: 0.65 } });
// ---------- S3 对角线（17–26）：10×10 → 13×13，教斜向线索、"空斜线=全空" ----------
// 难度下调（用户反馈）：网格 12/15 压到 11/12/13，密度 0.45–0.46 降到 0.40–0.44；
// 保留 单向↘ / 单向↙ / 双向 交替的教学节奏与"承重"要求（对角线索必须真实参与解题，§7.5）
spec(17, { kind: 'diagonal', width: 10, height: 10, diagonalEnabled: true, diagonalDirections: ['main'], title: '斜线初现 ↘', tutorial: ['diagonals', 'diagEmpty'], gen: { density: 0.4 } });
spec(18, { kind: 'diagonal', width: 10, height: 10, diagonalEnabled: true, diagonalDirections: ['anti'], title: '斜线初现 ↙', gen: { density: 0.4 } });
spec(19, { kind: 'diagonal', width: 10, height: 10, diagonalEnabled: true, title: '双向交织', gen: { density: 0.42 } });
spec(20, { kind: 'diagonal', width: 11, height: 11, diagonalEnabled: true, diagonalDirections: ['main'], title: '主对角走廊', gen: { density: 0.42 } });
spec(21, { kind: 'diagonal', width: 11, height: 11, diagonalEnabled: true, diagonalDirections: ['anti'], title: '副对角走廊', gen: { density: 0.42 } });
spec(22, { kind: 'diagonal', width: 11, height: 11, diagonalEnabled: true, title: '斜光掠影', gen: { density: 0.42 } });
spec(23, { kind: 'diagonal', width: 12, height: 12, diagonalEnabled: true, diagonalDirections: ['main'], title: '大斜阵 ↘', gen: { density: 0.42 } });
spec(24, { kind: 'diagonal', width: 12, height: 12, diagonalEnabled: true, diagonalDirections: ['anti'], title: '大斜阵 ↙', gen: { density: 0.42 } });
spec(25, { kind: 'diagonal', width: 13, height: 13, diagonalEnabled: true, title: '斜线纵横', gen: { density: 0.42 } });
spec(26, { kind: 'diagonal', width: 13, height: 13, diagonalEnabled: true, title: '斜线结业', gen: { density: 0.44 } });
// ---------- S4 剪影（27–35）：贴合网格放置，解出可爱形状 ----------
// 模板尺寸与网格只差 0–2 格（居中分缝），避免大片全空行/列
spec(27, { kind: 'silhouette', width: 10, height: 10, diagonalEnabled: false, template: 'heart10', title: '心意', tutorial: ['silhouette'] });
spec(28, { kind: 'silhouette', width: 10, height: 10, diagonalEnabled: false, template: 'mushroom9', title: '蘑菇屋' });
spec(29, { kind: 'silhouette', width: 10, height: 10, diagonalEnabled: false, template: 'cat10', title: '猫咪' });
spec(30, { kind: 'silhouette', width: 13, height: 10, diagonalEnabled: false, template: 'fish12', title: '小鱼游游' });
spec(31, { kind: 'silhouette', width: 12, height: 11, diagonalEnabled: false, template: 'duck11', title: '鸭子嘎嘎' });
spec(32, { kind: 'silhouette', width: 12, height: 13, diagonalEnabled: false, template: 'rabbit11', title: '兔子跳跳' });
spec(33, { kind: 'silhouette', width: 13, height: 11, diagonalEnabled: false, template: 'swan12', title: '天鹅湖' });
spec(34, { kind: 'silhouette', width: 12, height: 12, diagonalEnabled: false, template: 'sailboat11', title: '远航' });
spec(35, { kind: 'silhouette', width: 14, height: 15, diagonalEnabled: false, template: 'rocket13', title: '一飞冲天' });
export const MAINLINE_SPECS = S;
let cached = null;
export function getMainlineLevels() {
    if (!cached)
        cached = MAINLINE_SPECS.map(buildLevelFromSpec);
    return cached;
}
