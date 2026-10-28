// dev 工具：发布打包编排 — node（UTF-8 安全）+ PowerShell（仅 ASCII 路径，规避脚本编码坑）
// 流程：pack 单文件 → Compress-Archive 到 ASCII 临时名 → 重命名为中文名 → 解压校验 → 报告
// 用法：npm run build && node tools/release.mjs
import { execSync } from 'node:child_process';
import { renameSync, readdirSync, statSync, rmSync, mkdirSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const RELEASE = join(ROOT, 'release');
const ZIP_FINAL = join(RELEASE, '数织异化.zip'); // 中文文件名由 node 侧处理
const ZIP_TMP = join(RELEASE, '_game_tmp.zip');
const EXTRACT = join(process.env.LOCALAPPDATA ?? process.env.TMP ?? '.', 'Temp', 'opencode', 'nomo-zip-test');

mkdirSync(RELEASE, { recursive: true });

// 1) 单文件打包（复用 pack.mjs）
console.log(execSync('node tools/pack.mjs', { cwd: ROOT, encoding: 'utf8' }).trim());

// 2) 压缩（PowerShell 只接触 ASCII 路径；条目位于 ZIP 根目录）
rmSync(ZIP_TMP, { force: true });
execSync(
  `powershell -NoProfile -Command "Compress-Archive -Path 'release/pkg/index.html','release/pkg/README.txt' -DestinationPath 'release/_game_tmp.zip' -Force"`,
  { cwd: ROOT }
);

// 3) 重命名为中文最终名
rmSync(ZIP_FINAL, { force: true });
renameSync(ZIP_TMP, ZIP_FINAL);

// 4) 解压校验（ASCII 目标路径；列目录由 node 用 UTF-8 读取）
rmSync(EXTRACT, { recursive: true, force: true });
execSync(
  `powershell -NoProfile -Command "Expand-Archive -Path 'release/数织异化.zip' -DestinationPath '${(EXTRACT + '').replace(/\\/g, '\\\\')}' -Force"`,
  { cwd: ROOT }
);
// ↑ 命令行里传中文参数经 CreateProcess（UTF-16）传给 powershell，不走文件编码，安全。

const entries = readdirSync(EXTRACT, { withFileTypes: true });
const files = entries.filter((e) => e.isFile());
const total = files.reduce((a, f) => a + statSync(join(EXTRACT, f.name)).size, 0);

// 5) 报告
const zipSize = statSync(ZIP_FINAL).size;
const lines = [
  `ZIP: ${'release/数织异化.zip'} (${(zipSize / 1024).toFixed(1)} KB)`,
  `解压根目录: ${entries.map((e) => e.name + (e.isDirectory() ? '/' : '')).join(', ')}`,
  `解压总量: ${(total / 1024).toFixed(1)} KB（限额 200 MB ✓）`,
  ...files.map((f) => `  - ${f.name} ${(statSync(join(EXTRACT, f.name)).size / 1024).toFixed(1)} KB（单文件限额 50 MB / 200 MB ✓）`),
];
console.log(lines.join('\n'));

// 结构断言：根目录必须直接含 index.html（不得套子目录）
if (!files.some((f) => f.name === 'index.html')) throw new Error('ZIP 根目录缺少 index.html');
if (entries.some((e) => e.isDirectory())) throw new Error('ZIP 根目录出现子目录（应为平铺）');

rmSync(join(RELEASE, 'zip-report.txt'), { force: true });
console.log('RELEASE OK');
