# 《元素回响》P0 素材 · 生图提示词

> 配套文档：[ASSETS.md](ASSETS.md)（完整素材清单）
> 本文只覆盖 **P0（上架必需 / 观感无法接受）** 项的提示词。
> 提示词均用**英文**书写（主流生图模型对英文语义更稳定），可直接复制。

---

## 0. 使用前必读

### 0.1 哪些适合生图，哪些不适合

| P0 素材 | 生图适合度 | 建议做法 |
|---|---|---|
| 应用图标 512×512 | ★★★★★ | 直接生图，多出变体挑选 |
| 商店横幅 1920×1080 | ★★★★★ | 直接生图 |
| 能量球 | ★★★★ | 可生图，数字区域后期叠加 |
| 金币 / 抽牌堆 / 弃牌堆图标 | ★★★★ | 可生图 |
| 按钮底 / 面板边框 / 血条 | ★★ | **不建议直接生图**（需要 9-slice 无缝拉伸，生图边缘必然不对称、有噪点），建议用 Figma/AI 矢量做；若一定要生图，只取"装饰纹理/辉光层"再手工切 |
| 游戏截图 ×4 | — | 不接受生图，从游戏内实机截取 |

### 0.2 通用参数

| 项 | 建议 |
|---|---|
| 比例 | 图标 **1:1**；横幅 **16:9**；UI 图标 **1:1** |
| 生成尺寸 | 图标 1024×1024 → 缩到 512；横幅 2048×1152 → 缩到 1920×1080（**只缩不放**） |
| 变体数 | 每项至少 4 张，挑 1 张 |
| 背景 | UI 类素材要求 **纯黑或纯平色背景**，方便抠图 |
| 文字 | **一律不要让模型生成文字**（会糊成乱码），标题与 slogan 后期排版 |

### 0.3 一次生成多张时的一致性

1. 先用下面的「风格锚点」生成 **1 张基准图**，确认调色后锁定。
2. 后续每个素材 = `风格锚点` + `素材专属段`，模型、seed 家族、采样器保持一致。
3. 支持参考图的模型（Midjourney `--sref`、SD 的 IP-Adapter、FLUX 的 reference）优先挂基准图。
4. 全部导出后统一套一层调色（见 §5 的色板 LUT），避免每张色温不一致。

---

## 1. 风格锚点（每张图都加这段）

**正向（Style Anchor）**

```
dark fantasy game art, elemental magic theme, deep charcoal background #0E1116,
five elemental accent colors — fire orange #FF5A36, water blue #2E9BFF,
wind teal #3FD3A0, thunder gold #FFC53D, earth bronze #B07A4A,
glassmorphism translucent materials, volumetric glow, crisp rim light,
high contrast, clean readable silhouette, cinematic lighting,
centered composition with negative space, 4k, sharp details
```

**负向（Negative，通用）**

```
text, letters, words, typography, watermark, signature, logo, ui mockup,
cluttered background, busy pattern, low contrast, washed out, desaturated,
blurry, out of focus, jpeg artifacts, noise, banding,
photorealistic photo, stock photo, real human face, anime screencap,
frame border, vignette, drop shadow on page, low resolution, upscaled
```

> 中文模型若更吃中文提示词，可直接用本文件的中文对照段意（我在每项下方附了中文要点），但英文效果通常更稳。

---

## 2. 应用图标（P0，1:1，512×512）

### 方案 A：五元素环绕卡牌（推荐主方案）

**正向**
```
app icon, square 1:1 composition, a single ornate playing card standing upright in the center,
its surface fracturing into five luminous elemental ribbons — fire, water, wind, thunder, earth —
that spiral around it, translucent glass material with inner light, sparkles and glowing motes,
dark charcoal radial gradient background, bold centered silhouette,
extremely high clarity, readable when scaled down to 32 pixels,
flat icon style with soft volumetric glow, no text
```
**负向**：通用负向 + `thin hairline details, too many small particles, complex engraving, gradient mesh artifacts`

**中文要点**：竖立的一张华丽卡牌居中，卡面裂出五条元素光带（对应五色）缠绕；玻璃质感内发光；深炭灰径向渐变底；**剪影必须够粗**，缩到 32px 仍能看出是卡牌。

### 方案 B：元素球融合

```
app icon, square 1:1, five glowing elemental orbs of different colors merging into one
at the center, energy threads connecting them, glass spheres with plasma cores,
dark background, symmetrical composition, strong silhouette, icon-ready flat clarity, no text
```

### 方案 C：卡牌 + 五色环

```
app icon, square 1:1, a dark playing card seen from the front with a glowing five-color
circular rune engraved on it, thin luminous ring around the card, minimal, bold shapes,
dark charcoal background, icon-ready, no text
```

> **挑选标准**：缩到 64×64 还能认出是"卡牌 + 多彩元素"就通过；细节太多的直接淘汰。

---

## 3. 商店横幅（P0，16:9，1920×1080）

