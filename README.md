# 游戏设计作品集 · 许云翔

游戏 AI 策划方向的作品与工程记录。每个目录都可以独立阅读。

## 目录

| 目录 | 内容 | 说明 |
|---|---|---|
| [`elemental-echo/`](elemental-echo/) | 《元素回响》Elemental Echo | 在研的卡牌构筑 Roguelike（TapTap 小游戏 / H5），以 Markdown 作为唯一事实源驱动开发 |
| [`zzz-teardown/`](zzz-teardown/) | 《绝区零》战斗与养成系统拆解 | 机制层拆解 + 设计意图归因，28KB 结构化文档 + 8 张自制图表 |
| [`resume/`](resume/) | 简历 | 游戏 AI 策划（Agent 协作底座方向）|

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

## 2. 《绝区零》系统拆解

以 3.2 版本为基准，拆战斗（三资源闭环、失衡推条、连携技、极限支援、属性×特性两轴构筑）与养成（五条养成线、电量作为节奏阀）两条主线，并归因设计意图。

## 3. 简历

`resume/` 下为 Markdown 源稿与 docx 定稿。
