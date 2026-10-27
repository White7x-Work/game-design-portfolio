// 元素回响 — 数据层：元素、反应、卡牌、遗物、敌人

export const ELEMENTS = {
  fire:    { id: 'fire',    name: '火', color: '#FF5A36', glow: '#FFB347' },
  water:   { id: 'water',   name: '水', color: '#2E9BFF', glow: '#7FD4FF' },
  wind:    { id: 'wind',    name: '风', color: '#3FD3A0', glow: '#B6FFE0' },
  thunder: { id: 'thunder', name: '雷', color: '#FFC53D', glow: '#FFF08A' },
  earth:   { id: 'earth',   name: '土', color: '#B07A4A', glow: '#E0B98A' },
};

// 反应：无序配对，overload 顺序敏感
// apply(b, targetIdx) 中 b 是 battle 对象，提供 dmg/hitAll/status/armor 等
export const REACTIONS = [
  {
    pair: ['fire', 'wind'], name: '焚风', text: '全体 5 伤 + 灼烧 2 层',
    apply(b, t) { b.hitAll(5); b.addStatusAll('burn', 2, 2); },
  },
  {
    pair: ['fire', 'earth'], name: '熔岩', text: '战场熔岩 3 回合，敌方回合开始受 4 伤',
    apply(b) { b.lavaTurns = Math.max(b.lavaTurns, 3); },
  },
  {
    pair: ['fire', 'water'], name: '蒸汽', text: '敌方护甲减半，致盲 1 回合',
    apply(b, t) {
      const e = b.enemies[t] || b.enemies[0];
      if (e) { e.armor = Math.floor(e.armor / 2); b.addStatus(e, 'blind', 1); }
    },
  },
  {
    pair: ['fire', 'thunder'], name: '过载', text: '单体 18 伤，自身受 4 反噬',
    orderSensitive: true,
    apply(b, t, order) {
      if (order === 'thunder->fire') {
        b.player.buffNext = true;
        b.log('静电场：下一次攻击 +50%');
      } else {
        b.dmg(t, 18);
        b.selfDamage(4);
      }
    },
  },
  {
    pair: ['water', 'wind'], name: '霜寒', text: '冻结 1 回合，全体 3 伤',
    apply(b, t) {
      const e = b.enemies[t] || b.enemies[0];
      if (e) b.addStatus(e, 'freeze', 1);
      b.hitAll(3);
    },
  },
  {
    pair: ['water', 'earth'], name: '泥沼', text: '目标虚弱 2 回合（伤害 -30%）',
    apply(b, t) {
      const e = b.enemies[t] || b.enemies[0];
      if (e) b.addStatus(e, 'weak', 2);
    },
  },
  {
    pair: ['water', 'thunder'], name: '感电', text: '传导：全体敌人受 6 伤',
    apply(b) { b.hitAll(6); },
  },
  {
    pair: ['wind', 'earth'], name: '沙暴', text: '敌方命中 -40%，每回合 3 伤，持续 3 回合',
    apply(b) { b.addStatusAll('sand', 3, 3); },
  },
  {
    pair: ['wind', 'thunder'], name: '暴风', text: '3 段各 4 伤',
    apply(b, t) { b.dmg(t, 4); b.dmg(t, 4); b.dmg(t, 4); },
  },
  {
    pair: ['earth', 'thunder'], name: '磁暴', text: '移除目标护甲，眩晕 1 回合',
    apply(b, t) {
      const e = b.enemies[t] || b.enemies[0];
      if (e) { e.armor = 0; b.addStatus(e, 'stun', 1); }
    },
  },
];

// 共鸣（2 连）
export const RESONANCE = {
  fire:    { name: '火焰共鸣', text: '灼烧层数 +2', apply(b, t) { b.addStatusAll('burn', 2, 2); } },
  water:   { name: '流水共鸣', text: '抽 1 张牌', apply(b) { b.drawCards(1); } },
  wind:    { name: '疾风共鸣', text: '该卡效果额外结算 1 次', apply(b, t) { b.repeatLastCard(t); } },
  thunder: { name: '雷光共鸣', text: '该卡伤害 +50%', apply(b, t) { b.dmg(t, 3); } },
  earth:   { name: '坚岩共鸣', text: '获得 6 护甲', apply(b) { b.gainArmor(6); } },
};

