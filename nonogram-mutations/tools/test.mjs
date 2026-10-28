// dev 工具：核心算法 sanity 测试（线索推导/求解器/生成器/PRNG）
// 用法：npm run build && node tools/test.mjs
import assert from 'node:assert';
import { deriveRuns, deriveClues, buildLines, mainDiagCells, antiDiagCells, diagCount } from '../build/core/clues.js';
import { countSolutions, isUnique } from '../build/core/solver.js';
import { mulberry32, hashString, dateSeed } from '../build/core/prng.js';
import { generateLevel } from '../build/core/generator.js';
import { stringsToGrid } from '../build/core/grid.js';

let passed = 0;
function t(name, fn) {
  fn();
  passed++;
  console.log('  ok -', name);
}

console.log('# prng');
t('mulberry32 确定性', () => {
  const a = mulberry32(42), b = mulberry32(42);
  for (let i = 0; i < 100; i++) assert.strictEqual(a(), b());
});
t('mulberry32 不同 seed 不同序列', () => {
  assert.notStrictEqual(mulberry32(1)(), mulberry32(2)());
});
t('dateSeed', () => {
  assert.strictEqual(dateSeed('2026-10-16'), 20261016);
});
t('hashString 稳定', () => {
  assert.strictEqual(hashString('m01'), hashString('m01'));
});

console.log('# clues');
t('deriveRuns 黑白', () => {
  const r = deriveRuns([0, 1, 1, 1, 0, 0, 1, 0]);
  assert.deepStrictEqual(r, [{ color: 1, len: 3 }, { color: 1, len: 1 }]);
});
t('deriveRuns 彩色（极大同色段）', () => {
  const r = deriveRuns([1, 1, 1, 2, 2, 1, 0, 3]);
  assert.deepStrictEqual(r, [
    { color: 1, len: 3 }, { color: 2, len: 2 }, { color: 1, len: 1 }, { color: 3, len: 1 },
  ]);
});
t('deriveRuns 全空', () => {
  assert.deepStrictEqual(deriveRuns([0, 0, 0]), []);
});
t('主对角格子顺序 NW→SE，d=y-x', () => {
  // 3×3：d=0 应为 (0,0),(1,1),(2,2)
  const cells = mainDiagCells(3, 3, 0 + (3 - 1)); // idx = d + (H-1)
  assert.deepStrictEqual(cells, [[0, 0], [1, 1], [2, 2]]);
  const dMinus2 = mainDiagCells(3, 3, -2 + 2); // d=-2: (2,0)
  assert.deepStrictEqual(dMinus2, [[2, 0]]);
});
t('副对角格子顺序 NE→SW，d=x+y', () => {
  const cells = antiDiagCells(3, 3, 2); // (2,0),(1,1),(0,2)
  assert.deepStrictEqual(cells, [[2, 0], [1, 1], [0, 2]]);
});
t('对角线条数 = W+H-1', () => {
  assert.strictEqual(diagCount(10, 15), 24);
});
t('buildLines 数量（双向对角线）', () => {
  const clues = deriveClues(stringsToGrid(['10', '01']), 2, 2, { diagonalEnabled: true });
  const lines = buildLines(2, 2, clues);
  assert.strictEqual(lines.length, 2 + 2 + 3 + 3);
});

