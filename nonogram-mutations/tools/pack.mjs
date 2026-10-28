// dev 工具：单文件打包 — build/*.js（ES 模块）+ styles.css → release/pkg/index.html
// 产物为经典 script（每模块 IIFE + 命名空间互访），file:// 协议双击可直接游玩，
// 规避 ES 模块在 file:// 下的 CORS 限制。零运行时依赖、离线可玩。
// 用法：npm run build && node tools/pack.mjs
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { resolve, dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const BUILD = join(ROOT, 'build');
const OUT_DIR = join(ROOT, 'release', 'pkg');
mkdirSync(OUT_DIR, { recursive: true });

function walk(d, out = []) {
  for (const f of readdirSync(d, { withFileTypes: true })) {
    if (f.isDirectory()) walk(join(d, f.name), out);
    else if (f.name.endsWith('.js')) out.push(join(d, f.name));
  }
  return out;
}

const nsOf = (abs) => '__mod_' + relative(BUILD, abs).replace(/[\\/.\-]/g, '_').replace(/_js$/, '');

// ---------- 1) 解析各模块：依赖、导入名、导出名，剥掉 import/export ----------
const modules = new Map(); // absPath -> { ns, deps, prelude, body, exported }
for (const file of walk(BUILD)) {
  const src = readFileSync(file, 'utf8');
  const deps = [];
  const prelude = []; // 依赖命名空间的解构声明
  let body = src;

  // import { a, b as c } from './x.js';  （本项目全部为单行命名导入）
  body = body.replace(/^import\s*\{([^}]*)\}\s*from\s*['"]([^'"]+)['"];?\s*$/gm, (_line, clause, spec) => {
    const dep = resolve(dirname(file), spec);
    deps.push(dep);
    const names = clause
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((n) => {
        const m = n.match(/^([\w$]+)\s+as\s+([\w$]+)$/);
        return m ? m[1] + ': ' + m[2] : n; // import 重命名 → 解构重命名
      });
    prelude.push('const { ' + names.join(', ') + ' } = ' + nsOf(dep) + ';');
    return '';
  });
  // 防御：副作用导入（调研确认本项目没有）
  body = body.replace(/^import\s*['"][^'"]+['"];?\s*$/gm, '');

  // export 声明：剥前缀并收集导出名
  const exported = [];
  body = body.replace(
    /^export\s+(async\s+function|function|class|const|let|var)\s+([\w$]+)/gm,
    (_full, kw, name) => {
      exported.push(name);
      return kw + ' ' + name;
    }
  );
  // 花括号 re-export：export { a, b };（名字已是本作用域绑定）
  body = body.replace(/^export\s*\{([^}]*)\}\s*;?\s*$/gm, (_full, clause) => {
    for (const n of clause
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)) {
      const m = n.match(/^([\w$]+)\s+as\s+([\w$]+)$/);
      exported.push(m ? m[2] : n);
    }
    return '';
  });
  if (/^export\s+default/m.test(body)) throw new Error('不支持 default export: ' + file);
  if (/^(import|export)\b/m.test(body)) throw new Error('存在未处理的 import/export 形态: ' + file);

  modules.set(file, { ns: nsOf(file), deps, prelude, body, exported });
}

// ---------- 2) 从 main.js 出发做拓扑排序（依赖在前；循环引用直接报错） ----------
const order = [];
const state = new Map(); // 0 未访问 / 1 访问中 / 2 完成
function visit(file) {
  const st = state.get(file) ?? 0;
  if (st === 2) return;
  if (st === 1) throw new Error('循环引用: ' + file);
  state.set(file, 1);
  for (const d of modules.get(file).deps) if (modules.has(d)) visit(d);
  state.set(file, 2);
  order.push(file);
}
visit(join(BUILD, 'main.js'));

// ---------- 3) 拼接 + 内联 ----------
let js = "'use strict';\n// 数织异化 · 单文件离线版（由 tools/pack.mjs 从 build/ 生成，勿手改）\n";
for (const file of order) {
  const m = modules.get(file);
  const rel = relative(BUILD, file).replace(/\\/g, '/');
  js += `// ===== ${rel} =====\nconst ${m.ns} = (() => {\n`;
  if (m.prelude.length) js += m.prelude.join('\n') + '\n';
  js += m.body.trimEnd() + '\n';
  js += `return { ${m.exported.join(', ')} };\n})();\n`;
}
if (js.includes('</script')) throw new Error('JS 内联包含 </script，会破坏 HTML');

const css = readFileSync(join(ROOT, 'styles.css'), 'utf8');
const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
<meta name="theme-color" content="#F5F5F0" />
<title>数织异化 · Nonogram Mutations</title>
<style>
${css}</style>
</head>
<body>
<canvas id="board"></canvas>
<script>
${js}</script>
</body>
</html>
`;
writeFileSync(join(OUT_DIR, 'index.html'), html);

// ---------- 4) README.txt（UTF-8 BOM，Windows 记事本可正确显示中文） ----------
const readme = `数织异化 · Nonogram Mutations
================================
版本：v1.1（2026-10-23）

纯前端数织（Nonogram）玩法展示：黑白 → 彩色 → 对角线 → 剪影，四阶段 35 关主线教学 + 15 关挑战 + 每日一题。

【开始游戏】
直接双击 index.html 即可在浏览器中游玩。
单文件离线版：无需联网、无需安装、零外部依赖。推荐 Chrome / Edge / Firefox 最新版。

【玩法】
· 左侧/顶部数字 = 该行/列"连续填色段"长度，段间至少隔 1 个空格。
· 点按填色；长按（触屏）或右键（鼠标）打 X 备注空格，X 永不算失误。
· 彩色关：底部色盘选色；不同颜色段可紧邻，同色段间必须隔 1 格。
· 对角线关：↘ 主对角（蓝色带）与 ↙ 副对角（橙色带）是斜向线索；
  没有画出线索带的斜线 = 该斜线全部为空（明确信息，大胆打 X）。
  点按格子会高亮它所在的斜线带；窄屏下斜线带可收起，工具条可开关。
· 剪影关：答案是一幅剪影小画，通关即揭晓。
· 填错颜色会红标提醒：不扣命、不阻断，但会记入失误数。

【成绩记录】
每关独立记录"最少失误次数"与"最佳用时"（保存在本机浏览器，清浏览器数据会丢失）。
换一题 = 练习模式（不记成绩）。

【关于】
设计规格驱动 + 用户反馈迭代；纯 TypeScript + Canvas 实现，无任何运行时框架。
`;
writeFileSync(join(OUT_DIR, 'README.txt'), '\ufeff' + readme, 'utf8');

console.log(`pack ok: ${order.length} 个模块 → ${join('release', 'pkg', 'index.html')}`);
console.log(`  index.html ${(html.length / 1024).toFixed(1)} KB，README.txt ${(readme.length / 1024).toFixed(1)} KB`);