// 元素爆发（3 连，每场每种元素一次）
export const BURST = {
  fire:    { name: '火·爆发', text: '全体 15 伤 + 灼烧 3 层', apply(b) { b.hitAll(15); b.addStatusAll('burn', 3, 2); } },
  water:   { name: '水·爆发', text: '治疗 8 并清除自身负面', apply(b) { b.heal(8); b.clearSelfStatus(); } },
  wind:    { name: '风·爆发', text: '全体 3 段 6 伤', apply(b) { b.hitAll(6); b.hitAll(6); b.hitAll(6); } },
  thunder: { name: '雷·爆发', text: '单体 24 伤', apply(b, t) { b.dmg(t, 24); } },
  earth:   { name: '土·爆发', text: '获得 18 护甲', apply(b) { b.gainArmor(18); } },
};

// 卡池
// target: 'single' | 'all' | 'none'
export const CARDS = {
  spark:    { id: 'spark',    name: '火花',   el: 'fire',    cost: 1, type: 'attack', rarity: 'common', dmg: 6,  target: 'single', text: '造成 6 伤害' },
  gale:     { id: 'gale',     name: '疾风斩', el: 'wind',    cost: 1, type: 'attack', rarity: 'common', dmg: 5,  draw: 1, target: 'single', text: '造成 5 伤害，抽 1 张' },
  staticZap:{ id: 'staticZap',name: '静电',   el: 'thunder', cost: 1, type: 'attack', rarity: 'common', dmg: 7,  target: 'single', text: '造成 7 伤害' },
  veil:     { id: 'veil',     name: '水幕',   el: 'water',   cost: 1, type: 'skill',  rarity: 'common', block: 5, draw: 1, target: 'none', text: '获得 5 护甲，抽 1 张' },
  rockwall: { id: 'rockwall', name: '岩壁',   el: 'earth',   cost: 2, type: 'skill',  rarity: 'common', block: 10, target: 'none', text: '获得 10 护甲' },
  converge: { id: 'converge', name: '元素汇聚', el: null,    cost: 0, type: 'skill',  rarity: 'rare',   buffNext: true, target: 'none', text: '本回合下一张牌视为双元素（不消耗反应次数）' },

  emberStorm:{ id:'emberStorm', name:'余烬风暴', el:'fire',  cost:2, type:'attack', rarity:'rare',  dmg:11, target:'all',  text:'对全体造成 11 伤害' },
  tidalSurge:{ id:'tidalSurge', name:'潮涌',     el:'water', cost:2, type:'skill',  rarity:'rare',  block:8, heal:4, target:'none', text:'获得 8 护甲，回复 4 HP' },
  thunderclap:{id:'thunderclap',name:'雷鸣',     el:'thunder',cost:2,type:'attack', rarity:'rare',  dmg:14, target:'single',text:'造成 14 伤害' },
  sandVeil:  { id:'sandVeil',   name:'沙隐',     el:'earth', cost:1, type:'skill',  rarity:'rare',  block:6, target:'none', text:'获得 6 护甲，本回合受到的伤害 -3' },
  updraft:   { id:'updraft',    name:'上升气流', el:'wind',  cost:0, type:'skill',  rarity:'rare',  draw:2, target:'none', text:'抽 2 张牌' },
  magmaFist: { id:'magmaFist',  name:'熔岩拳',   el:'fire',  cost:2, type:'attack', rarity:'rare',  dmg:9, target:'single', text:'造成 9 伤害并附加 2 层灼烧', burn:2 },
  iceLance:  { id:'iceLance',   name:'冰锥',     el:'water', cost:1, type:'attack', rarity:'rare',  dmg:6, target:'single', text:'造成 6 伤害，1 回合内目标伤害 -20%', weak:1 },
  voltChain: { id:'voltChain',  name:'连锁闪电', el:'thunder',cost:3,type:'attack', rarity:'epic',  dmg:8, target:'all',  text:'对全体造成 8 伤害，抽 1 张', draw:1 },
  stoneArmor:{ id:'stoneArmor', name:'岩甲',     el:'earth', cost:2, type:'skill',  rarity:'rare',  block:14, target:'none', text:'获得 14 护甲' },
  cyclone:   { id:'cyclone',    name:'旋风',     el:'wind',  cost:3, type:'attack', rarity:'epic',  dmg:6, hits:3, target:'single', text:'对单体造成 3 段 6 伤害' },
  inferno:   { id:'inferno',    name:'炼狱',     el:'fire',  cost:3, type:'attack', rarity:'epic',  dmg:20, target:'single', text:'造成 20 伤害，自身受 3 反噬', selfDmg:3 },
  abyssCall: { id:'abyssCall',  name:'深渊呼唤', el:'water', cost:3, type:'skill',  rarity:'epic',  heal:12, block:6, target:'none', text:'回复 12 HP，获得 6 护甲' },
  thunderGod:{ id:'thunderGod', name:'雷神之怒', el:'thunder',cost:3,type:'attack', rarity:'legend',dmg:30, target:'single', text:'造成 30 伤害' },
  gaiaWrath: { id:'gaiaWrath',  name:'大地之怒', el:'earth', cost:3, type:'attack', rarity:'legend',dmg:12, target:'all', text:'对全体造成 12 伤害并获得 10 护甲', block:10 },
  stormLord: { id:'stormLord',  name:'风暴主宰', el:'wind',  cost:3, type:'attack', rarity:'legend',dmg:7, hits:4, target:'single', text:'对单体造成 4 段 7 伤害' },
  echoCore:  { id:'echoCore',   name:'回响核心', el:null,    cost:2, type:'skill',  rarity:'epic',  echo:true, target:'none', text: '本回合反应次数 +1' },
};