**正向**
```
wide cinematic game store banner, 16:9, epic scale,
a lone silhouette of a card summoner standing in the lower-left third, facing away from viewer,
right two-thirds filled with a vortex of intertwined elemental energy — fire, water, wind,
thunder, earth streams weaving into luminous ribbons and shards,
ancient forest ruins with glowing volcanic cracks on the ground,
towering storm clouds with lightning in the far distance,
dark moody palette with highly saturated elemental highlights, volumetric god rays,
cinematic depth of field, atmospheric haze, dust motes,
composition intentionally leaves the upper-left area empty and clean for logo placement,
no text
```
**负向**：通用负向 + `visible face detail, bright daylight, cheerful, cartoon, low detail background`

**中文要点**：左侧下三分之一放一个背向镜头的召唤者剪影，右侧三分之二被五元素能量漩涡占据；背景是森林遗迹 + 地面熔岩裂缝 + 远处雷暴云；**左上角必须留出干净区域**给 logo 和标题。人物不要露脸（避免廉价感，也避免 AI 脸崩）。

**二次加工**：拿到图后在自己这边把左上角压暗 15%，再叠标题，能显著提升高级感。

### 3.1 生成的图与修订记录

第一版生成结果评估（1536×864 → 放大到 1920×1080）：

| 项 | 评价 |
|---|---|
| 比例 / 尺寸 | 16:9 正确，但原生只有 1536×864，**低于 TapTap 1920×1080 下限**，必须重生成或放大 |
| 五元素配色 | ✅ 火橙 / 水蓝 / 风青 / 雷金 / 土褐都在 |
| 召唤者剪影（不露脸） | ✅ 符合 |
| 左侧留白给 logo | ✅ 压暗后可用 |
| 无文字水印 | ✅ |
| **卡牌叙事** | ❌ **最大问题**：整体读作"魔法动作游戏"，只有几个飘着的蓝色方块，不像卡牌游戏 |
| 元素分离度 | ❌ 五色混成一团连续风暴，没体现"五种元素各自独立、组合触发反应" |
| 右侧信息密度 | ⚠ 过密，缩成商店小图会糊成一团 |
| 风格一致性 | ⚠ 写实厚涂 vs 游戏内的扁平霓虹玻璃，点击后有落差 |
| 局部瑕疵 | ⚠ 右上边缘有个像小屋/方块的物体，大图看像 AI 崩坏 |

### 3.2 v2 修订提示词（强化卡牌与元素分离度）

针对上述问题，改用"卡牌作主角"的构图：

```
wide cinematic game store banner, 16:9, epic scale,
centerpiece: an oversized luminous hand of five playing cards fanned out in the middle,
each card glowing with a different element — orange fire, blue water, teal wind,
gold thunder, bronze earth — thin beams of light arcing from each card and converging
into a bright burst at the center of the fan,
cards are clearly readable as CARDS: crisp rectangular edges, thin ornate borders,
translucent glass surfaces with visible elemental runes inside,
a lone summoner silhouette standing small at the lower-left, holding one card aloft,
vast dark valley environment behind with distant jagged mountains and low mist,
only a few floating rock shards (avoid clutter), dark moody palette #0E1116,
volumetric light, high contrast rim lighting, sharp focus on the card fan,
upper-left third kept dark and empty for logo placement,
no text
```

**负向（v2 追加）**

```
generic magic storm, chaotic vortex, unreadable shapes, cube, box, building,
random debris, floating house, action game poster, character closeup, face detail,
low contrast muddy center, oversaturated
```

**关键差异**：主角从"风暴"换成"扇形展开的五张发光卡牌"，所有光从卡牌射出并汇聚 —— 这样一眼就能看出是卡牌游戏，同时保留"元素汇聚"的玩法含义。


---

## 4. UI 基础件（P0）

> 再次提醒：按钮 / 面板 / 血条这类需要 9-slice 无缝拉伸的件，**生图只适合产出纹理与辉光层**。下表给出提示词，但建议最终仍由设计工具定稿。

### 4.1 面板边框（弹窗、商店、图鉴通用）

```
game ui panel frame, rounded rectangle, dark glass panel #161B22 with a thin luminous
elemental rim light, subtle inner glow at the edges only, large empty flat center area,
smooth consistent border thickness with no asymmetry, isolated on pure black background, no text
```
**中文要点**：中间必须**大面积平坦**（要放内容），只有边缘有光；四边尽量对称，便于切 9-slice。

### 4.2 按钮（普通 / 主要 / 禁用 三态）

**普通**
```
game ui button, rounded rectangle, dark translucent glass with faint teal rim light,
subtle inner highlight on the top edge, flat clean surface, isolated on pure black, no text
```
**主要（渐变高亮）**
```
game ui button, rounded rectangle, warm gradient from fire orange #FF5A36 to gold #FFC53D,
glossy with soft inner glow, thin bright rim, flat clean surface, isolated on pure black, no text
```
**禁用**
```
game ui button, rounded rectangle, desaturated grey dark glass, no glow, flat muted surface,
isolated on pure black, no text
```

### 4.3 血条（三段）

