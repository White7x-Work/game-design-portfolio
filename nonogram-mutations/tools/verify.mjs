// dev 工具：验收校验 — 规格 §10 总验收标准的离线复核
// 1) 50 关全部存在且逻辑唯一解（独立重算线索 + 计数解）
// 2) 关卡结构符合 §3.1 分布与 D11 网格上限
// 3) 每日一题：日期种子确定性（同日两次生成结果一致）、10×10、无对角线
// 用法：npm run build && node tools/verify.mjs
import { MAINLINE_SPECS } from '../build/levels/mainline.js';
import { CHALLENGE_SPECS } from '../build/levels/challenge.js';
import { buildLevelFromSpec } from '../build/levels/levels.js';
import { countSolutions } from '../build/core/solver.js';
import { deriveClues } from '../build/core/clues.js';
import { generateLevel } from '../build/core/generator.js';
import { mulberry32, dateSeed } from '../build/core/prng.js';
import { dailySpecFor } from '../build/levels/daily.js';
import { gridToStrings } from '../build/core/grid.js';

let fails = 0;
const fail = (msg) => {
  fails++;
  console.error('  ✗ ' + msg);
};
const ok = (msg) => console.log('  ✓ ' + msg);

console.log('# 1. 关卡数量与分布（§3.1）');
if (MAINLINE_SPECS.length === 35) ok('主线 35 关');
else fail(`主线应 35 关，实际 ${MAINLINE_SPECS.length}`);
if (CHALLENGE_SPECS.length === 15) ok('挑战 15 关');
else fail(`挑战应 15 关，实际 ${CHALLENGE_SPECS.length}`);

const ids = new Set();
for (const s of [...MAINLINE_SPECS, ...CHALLENGE_SPECS]) {
  if (ids.has(s.id)) fail('重复 id: ' + s.id);
  ids.add(s.id);
}

console.log('# 2. 阶段规则结构');
function check(cond, msg) {
  if (cond) return true;
  fail(msg);
  return false;
}
const stage = (i) => (i < 8 ? 'S1' : i < 16 ? 'S2' : i < 26 ? 'S3' : 'S4');
MAINLINE_SPECS.forEach((s, i) => {
  const st = stage(i);
  if (st === 'S1')
    check(s.kind === 'mono' && !s.diagonalEnabled && !s.colors && s.width <= 10 && s.width >= 5, `m${i + 1} S1 应为黑白 5..10`);
  if (st === 'S2')
    check(
      s.kind === 'colored' && s.colors && s.colors.length >= 2 && s.colors.length <= 3 && s.width === 10 && !s.diagonalEnabled,
      `m${i + 1} S2 应为彩色2-3色 10×10`
    );
  if (st === 'S3')
    check(
      s.kind === 'diagonal' && s.diagonalEnabled && (!s.colors || s.colors.length <= 1) && s.width >= 10 && s.width <= 15,
      `m${i + 1} S3 应为黑白对角线 10..15 (D12)`
    );
  if (st === 'S4')
    check(
      s.kind === 'silhouette' && !!s.template && !s.diagonalEnabled && (!s.colors || s.colors.length <= 1) && s.width >= 10 && s.width <= 15,
      `m${i + 1} S4 应为黑白剪影模板 10..15`
    );
  check(s.width <= 15 && s.height <= 15, `m${i + 1} 主线网格 ≤15×15 (D11)`);
});
CHALLENGE_SPECS.forEach((s, i) => {
  const n = i + 1;
  if (n <= 5)
    check(s.colors && s.colors.length > 1 && !!s.template && !s.diagonalEnabled, `c${n} 应为彩色剪影`);
  else if (n <= 10)
    check(s.diagonalEnabled && (!s.colors || s.colors.length <= 1) && !s.template, `c${n} 应为高难黑白对角线`);
  else if (n <= 13)
    check(s.diagonalEnabled && s.colors && s.colors.length > 1 && !s.template, `c${n} 应为彩色×对角线`);
  else check(s.diagonalEnabled && s.colors && s.colors.length > 1 && !!s.template, `c${n} 应为全规则叠加`);
  check(s.width <= 20 && s.height <= 20, `c${n} 挑战网格 ≤20×20 (D11)`);
});
if (fails === 0) ok('阶段结构与网格上限符合规格');