export const STARTER_DECK = ['spark','spark','spark','gale','gale','staticZap','staticZap','veil','rockwall','converge'];

export const RELICS = [
  { id:'resonanceMaster', name:'共鸣大师', text:'同元素 2 连即触发元素爆发' },
  { id:'reactor',         name:'反应堆',   text:'每回合反应次数上限 +1' },
  { id:'emberCore',       name:'熔火之核', text:'灼烧伤害 +2' },
  { id:'prism',           name:'双色棱镜', text:'每场战斗第一张牌视为双元素' },
  { id:'heavyCore',       name:'沉重岩心', text:'护甲溢出部分保留 1 回合' },
  { id:'stormVessel',     name:'雷云容器', text:'感电改为 3 段' },
  { id:'tideHourglass',   name:'潮汐沙漏', text:'控制类反应持续 +1 回合' },
  { id:'sandMemory',      name:'沙之记忆', text:'每击败一名敌人，抽 1 张牌' },
  { id:'overloadFuse',    name:'过载保险', text:'反噬伤害减半' },
  { id:'elementalAffinity',name:'元素亲和',text:'起始手牌必定包含 3 种不同元素' },
];

export const ENEMIES = {
  // Act I
  bogToad:   { id:'bogToad',   name:'泥沼蟾', act:1, hp:30, intents:[{t:'attack',v:6},{t:'attack',v:6}] },
  windWolf:  { id:'windWolf',  name:'风蚀狼', act:1, hp:34, intents:[{t:'attack',v:8},{t:'block',v:5}] },
  lavaLizard:{ id:'lavaLizard',name:'熔岩蜥', act:1, hp:40, intents:[{t:'attack',v:7},{t:'burn',v:2}] },
  twinEagle: { id:'twinEagle', name:'双头鹰', act:1, hp:60, elite:true, intents:[{t:'attack',v:5,hits:2},{t:'attack',v:9}] },
  stoneColossus:{ id:'stoneColossus', name:'风蚀巨像', act:1, hp:120, boss:true, intents:[{t:'attack',v:10},{t:'block',v:15},{t:'attack',v:8}] },
  // Act II
  tidePriest:{ id:'tidePriest',name:'潮汐祭司', act:2, hp:70, intents:[{t:'heal',v:8},{t:'attack',v:9}] },
  coralGuard:{ id:'coralGuard',name:'珊瑚守卫', act:2, hp:95, intents:[{t:'block',v:12},{t:'attack',v:11}] },
  magmaWorm: { id:'magmaWorm', name:'熔核蠕虫', act:2, hp:85, intents:[{t:'burn',v:3},{t:'attack',v:12}] },
  twinDeep:  { id:'twinDeep',  name:'深海双子', act:2, hp:60, elite:true, intents:[{t:'attack',v:7},{t:'attack',v:7}] },
  tideMother:{ id:'tideMother',name:'潮汐母体', act:2, hp:180, boss:true, intents:[{t:'summon'},{t:'attack',v:12},{t:'block',v:20}] },
  // Act III
  stormWarden:{ id:'stormWarden', name:'雷纹守卫', act:3, hp:130, intents:[{t:'attack',v:15},{t:'charge',v:30}] },
  thunderEmperor:{ id:'thunderEmperor', name:'雷帝·阿库拉', act:3, hp:240, boss:true, intents:[{t:'attack',v:14},{t:'reflect'},{t:'charge',v:40}] },
};

