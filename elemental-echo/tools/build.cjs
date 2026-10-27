// 元素回响 — 单文件打包器
// 把 code/js 下的 ES Module 打包成一个经典脚本，内联进 HTML，
// 这样双击 HTML 也能运行（file:// 下 ES Module 会被 CORS 拦截）。
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const CODE = path.join(ROOT, 'code');
const ORDER = ['data.js', 'engine.js', 'run.js', 'fx.js', 'tap.js', 'ui.js', 'main.js'];

const IMPORT_NAMED = /^import\s*\{([\s\S]*?)\}\s*from\s*['"]([^'"]+)['"];?\s*$/;
const EXPORT_DECL = /^export\s+(const|let|var|function|class)\s+([A-Za-z_$][\w$]*)/;
const EXPORT_LIST = /^export\s*\{([^}]*)\}\s*;?\s*$/;

function transform(src, file) {
  const exported = new Set();
  const out = [];
  for (const raw of src.split(/\r?\n/)) {
    let line = raw;

    const imp = line.match(IMPORT_NAMED);
    if (imp) {
      const names = imp[1]
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .map((s) => s.replace(/\s+as\s+/, ': '))
        .join(', ');
      const from = imp[2].replace(/^\.\//, '');
      out.push(`const { ${names} } = __req(${JSON.stringify(from)});`);
      continue;
    }
    if (/^import\s+[^\s{]/.test(line)) {
      throw new Error(`${file}: default/namespace import not supported -> ${line}`);
    }

    const exp = line.match(EXPORT_DECL);
    if (exp) {
      exported.add(exp[2]);
      line = line.replace(/^export\s+/, '');
      out.push(line);
      continue;
    }

    const list = line.match(EXPORT_LIST);
    if (list) {
      list[1].split(',').map((s) => s.trim()).filter(Boolean).forEach((n) => exported.add(n));
      continue;
    }

    if (/^export\s+default/.test(line)) throw new Error(`${file}: export default not supported`);
    out.push(line);
  }

  if (exported.size) {
    const assign = [...exported].map((n) => `${n}: ${n}`).join(', ');
    out.push(`Object.assign(__exports, { ${assign} });`);
  }
  return out.join('\n');
}

function build() {
  const chunks = [];
  for (const name of ORDER) {
    const file = path.join(CODE, 'js', name);
    if (!fs.existsSync(file)) throw new Error('missing module: ' + name);
    const code = transform(fs.readFileSync(file, 'utf8'), name);
    chunks.push(`__mods[${JSON.stringify(name)}] = function (__exports, __req) {\n${code}\n};`);
  }

  const bundle = `(function () {
'use strict';
var __mods = {};
var __cache = {};
function __req(id) {
  if (__cache[id]) return __cache[id];
  var mod = {};
  __cache[id] = mod;
  var fn = __mods[id];
  if (!fn) throw new Error('module not found: ' + id);
  fn(mod, __req);
  return mod;
}
${chunks.join('\n\n')}
__req('main.js');
})();`;

  const css = fs.readFileSync(path.join(CODE, 'css', 'style.css'), 'utf8');
  const safeBundle = bundle.replace(/<\/script/gi, '<\\/script');

  const html = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no">
<meta name="theme-color" content="#0E1116">
<title>元素回响 Elemental Echo</title>
<style>
${css}
</style>
</head>
<body>
  <div id="app"></div>
  <canvas id="fx"></canvas>
  <script>
${safeBundle}
  </script>
</body>
</html>
`;

  const outFile = path.join(ROOT, '元素回响.html');
  fs.writeFileSync(outFile, html, 'utf8');

  // 上传 TapTap 用的目录形式（upload_h5_game 要求目录内有 index.html）
  const distDir = path.join(ROOT, 'dist');
  fs.mkdirSync(distDir, { recursive: true });
  fs.writeFileSync(path.join(distDir, 'index.html'), html, 'utf8');

  // 同时产出纯脚本，便于自动化测试
  fs.writeFileSync(path.join(__dirname, 'bundle.js'), safeBundle, 'utf8');

  const kb = (fs.statSync(outFile).size / 1024).toFixed(1);
  console.log(`built: ${outFile}`);
  console.log(`dist : ${path.join(distDir, 'index.html')}`);
  console.log(`size : ${kb} KB`);
  console.log(`script lines: ${safeBundle.split('\n').length}`);
}

build();
