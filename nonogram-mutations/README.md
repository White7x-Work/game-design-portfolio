# 数织异化 · Nonogram Mutations（展示版）

休闲 H5 数织（绘图方块）游戏，核心卖点是**规则异化**：彩色多值、对角线线索、形状剪影。
纯 TypeScript + Canvas，**零运行时依赖**，静态托管即玩。

> 唯一事实源：`D:\DSH\ZZZcj\数织异化-设计规格.md`（本项目按该规格实现，未引入规格外规则）。

## 快速开始

```bash
npm install        # 仅安装 devDependency: typescript
npm run build      # tsc 编译 src/ → build/
npm run serve      # 零依赖静态服务器 → http://localhost:8642/
```

浏览器打开 `http://localhost:8642/` 即玩（ES 模块需要 http:// 环境，直接双击 index.html 会被浏览器 CORS 拦截）。

部署：任意静态托管，把整个目录（含 `build/`）上传即可。

## npm scripts

| 命令 | 说明 |
|---|---|
| `npm run build` | tsc 编译（产物零运行时依赖） |
| `npm run watch` | 编译监听 |
| `npm run serve` | 本地静态服务器（默认 8642 端口） |
| `npm run gen-levels` | dev：程序化重新生成全部 50 关内嵌解 + 唯一解校验（写入 `src/levels/solutions.ts`，加 `--preview` 输出 ASCII 预览，`--only m01,c03` 只生成指定关） |
| `npm run verify` | dev：离线验收（50 关唯一解 / 结构约束 / 每日题确定性 / 再生成抽查） |
| `npm test` | dev：核心算法单元测试（prng / 线索推导 / 求解器 / 生成器） |

## 玩法与规格对照

- **50 关**：主线教学 35（S1 黑白 1–8 → S2 彩色 9–16 → S3 对角线 17–26 → S4 剪影 27–35）+ 挑战 15（彩色剪影 / 高难对角线 / 彩色×对角线 / 全叠加）。
- **每日一题**：按日期种子（`YYYYMMDD` → mulberry32）本地确定性生成，全设备同题，结果缓存 localStorage。
- **唯一解（硬约束）**：所有内嵌关卡经求解器计数校验（数到 2 即停）；对角线关卡全部达成"承重"布局（行列单独不唯一、加对角线后唯一）。
- **交互**：点按填色 / 拖动连涂 / 长按（触屏）或右键（鼠标）打 X / 工具条（填色·标记·擦除）/ 彩色关卡色盘。
- **评分**：3 星 = 通关 + 零失误 + 限时内；失误即时红标（`#FF1744`）、不扣命不阻断；挑战关显示"完美解"目标。
- **对角线显示规则**：只画"至少穿过 1 个非空格"的斜线；**未显示 = 全空**（教学页专门讲解）。斜向线索画在网格四边外侧的斜向延伸带上：↘ 主对角 = 蓝带（`#E3F2FD`，锚定 SE 端），↙ 副对角 = 橙带（`#FFF3E0`，锚定 NE 端）；窄屏自动收起，点选格子临时高亮所在斜线，工具条可开关。
- **进度**：`localStorage['nomo.progress']`；主线线性解锁，通关第 35 关解锁挑战区。
- **换一题**：暂停菜单内可对任意关卡按同规则同尺寸现场重新生成（练习模式，不计进度）。

## 目录结构

```
index.html / styles.css        # 壳（canvas 全屏）
src/
  main.ts                      # 入口：场景路由、游戏循环、输入分发
  config.ts                    # 美术常量(§6)、网格上限(D11)、parTime(§7.6)、星级(§4)
  core/
    prng.ts                    # mulberry32 + 字符串散列 + 日期种子
    grid.ts                    # 网格数据与编解码
    clues.ts                   # 线索推导（行/列/↘/↙）、对角线索引、线抽象
    solver.ts                  # 线约束枚举 + 一致性传播 + 回溯计数（唯一性校验）
    generator.ts               # 统一生成流程（确定性迭代预算）+ 异步分块版
  rules/
    mono.ts / colored.ts / diagonal.ts / silhouette.ts   # 各规则采样器 + 剪影模板库
  ui/
    renderer.ts                # 棋盘/线索/斜向延伸带/红标/X/高亮
    toolbar.ts / palette.ts    # 工具条 + 色盘
    screens.ts                 # 菜单/选关/帮助/HUD/浮层（教学·暂停·胜利·生成中）
    input.ts                   # 手势状态机：点按/拖动/长按/右键/悬停
    theme.ts                   # 绘制基元
  state/
    types.ts / progress.ts / session.ts
  levels/
    mainline.ts / challenge.ts / daily.ts / levels.ts
    solutions.ts               # AUTO-GENERATED：50 关内嵌唯一解
tools/                         # dev 工具（gen-levels / verify / test / serve）
```

## 实现要点

- **确定性优先**：生成预算用"迭代次数"而非墙钟时间，保证每日一题跨设备一致。
- **求解器**：逐线枚举全部合法放置（彩色规则：同色段间隔 ≥1、异色可紧邻）→ 位掩码传播 → 最少候选分支；唯一性 = 计数到 2 提前截断。
- **性能**：20×20 黑白对角线唯一解校验单次约 200ms 内；50 关全量生成 + 复核 < 1s（桌面 Node）。
- **QA 钩子**：`window.__nomo`（render / startLevelById / gameInfo / fillSolutionFast 等），仅用于自动化验收，不影响玩法。

## 已知限制

- 20×20 挑战关（C10）在手机竖屏上格子约 14px，偏小（斜线带已自动收起缓解）；桌面/平板体验最佳。
- 对局中途退出不保存残局（规格未要求断点续玩）。
