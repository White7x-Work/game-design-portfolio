# 尾巴动物园 / Tail Zoo

贪吃蛇 × 动物收服 × 肉鸽三选一的卡通 H5 游戏 MVP。

- **单文件运行时**：`index.html`
- **零依赖**：无 CDN、无外部图片/字体、无网络请求
- **离线可玩**：直接双击 `index.html`，或拖进浏览器
- **推荐浏览器**：新版 Chrome / Edge / Safari

## 操作

| 操作 | 键盘 | 触屏 |
| --- | --- | --- |
| 转向 | WASD / 方向键 | 在棋盘上滑动，或点虚拟方向键 |
| 暂停 / 继续 | `Space` / `P` / `Esc` | 右上角暂停按钮 |
| 重开 | `R`（暂停或结算时） | 结算页“再来一局” |
| 选卡 | `1` / `2` / `3` | 点卡牌 |

标题页可以关闭音效、屏震和虚拟方向键；设置与最佳分保存在本地。

虚拟方向键在触屏设备上显示于**屏幕底部居中**，单个按钮 ≥ 56px（`--dpad-cell: clamp(52px, 15.5vw, 68px)`）；横屏或高度不足 560px 时自动收起，改用滑动。

## 玩法

- 蛇头碰到动物即收服：身体 +1、获得经验与分数，动物会挂在身后；第一只头像紧贴蛇头。
- 每种动物自带被动，重复收服同种动物可升到 5 级。
- 吃浆果获得经验；金浆果经验更高。
- 升级时从 3 张强化卡中选 1 张。普通卡随时出现，稀有卡 Lv.3 解锁，史诗卡 Lv.6 解锁。
- 撞到墙、自身或岩石会死亡；自身碰撞包含尾巴，蛇头不会穿过画面里的蛇身。乌龟提供护盾，熊猫提供复活。
- 无尽模式：速度会缓慢提升，岩石和动物持续刷新。

## 本地开发

`index.html` 不需要服务器。若想通过 HTTP 预览：

```powershell
cd tail-zoo
node tools/serve.mjs
# 打开 http://127.0.0.1:8765/
```

`tools/serve.mjs` 只用于本地预览，不是游戏运行依赖。

## 调试

- `index.html?debug=1`：显示调试面板，开启快捷键。
- `index.html?touch=1`：在桌面强制启用触屏布局。
- `window.__tailzoo`：暴露 `start`、`snapshot`、`forceLevelUp`、`spawnAnimal`、`grantBuff`、`die` 等测试钩子。

## TapTap 小游戏 / H5 接入

| 项 | 值 |
| --- | --- |
| 开发者 | White白工作室（Developer ID `502694`） |
| App ID | `1006350` |
| 屏幕方向 | 竖屏 |
| 在线排行榜 | 最高分榜 · `xbzw2e4303k6c7uwqo`（always / desc / best，已发布） |
| 广告 | 激励视频「看视频复活」，广告位 `1054324`（竖屏，已接入） |

- 接入代码集中在 `index.html` 顶部 `00. TAPTAP PLATFORM` 段。`tap` 由 TapTap 宿主注入，**不要 npm 安装任何 SDK**。
- 结算时自动 `submitScores` 提交本局分数；标题页 / 结算页的「排行榜」按钮调用 `openLeaderboard`。
- 普通浏览器（无 `tap`）里所有接口静默降级，不会报错，离线玩法不受影响。
- 广告位 ID 只能来自 TapTap MCP `check_ads_status` 的返回，**禁止从后台手填或复用其他应用**。
- 激励视频：启动时 `createRewardedVideoAd` 预加载；`show()` 失败时 `load()` 后只重试一次；**超时只覆盖「拉起广告」阶段（15s），播放中由 `onClose` 决定**；`onClose` 给 `{isEnded:true}` / `true` / 无参数都算看完，明确 `isEnded:false` 才不发复活。
- 本地模拟一次激励视频：`index.html?admock=1`（只在浏览器里模拟，真机走真实广告位）。
- 上传方式：**H5 上传**（入口 `index.html`）。本作是 DOM + Canvas 页面，不能按 TapTap 小游戏打包——小游戏要求 `game.js` / `game.json` / `project.config.json` 且运行环境没有 `window`、`DOM`、`BOM`。
- 压缩包结构：平台要求 **zip 根目录下套一个游戏目录**，其内才是 `index.html`：
  ```
  tail-zoo-v1.4.0.zip
  └── tail-zoo/
      └── index.html
  ```
  直接把 `index.html` 放在 zip 根目录会报「压缩包根目录必须包含一个游戏目录」。
- 屏幕方向：在开发者后台的版本信息里设为竖屏；`game.json` 只对小游戏生效，H5 包不带。

## 文件

- `index.html`：游戏本体（HTML + CSS + JS + Canvas 美术 + TapTap 平台接入层）。
- `PLAN.md`：产品规则、数值、里程碑与验收清单。
- `tools/serve.mjs`：可选本地静态服务器。
- `tools/verify-taptap.mjs`：TapTap 接入层自动化验收（Edge headless + CDP）。
- `tools/shots.mjs`：窄屏布局截图与溢出检查。
- `tools/measure-dpad.mjs`：虚拟方向键在各机型下的尺寸 / 居中 / 溢出测量。
- `screenshots/`：390×844 与 360×640 的标题页 / 结算页截图。
- `dist/tail-zoo-v1.4.0/`：当前待上传产物（TapTap H5 上传目录）；`v1.3.0` / `v1.2.0` / `v1.1.0` 为历史版本。
- `backups/tail-zoo-v1.0.1.html`：上一版发布快照。
- `backups/tail-zoo-v1.0.0.html`：首版历史快照。

详细规则与数值见 `PLAN.md`。