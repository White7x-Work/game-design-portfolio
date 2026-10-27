# 精简提示词速查表

> 完整版见 [ART_PROMPTS.md](ART_PROMPTS.md)。本页只保留可复制的最小集合。

## 通用尾缀（每张都加）

```
dark fantasy game art, glass texture, volumetric glow, high contrast,
black background, centered, clean silhouette, no text, no watermark
```

负向（通用）：

```
text, letters, watermark, logo, blurry, low contrast, cluttered, photorealistic photo,
cartoon, chibi, extra limbs, deformed hands, frame border
```

生成参数：**一律 2 倍尺寸出图再缩小**；每个素材出 4 张挑 1 张。

---

## A. 3 张 Boss 立绘（1:1，出 1024 后缩到 640）

**A1 风蚀巨像（Act I）**
```
colossal stone golem, body of wind-eroded rock strata, teal wind spirals around shoulders,
cracked earth underfoot, front view, full body, imposing
```
**A2 潮汐母体（Act II）**
```
giant abyssal witch-mother, coral and shell armor, bioluminescent blue veils,
tentacles of liquid water, floating, full body, front view
```
**A3 雷帝·阿库拉（Act III）**
```
storm emperor in gold lightning armor, crown of arcing bolts, cape of thunderclouds,
towering silhouette, front view, full body
```

> 都要完整全身、正面、居中留边，方便抠图。**不要侧面、不要半身。**

---

## B. 5 个元素图标（1:1，出 256 后缩到 128）

**模板**（只改 `{}` 里的内容）：
```
{element} element icon, single bold {shape} glyph, {core} core with {glow} glow,
flat vector-like icon, thick strokes, readable at 32px, centered, black background
```

| 元素 | element | shape | core | glow |
|---|---|---|---|---|
| 火 | fire | flame | `#FF5A36` | `#FFB347` |
| 水 | water | water droplet | `#2E9BFF` | `#7FD4FF` |
| 风 | wind | swirl | `#3FD3A0` | `#B6FFE0` |
| 雷 | thunder | lightning bolt | `#FFC53D` | `#FFF08A` |
| 土 | earth | rock shard | `#B07A4A` | `#E0B98A` |

> **5 个必须同一批生成、同一 seed**，否则放一起会像两套 UI。线条粗细、留白比例要一致。

---

## C. 卡牌框（192×296，设计 96×148 的 @2x）

**模板**（把 `{color}` 换成元素主色）：
```
ornate card frame, portrait 2:3, {color} thin luminous rim, dark glass panel,
uniform edge thickness on all four sides, large flat empty center,
rounded corners, 9-slice friendly, black background, no illustration, no text
```

`{color}` 依次：`#FF5A36` / `#2E9BFF` / `#3FD3A0` / `#FFC53D` / `#B07A4A`

再加一张中性色备用：把 `{color}` 换成 `neutral pale grey`，用于通用弹窗。

> 关键三句：`uniform edge thickness`、`flat empty center`、`9-slice friendly`。

---

## D. 6 张代表性卡面（4:3，出 512×384 后缩到 256×192）

**D1 火花（火）**
```
single small ember orb with trailing sparks, warm orange light, minimal composition
```
**D2 冰锥（水）**
```
jagged ice lance shard, pale blue frost mist, sharp crystalline edges
```
**D3 旋风（风）**
```
small compact tornado of leaf and air ribbons, teal swirl
```
**D4 雷神之怒（雷）**
```
massive lightning bolt striking down, gold arcs, electric sparks radiating
```
**D5 大地之怒（土）**
```
shattering rock plateau erupting upward, bronze stone shards, dust
```
**D6 元素汇聚（双元素）**
```
five colored energy streams converging into one glowing core, five elements fusing
```

> 都要求：**单一物件、居中、四周留暗色边**（卡面上还要叠费用/名称文字）。不要画人物、不要复杂场景，缩到 96px 会糊。

---

## E. 标题主视觉（3:4 竖屏，出 1536×2048）

```
vertical game key visual, a lone summoner silhouette standing at the bottom third,
above them five glowing elemental cards floating in a dark sky, light beams rising,
ancient ruins below, dark charcoal palette #0E1116, volumetric glow,
upper half kept dark and empty for the game logo, no text
```

> `upper half kept dark and empty` 是给标题留位。手机竖屏商店首页是第一眼，这张最重要。

---

## 生成顺序（别一次全做）

1. **E 标题主视觉** —— 定全游戏调色（这张定了，后面都跟着它）
2. **B 5 个元素图标** —— 同批出，尺寸小、成本低，最快见效
3. **A 3 张 Boss** —— 需要反复挑，耗时最长，早点开始
4. **C 卡牌框** —— 需要拉伸测试，出完发我验 9-slice
5. **D 6 张卡面** —— 量最大，最后批量做

## 三个避免返工的要点

1. **先出 E，锁 seed 与模型**，后面全部沿用同参数，否则色调会飘
2. 全出完统一做一次：抠图 → 缩到目标尺寸 → 降饱和 5% + 提对比 8% → 暗部压到 `#0E1116`
3. 图标/立绘**必须抠成透明**再交给我；卡框留着黑底我来切