console.log('# 3. 全部 50 关逻辑唯一解（§10.1）+ 线索一致性');
import { hasEmptyLine } from '../build/core/grid.js';
for (const s of [...MAINLINE_SPECS, ...CHALLENGE_SPECS]) {
  const level = buildLevelFromSpec(s);
  const k = s.colors ? Math.max(...s.colors) : 1;
  // 线索与内嵌解一致（尺寸以实际关卡为准：剪影/挑战为裁掉贴边空行列后的紧网格）
  const re = deriveClues(level.solution, level.width, level.height, {
    diagonalEnabled: s.diagonalEnabled,
    diagonalDirections: s.diagonalEnabled ? (s.diagonalDirections ?? ['main', 'anti']) : undefined,
  });
  const same = JSON.stringify(re) === JSON.stringify(level.clues);
  if (!same) fail(`${s.id} 线索与解不一致`);
  // 剪影/挑战：不允许任何全空行列（"多余无用行列"已删除）
  if ((s.kind === 'silhouette' || s.type === 'challenge') && hasEmptyLine(level.solution, level.width, level.height)) {
    fail(`${s.id} 剪影/挑战关仍存在全空行/列`);
  }
  // 尺寸不超出生成规格
  if (level.width > s.width || level.height > s.height) fail(`${s.id} 实际尺寸超出规格`);
  // 唯一解
  const r = countSolutions(level.width, level.height, level.clues, k, { limit: 2 });
  if (r.count !== 1 || r.budgetExceeded) fail(`${s.id} 非唯一解（count=${r.count}, budget=${r.budgetExceeded}）`);
  if (!(s.parTimeSec > 0)) fail(`${s.id} parTimeSec 无效`);
}
if (fails === 0) ok('50/50 唯一解、线索一致、parTime 有效、剪影/挑战无空行列');

console.log('# 4. 每日一题（§3.1/§8）');
{
  const dateStr = '2026-10-16';
  const mk = () => {
    const rng = mulberry32(dateSeed(dateStr));
    const spec = dailySpecFor(dateStr, rng);
    const res = generateLevel(spec, rng);
    return { spec, sol: res.level ? gridToStrings(res.level.solution).join('|') : null };
  };
  const a = mk();
  const b = mk();
  check(a.sol !== null, '每日题生成成功');
  check(a.sol === b.sol, '同日期种子两次生成一致（跨设备确定性）');
  check(a.spec.width === 10 && a.spec.height === 10, '每日题 10×10');
  check(!a.spec.diagonalEnabled, '每日题不含对角线');
  check(a.spec.kind === 'mono' || (a.spec.colors && a.spec.colors.length === 2), '每日题为黑白或 2 色彩色');
  check(a.spec.id === 'daily-20261016', '每日题 id = daily-YYYYMMDD');
  const c = mulberry32(dateSeed('2026-10-17'));
  const spec2 = dailySpecFor('2026-10-17', c);
  const res2 = generateLevel(spec2, c);
  check(res2.level && gridToStrings(res2.level.solution).join('|') !== a.sol, '次日换题');
}

console.log('# 5. 再生成能力抽查（§10.2：同规则、新种子、唯一解）');
{
  for (const id of ['m07', 'm23', 'c11']) {
    const s = [...MAINLINE_SPECS, ...CHALLENGE_SPECS].find((x) => x.id === id);
    const rng = mulberry32(Date.now() >>> 0);
    const res = generateLevel({ ...s, gen: { ...s.gen, budget: s.gen?.budget } }, rng);
    if (!res.level) fail(`${id} 再生成超预算`);
    else {
      const k = s.colors ? Math.max(...s.colors) : 1;
      const r = countSolutions(res.level.width, res.level.height, res.level.clues, k, { limit: 2 });
      if (r.count !== 1 || r.budgetExceeded) fail(`${id} 再生成题目非唯一解`);
    }
  }
  if (fails === 0) ok('m07/m23/c11 现场再生成均为唯一解');
}

console.log(fails === 0 ? '\nVERIFY PASS ✅' : `\nVERIFY FAIL ❌ (${fails})`);
process.exit(fails === 0 ? 0 : 1);