```
horizontal health bar, rounded trough, dark inner channel, crimson gradient fill
#FF4D4F to #FF8A5A with glossy highlight, thin metallic rim light,
three variants: full bar, mid bar, empty trough, isolated on pure black, no text
```
**中文要点**：要的是"底槽 + 填充条 + 边框"三件套，输出时让模型画成三个独立横向条块，方便拆。

### 4.4 能量球

```
circular energy orb ui element, glass sphere containing swirling blue-cyan plasma #2E9BFF,
bright luminous core with orbiting sparks, thin bright rim light,
center of the sphere kept visually flat and readable for a number overlay,
isolated on pure black background, no text
```
**中文要点**：球心要"平"，因为要叠 `3/3` 数字；不要让等离子纹路挤在正中间。

### 4.5 金币

```
game currency icon, a single gold coin, three-quarter view, an elemental rune embossed
on its face, glossy metal with warm rim light and small specular highlights,
isolated on pure black background, no text, no digits
```

### 4.6 抽牌堆 / 弃牌堆图标

**抽牌堆**
```
game ui icon, a neat stack of card backs seen from a slight angle, dark glass surface
with teal rim glow, bold simple silhouette readable at 64 pixels, isolated on pure black, no text
```
**弃牌堆**
```
game ui icon, scattered discarded playing cards overlapping messily, dark with faint
orange rim glow, bold simple silhouette readable at 64 pixels, isolated on pure black, no text
```
**中文要点**：两个图标必须在**同一套视觉语言**下成对出现（同样的线条粗细、同样的辉光强度），否则放在一起会像两套 UI。

### 4.7 返回 / 关闭

```
minimal game ui icon, a bold chevron arrow pointing left, single color pale grey with
soft outer glow, thick stroke, flat, isolated on pure black, no text
```
```
minimal game ui icon, a bold X close symbol, thick strokes with soft glow,
flat, isolated on pure black, no text
```

---

## 5. 后处理流程（统一观感的关键）

顺序很重要，别跳步：

1. **抠图**：UI 类素材去黑底（Photoshop「选择主体」或 remove.bg），导出 PNG-24 带 alpha
2. **裁切与缩放**：先缩到目标尺寸（图标 512、横幅 1920×1080），再轻微锐化（Unsharp Mask 半径 0.5、强度 60%）
3. **统一调色**：整体降饱和 5%、提对比 8%，把暗部压到 `#0E1116` 附近，保证所有素材贴到深色 UI 上不"发灰"
4. **元素色校准**：用取色器确认五色不偏离

| 元素 | 目标色 | 允许偏差 |
|---|---|---|
| 火 | `#FF5A36` | ±12 |
| 水 | `#2E9BFF` | ±12 |
| 风 | `#3FD3A0` | ±12 |
| 雷 | `#FFC53D` | ±12 |
| 土 | `#B07A4A` | ±12 |

5. **9-slice 切分**（按钮/面板）：四角固定 16px，四边拉伸区各保留 8px 以上平坦色
6. **导出**：图标 PNG-24（≤200KB）；横幅 JPG 质量 85（≤4MB，TapTap 硬限制）

---

## 6. 截图与文案（非生图部分）

### 6.1 4 张商店截图

从游戏内实机截取即可，我建议这 4 个画面：

| # | 画面 | 采集时机 |
|---|---|---|
| 1 | 战斗全景（敌人 + 手牌 + 能量） | 任一普通战斗 |
| 2 | 元素反应爆发瞬间 | 「焚风」或「元素爆发」闪光那 0.3 秒（可以加慢动作录制截帧） |
| 3 | 地图路线 | 第 2 层，有多个节点可选时 |
| 4 | 结算页 | 通关或高分时 |

**规格**：竖屏 720×1280 起，比例 3:8~5:8，与首图比例一致。需要时可用模拟器放大到 1080×1920。

### 6.2 Slogan 备选（≤12 字）

| 候选 | 说明 |
|---|---|
| **元素相生，卡牌共鸣** | 最贴玩法，推荐 |
| 五种元素，无限连携 | 强调组合自由度 |
| 让元素回响 | 呼应游戏名，短 |

---

## 7. 交付清单自查

生图完成后对照这张表确认齐了：

- [ ] 应用图标 512×512 PNG（1 张，已缩到 32px 目视检查过）
- [ ] 商店横幅 1920×1080 JPG（≤4MB，左上角有干净留白）
- [ ] 能量球 160×160 PNG（球心够平，能叠数字）
- [ ] 金币 64×64 PNG
- [ ] 抽牌堆图标 96×96 PNG
- [ ] 弃牌堆图标 96×96 PNG
- [ ] 返回箭头 64×64 PNG
- [ ] 关闭图标 64×64 PNG
- [ ] 按钮 3 态（普通/主要/禁用）
- [ ] 面板边框（9-slice 可拉伸）
- [ ] 血条 3 件（槽/填充/边框）
- [ ] 游戏截图 4 张（竖屏）
- [ ] Slogan 定稿

齐了之后我可以直接替换进游戏（替换点见 ASSETS.md §9），不需要改任何游戏逻辑。