console.log('# solver');
t('5×5 心形唯一解', () => {
  const sol = stringsToGrid(['.#.#.', '#####', '#####', '.###.', '..#..']);
  const clues = deriveClues(sol, 5, 5, { diagonalEnabled: false });
  assert.ok(isUnique(5, 5, clues, 1));
});
t('欠约束 → 多解（计数>1）', () => {
  // 单个 1 在 5×5 中：行 [1]×5 列 [1]×5 → 多解
  const clues = {
    rows: [[{ color: 1, len: 1 }], [{ color: 1, len: 1 }], [{ color: 1, len: 1 }], [{ color: 1, len: 1 }], [{ color: 1, len: 1 }]],
    cols: [[{ color: 1, len: 1 }], [{ color: 1, len: 1 }], [{ color: 1, len: 1 }], [{ color: 1, len: 1 }], [{ color: 1, len: 1 }]],
  };
  const r = countSolutions(5, 5, clues, 1, { limit: 2 });
  assert.strictEqual(r.count, 2); // 至少 2（提前截断）
});
t('彩色异色段可紧邻（§2.3）', () => {
  // 1×3 行 [红1, 蓝1]：合法放置 RB. / .RB / R.B → 3 解
  const clues = {
    rows: [[{ color: 1, len: 1 }, { color: 2, len: 1 }]],
    cols: [[], [{ color: 1, len: 1 }], [{ color: 2, len: 1 }]], // 固定为 R,B 相邻? 列1=红 列2=蓝 → 唯一? 行还有位置0空: .RB 唯一
  };
  // 行3格：cols: col0=[], col1=[红1], col2=[蓝1] → 解 = .RB 唯一
  assert.ok(isUnique(3, 1, clues, 2));
});
t('彩色同色段必须隔空（§2.3）', () => {
  // 仅行约束 [红1,红1]：1×2 放不下（同色 token 间必须 ≥1 空）→ 0 解
  const clues2 = { rows: [[{ color: 1, len: 1 }, { color: 1, len: 1 }]], cols: [[], []] };
  const r2 = countSolutions(2, 1, clues2, 2, { families: ['row'], limit: 2 });
  assert.strictEqual(r2.count, 0);
  // 1×3 → 恰好 1 解（R.R）
  const clues3 = { rows: [[{ color: 1, len: 1 }, { color: 1, len: 1 }]], cols: [[], [], []] };
  const r3 = countSolutions(3, 1, clues3, 2, { families: ['row'], limit: 2 });
  assert.strictEqual(r3.count, 1);
  assert.deepStrictEqual(Array.from(r3.first), [1, 0, 1]);
});
t('彩色异色段可紧邻（枚举语义复核）', () => {
  // 仅行约束 [红1,蓝1]：1×2 → 恰好 1 解（RB 紧邻合法）
  const clues = { rows: [[{ color: 1, len: 1 }, { color: 2, len: 1 }]], cols: [[], []] };
  const r = countSolutions(2, 1, clues, 2, { families: ['row'], limit: 2 });
  assert.strictEqual(r.count, 1);
  assert.deepStrictEqual(Array.from(r.first), [1, 2]);
});
t('未显示对角线=全空 参与约束（§2.4）', () => {
  // 2×2，行列均 [1] → 无对角线信息时 2 解（主对角填充 / 副对角填充）
  const cluesNoDiag = {
    rows: [[{ color: 1, len: 1 }], [{ color: 1, len: 1 }]],
    cols: [[{ color: 1, len: 1 }], [{ color: 1, len: 1 }]],
  };
  assert.strictEqual(countSolutions(2, 2, cluesNoDiag, 1, { limit: 2 }).count, 2);
  // 解 = 主对角填充 (0,0),(1,1)。主对角 d=±1 未显示（全空）→ 排除 (1,0),(0,1) → 唯一
  const withDiag = {
    ...cluesNoDiag,
    diagMain: [undefined, [{ color: 1, len: 2 }], undefined],
    diagAnti: [[{ color: 1, len: 1 }], undefined, [{ color: 1, len: 1 }]],
  };
  const r = countSolutions(2, 2, withDiag, 1, { limit: 2 });
  assert.strictEqual(r.count, 1);
  assert.deepStrictEqual(Array.from(r.first), [1, 0, 0, 1]);
});

console.log('# generator');
t('mono 5×5 生成（seeded，唯一解）', () => {
  const spec = {
    id: 't-mono', kind: 'mono', width: 5, height: 5, diagonalEnabled: false,
    parTimeSec: 25, type: 'mainline', gen: { budget: 300 },
  };
  const res = generateLevel(spec, mulberry32(hashString('t-mono')));
  assert.ok(res.level, 'generation failed');
  assert.ok(isUnique(5, 5, res.level.clues, 1));
});
t('模板剪影生成（heart5 唯一解）', () => {
  const spec = {
    id: 't-tpl', kind: 'silhouette', width: 5, height: 5, diagonalEnabled: false,
    template: 'heart5', parTimeSec: 25, type: 'mainline', gen: { budget: 40 },
  };
  const res = generateLevel(spec, mulberry32(7));
  assert.ok(res.level, 'template generation failed');
  assert.ok(isUnique(5, 5, res.level.clues, 1));
});
t('彩色 8×8 生成', () => {
  const spec = {
    id: 't-color', kind: 'colored', width: 8, height: 8, colors: [1, 2], diagonalEnabled: false,
    parTimeSec: 60, type: 'mainline', gen: { budget: 400 },
  };
  const res = generateLevel(spec, mulberry32(hashString('t-color')));
  assert.ok(res.level, 'colored generation failed');
  assert.ok(isUnique(8, 8, res.level.clues, 2));
});
t('对角线 8×8 生成（承重优先）', () => {
  const spec = {
    id: 't-diag', kind: 'diagonal', width: 8, height: 8, diagonalEnabled: true,
    parTimeSec: 90, type: 'mainline', gen: { budget: 200 },
  };
  const res = generateLevel(spec, mulberry32(hashString('t-diag')));
  assert.ok(res.level, 'diagonal generation failed');
  assert.ok(isUnique(8, 8, res.level.clues, 1));
});

console.log(`\n${passed} tests passed`);
