# 游戏设计作品集 · 许云翔

[![Deploy](https://github.com/White7x-Work/game-design-portfolio/actions/workflows/pages.yml/badge.svg)](https://github.com/White7x-Work/game-design-portfolio/actions/workflows/pages.yml)

游戏 AI 策划方向的作品与工程记录。每个目录都可以独立阅读。

> ▶ **在线试玩**：<https://white7x-work.github.io/game-design-portfolio/>
> 《尾巴动物园》与《数织异化》可直接打开游玩，无需安装。
> 站点由 GitHub Actions 自动构建：`push` 到 `master` 后执行 `tsc` 并发布到 Pages。

## 目录

| 目录 | 内容 | 说明 |
|---|---|---|
| [`elemental-echo/`](elemental-echo/) | 《元素回响》Elemental Echo | 在研的卡牌构筑 Roguelike（TapTap 小游戏 / H5），以 Markdown 作为唯一事实源驱动开发 |
| [`tail-zoo/`](tail-zoo/) | 《尾巴动物园》Tail Zoo | 贪吃蛇 × 动物收服 × 肉鸽三选一，单文件 HTML + Canvas，零依赖离线可玩；已接 TapTap 排行榜与激励视频 |
| [`nonogram-mutations/`](nonogram-mutations/) | 《数织异化》Nonogram Mutations | 纯 TypeScript + Canvas 数织游戏，50 关 + 每日一题，规则异化（彩色 / 对角线 / 剪影）|
| [`zzz-teardown/`](zzz-teardown/) | 《绝区零》战斗与养成系统拆解 | 机制层拆解 + 设计意图归因，28KB 结构化文档 + 8 张自制图表 |
| [`resume/`](resume/) | 简历 | 游戏 AI 策划（Agent 协作底座方向）|

---

## 1. 《元素回响》Elemental Echo

单人卡牌构筑 Roguelike，竖屏 750×1334，单局 12–18 分钟，三个 Act。核心机制是「元素反应 / 共鸣」：连续出牌的元素搭配决定收益，单卡强度不是重点。

**文档驱动**——玩法、资产、美术提示词三份 Markdown 分别约束三类产出：

| 文件 | 作用 |
|---|---|
| `DESIGN.md` | 设计支柱、10 组元素反应表、战斗规则、单局状态机、12 种敌人、三 Act 难度曲线、服务端规划、里程碑与阻塞项 |
| `ASSETS.md` | 按 P0/P1/P2 拆分素材需求：22 张卡面、30 个遗物图标、12 种敌人立绘、4 张场景、UI 组件、音频 |
| `ART_PROMPTS.md` / `PROMPTS_QUICK.md` | 生图提示词与后处理规范、生成顺序与防返工要点 |

**工程**——无框架依赖的实现 + 自建构建链：

```bash
node tools/build.cjs      # code/ → dist/index.html（单文件产物）
node tools/serve.cjs      # 本地预览
```

`code/` 为 HTML + CSS + 7 个 JS 模块（data / engine / run / ui / fx / tap / main）。

---

## 2. 《尾巴动物园》Tail Zoo

贪吃蛇 × 动物收服 × 肉鸽三选一的卡通 H5 游戏，MVP 已完成（v1.3.0），已接入 TapTap 排行榜与激励视频广告。

- **单文件、零依赖**：逻辑、样式与 Canvas 美术全部打包在 `index.html`（约 124KB），不引 CDN、外链图片或字体，双击即离线可玩。
- **核心循环**：蛇头碰到动物即收服，动物挂在身后提供被动；重复收服同种动物可升到 5 级；吃浆果积累经验，升级时从 3 张强化卡里选 1 张（普通随时出现、稀有 Lv.3 解锁、史诗 Lv.6 解锁）。
- **风险与容错**：撞墙、自身或岩石会死亡；乌龟提供护盾、熊猫提供复活；无尽模式速度递增，障碍与动物持续刷新。
- **TapTap 接入**：18×18 棋盘 + 底部居中虚拟方向键；结算自动上传「最高分榜」，标题页 / 结算页可打开排行榜；结算页「看视频复活」走激励视频（`res.isEnded` 为真才发奖，提前关闭不发，每局 1 次）。`tap` 不存在时全部静默降级，离线与网页预览不受影响。
- **工程文档**：`PLAN.md`（30KB）写明产品定义、数值、里程碑与验收清单，并记录已知取舍与未做项；`CHANGELOG.md` 记录版本变化。

```bash
node tools/serve.mjs            # 可选：本地 HTTP 预览（http://127.0.0.1:8765/）
node tools/verify-taptap.mjs    # 可选：headless Edge 跑 36 项接入验收
```

`backups/` 保留 v1.0.0 与 v1.0.1 两个发布快照。

---

## 3. 《数织异化》Nonogram Mutations

纯 TypeScript + Canvas 的数织（Nonogram）游戏，卖点是**规则异化**：彩色多值、对角线线索、形状剪影，零运行时依赖。

- **内容**：主线 35 关（黑白 1–8 → 彩色 9–16 → 对角线 17–26 → 剪影 27–35）+ 挑战 15 关；每日一题按日期种子（`YYYYMMDD` → mulberry32）本地确定性生成，全设备同题。
- **唯一解是硬约束**：所有内嵌关卡经求解器计数校验（数到 2 即停），对角线关卡要求「行列单独不唯一、加上对角线后唯一」的承重布局。
- **工程**：`tsc` 编译、产物零运行时依赖；`tools/` 下含关卡批量生成（带唯一性校验与 ASCII 预览）、离线验收、单元测试、本地服务器四个脚本。
- **分层**：`core/`（prng、grid、clues、solver、generator）、`rules/`（黑白 / 彩色 / 对角线 / 剪影采样器）、`ui/`（渲染、工具条、色盘、手势状态机）、`state/`、`levels/`。

```bash
npm install
npm run build     # tsc：src/ → build/
npm run verify    # 50 关唯一解 / 结构约束 / 每日题确定性
npm test          # 核心算法单测
npm run serve     # http://localhost:8642/
```

---

## 4. 《绝区零》系统拆解

以 3.2 版本为基准，拆战斗（三资源闭环、失衡推条、连携技、极限支援、属性×特性两轴构筑）与养成（五条养成线、电量作为节奏阀）两条主线，并归因设计意图。

## 5. 简历

`resume/` 下为 Markdown 源稿、docx 定稿与整页预览图。