export const EVENTS = [
  {
    id: 'rift', title: '元素裂隙',
    body: '地面裂开一道缝隙，纯粹的元素能量在其中涌动。伸手可以抓住它，但代价不小。',
    options: [
      { label: '伸手探入（-10 HP，获得 1 张史诗卡）', apply: (run) => { run.hp = Math.max(0, run.hp - 10); run.gainRandomCard('epic'); return '你获得了一张史诗卡牌。'; } },
      { label: '离开（+30 金币）', apply: (run) => { run.gold += 30; return '你收下了裂隙旁的碎晶。'; } },
    ],
  },
  {
    id: 'sleeper', title: '沉睡的元素使',
    body: '一位元素使在石座上沉睡。唤醒他也许会得到馈赠，也许会被诅咒。',
    options: [
      { label: '唤醒他（获得遗物 + 1 张诅咒卡）', apply: (run) => { run.gainRandomRelic(); run.gainCard('converge'); return '他给了你一件遗物，并低语了一段咒文。'; } },
      { label: '不打扰（回复 15 HP）', apply: (run) => { run.heal(15); return '你在旁边静静休息了一会儿。'; } },
    ],
  },
  {
    id: 'forge', title: '熔炉商人',
    body: '一个浑身熔岩纹路的商人摆弄着他的熔炉。他愿意用你的卡牌交换他的收藏。',
    options: [
      { label: '交换 1 张卡（获得随机稀有卡）', apply: (run) => { run.gainRandomCard('rare'); return '熔炉吐出新的卡牌。'; } },
      { label: '支付 80 金币（获得 2 次移除机会）', apply: (run) => { if (run.gold >= 80) { run.gold -= 80; run.removals += 2; return '你获得了 2 次移除卡牌的机会。'; } return '你的金币不够。'; } },
    ],
  },
];

// 卡面图案（v1 用字符图案占位，后续替换为真实图标/立绘）
export const ELEMENT_GLYPH = {
  fire: '🔥', water: '💧', wind: '🌪', thunder: '⚡', earth: '🪨',
};

export const CARD_GLYPHS = {
  spark: '✦', gale: '❋', staticZap: '⚡', veil: '◍', rockwall: '▩', converge: '❖',
  emberStorm: '✹', tidalSurge: '≈', thunderclap: '⚡', sandVeil: '◌', updraft: '⇡',
  magmaFist: '✷', iceLance: '❅', voltChain: '⚉', stoneArmor: '▣', cyclone: '◎',
  inferno: '☄', abyssCall: '◉', thunderGod: '⚡', gaiaWrath: '▲', stormLord: '✺', echoCore: '◈',
};
