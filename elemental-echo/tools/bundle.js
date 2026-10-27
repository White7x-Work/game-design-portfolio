(function () {
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
__mods["data.js"] = function (__exports, __req) {
// 元素回响 — 数据层：元素、反应、卡牌、遗物、敌人

const ELEMENTS = {
  fire:    { id: 'fire',    name: '火', color: '#FF5A36', glow: '#FFB347' },
  water:   { id: 'water',   name: '水', color: '#2E9BFF', glow: '#7FD4FF' },
  wind:    { id: 'wind',    name: '风', color: '#3FD3A0', glow: '#B6FFE0' },
  thunder: { id: 'thunder', name: '雷', color: '#FFC53D', glow: '#FFF08A' },
  earth:   { id: 'earth',   name: '土', color: '#B07A4A', glow: '#E0B98A' },
};

// 反应：无序配对，overload 顺序敏感
// apply(b, targetIdx) 中 b 是 battle 对象，提供 dmg/hitAll/status/armor 等
const REACTIONS = [
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
const RESONANCE = {
  fire:    { name: '火焰共鸣', text: '灼烧层数 +2', apply(b, t) { b.addStatusAll('burn', 2, 2); } },
  water:   { name: '流水共鸣', text: '抽 1 张牌', apply(b) { b.drawCards(1); } },
  wind:    { name: '疾风共鸣', text: '该卡效果额外结算 1 次', apply(b, t) { b.repeatLastCard(t); } },
  thunder: { name: '雷光共鸣', text: '该卡伤害 +50%', apply(b, t) { b.dmg(t, 3); } },
  earth:   { name: '坚岩共鸣', text: '获得 6 护甲', apply(b) { b.gainArmor(6); } },
};

// 元素爆发（3 连，每场每种元素一次）
const BURST = {
  fire:    { name: '火·爆发', text: '全体 15 伤 + 灼烧 3 层', apply(b) { b.hitAll(15); b.addStatusAll('burn', 3, 2); } },
  water:   { name: '水·爆发', text: '治疗 8 并清除自身负面', apply(b) { b.heal(8); b.clearSelfStatus(); } },
  wind:    { name: '风·爆发', text: '全体 3 段 6 伤', apply(b) { b.hitAll(6); b.hitAll(6); b.hitAll(6); } },
  thunder: { name: '雷·爆发', text: '单体 24 伤', apply(b, t) { b.dmg(t, 24); } },
  earth:   { name: '土·爆发', text: '获得 18 护甲', apply(b) { b.gainArmor(18); } },
};

// 卡池
// target: 'single' | 'all' | 'none'
const CARDS = {
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

const STARTER_DECK = ['spark','spark','spark','gale','gale','staticZap','staticZap','veil','rockwall','converge'];

const RELICS = [
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

const ENEMIES = {
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

const EVENTS = [
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
const ELEMENT_GLYPH = {
  fire: '🔥', water: '💧', wind: '🌪', thunder: '⚡', earth: '🪨',
};

const CARD_GLYPHS = {
  spark: '✦', gale: '❋', staticZap: '⚡', veil: '◍', rockwall: '▩', converge: '❖',
  emberStorm: '✹', tidalSurge: '≈', thunderclap: '⚡', sandVeil: '◌', updraft: '⇡',
  magmaFist: '✷', iceLance: '❅', voltChain: '⚉', stoneArmor: '▣', cyclone: '◎',
  inferno: '☄', abyssCall: '◉', thunderGod: '⚡', gaiaWrath: '▲', stormLord: '✺', echoCore: '◈',
};

Object.assign(__exports, { ELEMENTS: ELEMENTS, REACTIONS: REACTIONS, RESONANCE: RESONANCE, BURST: BURST, CARDS: CARDS, STARTER_DECK: STARTER_DECK, RELICS: RELICS, ENEMIES: ENEMIES, EVENTS: EVENTS, ELEMENT_GLYPH: ELEMENT_GLYPH, CARD_GLYPHS: CARD_GLYPHS });
};

__mods["engine.js"] = function (__exports, __req) {
// 元素回响 — 战斗引擎（纯逻辑，不含 DOM）
const { CARDS, REACTIONS, RESONANCE, BURST, ENEMIES } = __req("data.js");

const rand = (n) => Math.floor(Math.random() * n);

function shuffle(a) {
  const arr = [...a];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = rand(i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function makeEnemy(id, hpScale = 1) {
  const proto = ENEMIES[id];
  const hp = Math.round(proto.hp * hpScale);
  return {
    id: proto.id, name: proto.name, hp, maxHp: hp, armor: 0,
    statuses: {}, intentIndex: 0, intents: proto.intents,
    boss: !!proto.boss, elite: !!proto.elite, charging: 0, dead: false,
  };
}

function createBattle({ enemies, deck, hp, maxHp, relics = [], onLog }) {
  const b = {
    enemies, relics, onLog,
    player: { hp, maxHp, armor: 0, statuses: {}, buffNext: false, dualNext: false },
    energy: 3, energyMax: 3,
    drawPile: shuffle(deck), hand: [], discard: [],
    lastEl: null, sameChain: 0, playedThisTurn: 0,
    reactionsUsed: 0, reactionLimit: relics.includes('reactor') ? 3 : 2,
    lavaTurns: 0, turn: 1, over: false, victory: false,
    burstUsed: {}, floating: [], events: [],
  };

  const has = (r) => relics.includes(r);

  b.log = (msg, kind = 'info') => { if (onLog) onLog(msg, kind); };

  // ---- 通用战斗操作 ----
  b.dmg = (idx, amount, opts = {}) => {
    const e = b.enemies[idx];
    if (!e || e.dead) {
      const alive = b.enemies.find((x) => !x.dead);
      if (!alive) return 0;
      return b.dmg(b.enemies.indexOf(alive), amount, opts);
    }
    if (e.statuses.reflect && e.statuses.reflect.turns > 0 && !opts.isReflect) {
      const back = Math.round(amount * 0.5);
      b.selfDamage(back, true);
    }
    let rest = amount;
    if (!opts.ignoreArmor && e.armor > 0) {
      const absorbed = Math.min(e.armor, rest);
      e.armor -= absorbed;
      rest -= absorbed;
    }
    e.hp = Math.max(0, e.hp - rest);
    b.floating.push({ idx, text: `-${amount}`, kind: 'dmg' });
    if (e.hp <= 0 && !e.dead) { e.dead = true; b.log(`${e.name} 被击败！`, 'kill'); }
    return amount;
  };

  b.hitAll = (amount) => {
    b.enemies.forEach((e, i) => { if (!e.dead) b.dmg(i, amount); });
  };

  b.selfDamage = (amount, isReflect = false) => {
    const dmg = has('overloadFuse') && !isReflect ? Math.ceil(amount / 2) : amount;
    let rest = dmg;
    if (b.player.armor > 0) {
      const abs = Math.min(b.player.armor, rest);
      b.player.armor -= abs;
      rest -= abs;
    }
    b.player.hp = Math.max(0, b.player.hp - rest);
    b.floating.push({ target: 'player', text: `-${dmg}`, kind: 'selfdmg' });
  };

  b.gainArmor = (n) => { b.player.armor += n; b.floating.push({ target: 'player', text: `+${n}`, kind: 'block' }); };
  b.heal = (n) => {
    const before = b.player.hp;
    b.player.hp = Math.min(b.player.maxHp, b.player.hp + n);
    b.floating.push({ target: 'player', text: `+${b.player.hp - before}`, kind: 'heal' });
  };
  b.clearSelfStatus = () => { b.player.statuses = {}; };

  b.addStatus = (e, key, turns, val = 0) => {
    if (has('tideHourglass') && (key === 'freeze' || key === 'stun')) turns += 1;
    if (!e.statuses[key]) e.statuses[key] = { turns, val };
    else {
      e.statuses[key].turns = Math.max(e.statuses[key].turns, turns);
      e.statuses[key].val = Math.max(e.statuses[key].val || 0, val);
    }
  };
  b.addStatusAll = (key, turns, val = 0) => b.enemies.forEach((e) => { if (!e.dead) b.addStatus(e, key, turns, val); });

  b.drawCards = (n) => {
    for (let i = 0; i < n; i++) {
      if (b.drawPile.length === 0) {
        if (b.discard.length === 0) return;
        b.drawPile = shuffle(b.discard);
        b.discard = [];
      }
      if (b.hand.length >= 7) return;
      b.hand.push(b.drawPile.pop());
    }
  };

  // 疾风共鸣：重复结算最后一张牌
  b.lastCardResolved = null;
  b.repeatLastCard = (t) => {
    const c = b.lastCardResolved;
    if (!c) return;
    if (c.dmg) {
      const times = c.hits || 1;
      for (let i = 0; i < times; i++) b.dmg(t, c.dmg);
    }
  };

  // ---- 反应 / 共鸣 ----
  b.resolveChain = (cardEl, targetIdx) => {
    if (!cardEl) { b.lastEl = null; b.sameChain = 0; return null; }
    const prevEl = b.lastEl;

    if (b.player.dualNext) {
      b.player.dualNext = false;
      if (prevEl) {
        const pair = prevEl === cardEl
          ? REACTIONS.find((r) => r.pair.includes(prevEl))
          : REACTIONS.find((r) => r.pair.includes(prevEl) && r.pair.includes(cardEl))
            || REACTIONS.find((r) => r.pair.includes(prevEl));
        if (pair) {
          pair.apply(b, targetIdx, `${prevEl}->${cardEl}`);
          b.log(`✨ 双元素触发反应：${pair.name}`, 'reaction');
          b.lastEl = cardEl; b.sameChain = 0;
          return { kind: 'reaction', name: pair.name, text: pair.text };
        }
      }
      b.lastEl = cardEl; b.sameChain = 1;
      return null;
    }

    if (!prevEl) { b.lastEl = cardEl; b.sameChain = 1; return null; }

    if (prevEl === cardEl) {
      b.sameChain += 1;
      if (b.sameChain >= 3 && !b.burstUsed[cardEl]) {
        b.burstUsed[cardEl] = true;
        const burst = BURST[cardEl];
        burst.apply(b, targetIdx);
        b.log(`💥 元素爆发：${burst.name}`, 'burst');
        b.sameChain = 0;
        return { kind: 'burst', name: burst.name, text: burst.text };
      }
      if (has('resonanceMaster') && b.sameChain >= 2 && !b.burstUsed[cardEl]) {
        b.burstUsed[cardEl] = true;
        const burst = BURST[cardEl];
        burst.apply(b, targetIdx);
        b.log(`💥 共鸣大师：${burst.name}`, 'burst');
        return { kind: 'burst', name: burst.name, text: burst.text };
      }
      if (b.sameChain >= 2) {
        const reso = RESONANCE[cardEl];
        reso.apply(b, targetIdx);
        b.log(`◇ 共鸣：${reso.name}（${reso.text}）`, 'resonance');
        return { kind: 'resonance', name: reso.name, text: reso.text };
      }
      return null;
    }

    // 不同元素 → 反应
    if (b.reactionsUsed >= b.reactionLimit) {
      b.lastEl = cardEl; b.sameChain = 1;
      return null;
    }
    const reaction = REACTIONS.find((r) => r.pair.includes(prevEl) && r.pair.includes(cardEl));
    if (!reaction) { b.lastEl = cardEl; b.sameChain = 1; return null; }

    let order = `${prevEl}->${cardEl}`;
    if (!reaction.orderSensitive) order = null;
    else if (!(prevEl === 'fire' && cardEl === 'thunder')) order = 'thunder->fire';

    reaction.apply(b, targetIdx, order);
    b.reactionsUsed += 1;
    b.log(`✨ 反应：${reaction.name} — ${reaction.text}`, 'reaction');
    b.lastEl = cardEl; b.sameChain = 1;
    return { kind: 'reaction', name: reaction.name, text: reaction.text, order };
  };

  // ---- 出牌 ----
  b.canPlay = (card) => b.energy >= card.cost && !b.over;

  b.playCard = (handIndex, targetIdx = 0) => {
    if (b.over) return null;
    const card = b.hand[handIndex];
    if (!card || b.energy < card.cost) return null;

    b.energy -= card.cost;
    b.hand.splice(handIndex, 1);
    b.playedThisTurn += 1;
    b.lastCardResolved = card;

    // 卡面效果
    if (card.block) b.gainArmor(card.block);
    if (card.heal) b.heal(card.heal);
    if (card.selfDmg) b.selfDamage(card.selfDmg);
    if (card.echo) { b.reactionLimit += 1; b.log('回响核心：本回合反应次数 +1', 'info'); }
    if (card.buffNext) { b.player.dualNext = true; b.log('元素汇聚：下一张牌视为双元素', 'info'); }
    if (card.dmg) {
      const times = card.hits || 1;
      const mul = b.player.buffNext ? 1.5 : 1;
      if (b.player.buffNext) b.player.buffNext = false;
      for (let i = 0; i < times; i++) {
        const amount = Math.round(card.dmg * mul);
        if (card.target === 'all') b.hitAll(amount);
        else b.dmg(targetIdx, amount);
      }
    }
    if (card.burn) {
      const e = b.enemies[targetIdx];
      if (e && !e.dead) b.addStatus(e, 'burn', 2, card.burn);
    }
    if (card.weak) {
      const e = b.enemies[targetIdx];
      if (e && !e.dead) b.addStatus(e, 'weak', card.weak);
    }
    if (card.draw) b.drawCards(card.draw);

    // 首张牌双色棱镜
    let el = card.el;
    if (has('prism') && b.playedThisTurn === 1 && !el) el = 'fire';
    if (has('prism') && b.playedThisTurn === 2) { /* 已用 */ }

    const chain = b.resolveChain(el, targetIdx);
    b.discard.push(card);

    b.checkOver();
    return { card, chain };
  };

  b.checkOver = () => {
    if (b.player.hp <= 0) { b.over = true; b.victory = false; }
    else if (b.enemies.every((e) => e.dead)) { b.over = true; b.victory = true; }
  };

  // ---- 回合 ----
  b.startPlayerTurn = () => {
    b.energy = b.energyMax;
    b.armorCarry();
    b.player.armor = b.armorKept || 0;
    b.armorKept = 0;
    b.lastEl = null;
    b.sameChain = 0;
    b.playedThisTurn = 0;
    b.reactionsUsed = 0;
    b.reactionLimit = has('reactor') ? 3 : 2;
    b.drawCards(5);
    // 玩家灼烧
    if (b.player.statuses.burn) {
      b.selfDamage(b.player.statuses.burn.val || 0, true);
      b.player.statuses.burn.turns -= 1;
      if (b.player.statuses.burn.turns <= 0) delete b.player.statuses.burn;
    }
    b.checkOver();
  };

  b.armorCarry = () => {
    if (has('heavyCore') && b.player.armor > 0) b.armorKept = Math.floor(b.player.armor / 2);
  };

  b.endPlayerTurn = () => {
    b.discard.push(...b.hand);
    b.hand = [];
    b.player.armor = 0;
    b.enemyTurn();
    if (b.over) return;
    b.turn += 1;
    b.startPlayerTurn();
  };

  b.enemyTurn = () => {
    // 熔岩
    if (b.lavaTurns > 0) {
      b.enemies.forEach((e, i) => { if (!e.dead) { b.dmg(i, 4, { ignoreArmor: true, isReflect: true }); } });
      b.lavaTurns -= 1;
    }
    for (const [i, e] of b.enemies.entries()) {
      if (e.dead) continue;
      // 状态 tick
      const s = e.statuses;
      if (s.burn && s.burn.turns > 0) {
        const burnDmg = (s.burn.val || 0) + (has('emberCore') ? 2 : 0);
        e.hp = Math.max(0, e.hp - burnDmg);
        b.floating.push({ idx: i, text: `-${burnDmg}`, kind: 'burn' });
        b.events.push({ k: 'burnTick', idx: i, name: e.name, amount: burnDmg });
        s.burn.turns -= 1;
        if (s.burn.turns <= 0) delete s.burn;
        if (e.hp <= 0) { e.dead = true; b.log(`${e.name} 被灼烧击败`, 'kill'); continue; }
      }
      if (s.sand && s.sand.turns > 0) {
        e.hp = Math.max(0, e.hp - (s.sand.val || 3));
        s.sand.turns -= 1;
        if (s.sand.turns <= 0) delete s.sand;
        if (e.hp <= 0) { e.dead = true; continue; }
      }
      if (s.freeze && s.freeze.turns > 0) { s.freeze.turns -= 1; if (s.freeze.turns <= 0) delete s.freeze; b.log(`${e.name} 被冻结，无法行动`, 'info'); continue; }
      if (s.stun && s.stun.turns > 0) { s.stun.turns -= 1; if (s.stun.turns <= 0) delete s.stun; b.log(`${e.name} 眩晕中`, 'info'); continue; }

      const intent = e.intents[e.intentIndex % e.intents.length];
      e.intentIndex += 1;
      b.executeIntent(e, intent, i);
      if (b.player.hp <= 0) { b.over = true; b.victory = false; return; }
    }
    b.checkOver();
  };

  b.executeIntent = (e, intent, idx = 0) => {
    const weakMul = e.statuses.weak ? 0.7 : 1;
    const blindMiss = e.statuses.blind ? Math.random() < 0.4 : false;
    if (e.statuses.blind) { e.statuses.blind.turns -= 1; if (e.statuses.blind.turns <= 0) delete e.statuses.blind; }

    switch (intent.t) {
      case 'attack': {
        if (blindMiss) {
          b.log(`${e.name} 攻击落空`, 'info');
          b.events.push({ k: 'miss', idx, name: e.name });
          break;
        }
        const times = intent.hits || 1;
        let total = 0;
        for (let i = 0; i < times; i++) {
          let dmg = Math.round(intent.v * weakMul);
          if (e.charging > 0) { dmg += e.charging; }
          total += dmg;
          b.playerHit(dmg);
        }
        e.charging = 0;
        b.log(`${e.name} 造成 ${total} 伤害`, 'enemy');
        b.events.push({ k: 'attack', idx, name: e.name, amount: total });
        break;
      }
      case 'block':
        e.armor += intent.v;
        b.log(`${e.name} 获得 ${intent.v} 护甲`, 'enemy');
        b.events.push({ k: 'buff', idx, name: e.name, label: `+${intent.v} 护甲` });
        break;
      case 'heal': {
        const before = e.hp;
        e.hp = Math.min(e.maxHp, e.hp + intent.v);
        b.log(`${e.name} 回复 ${e.hp - before} HP`, 'enemy');
        b.events.push({ k: 'heal', idx, name: e.name, amount: e.hp - before });
        break;
      }
      case 'burn':
        b.player.statuses.burn = { turns: 2, val: intent.v };
        b.log(`${e.name} 施加 ${intent.v} 层灼烧`, 'enemy');
        b.events.push({ k: 'debuff', idx, name: e.name, label: `灼烧 ${intent.v}` });
        break;
      case 'charge':
        e.charging = intent.v;
        b.log(`${e.name} 正在蓄力 ${intent.v}！`, 'warn');
        b.events.push({ k: 'charge', idx, name: e.name, amount: intent.v });
        break;
      case 'reflect':
        e.statuses.reflect = { turns: 1 };
        b.log(`${e.name} 进入反伤姿态`, 'warn');
        b.events.push({ k: 'buff', idx, name: e.name, label: '反伤姿态' });
        break;
      case 'summon': {
        const alive = b.enemies.filter((x) => !x.dead).length;
        if (alive < 3) {
          const minion = makeEnemy('bogToad', 0.6);
          minion.name = '分裂体';
          b.enemies.push(minion);
          b.log(`${e.name} 召唤了分裂体`, 'warn');
          b.events.push({ k: 'summon', idx, name: e.name, label: '召唤分裂体' });
        }
        break;
      }
      default: break;
    }
    if (e.statuses.reflect) { e.statuses.reflect.turns -= 1; if (e.statuses.reflect.turns <= 0) delete e.statuses.reflect; }
  };

  b.playerHit = (dmg) => {
    let rest = dmg;
    if (b.player.armor > 0) {
      const abs = Math.min(b.player.armor, rest);
      b.player.armor -= abs;
      rest -= abs;
    }
    b.player.hp = Math.max(0, b.player.hp - rest);
    b.floating.push({ target: 'player', text: `-${dmg}`, kind: 'selfdmg' });
    b.events.push({ k: 'playerHit', amount: dmg });
  };

  b.startPlayerTurn();
  return b;
}

Object.assign(__exports, { shuffle: shuffle, makeEnemy: makeEnemy, createBattle: createBattle });
};

__mods["run.js"] = function (__exports, __req) {
// 元素回响 — 单局流程（地图、奖励、商店、计分）
const { CARDS, STARTER_DECK, RELICS, ENEMIES, EVENTS } = __req("data.js");

const rand = (n) => Math.floor(Math.random() * n);
const pick = (arr) => arr[rand(arr.length)];

let uid = 0;
function makeCard(id) {
  const proto = CARDS[id];
  if (!proto) throw new Error('unknown card: ' + id);
  return { ...proto, uid: ++uid };
}

const ACTS = [
  { act: 1, name: '元素林地', pool: ['bogToad', 'windWolf', 'lavaLizard'], elite: ['twinEagle'], boss: 'stoneColossus', layers: 7 },
  { act: 2, name: '熔脉深渊', pool: ['tidePriest', 'coralGuard', 'magmaWorm'], elite: ['twinDeep'], boss: 'tideMother', layers: 7 },
  { act: 3, name: '雷暴之巅', pool: ['stormWarden'], elite: ['stormWarden'], boss: 'thunderEmperor', layers: 6 },
];

function runeNodeType(layer, total, act) {
  if (layer === total - 1) return 'boss';
  if (layer === 0) return 'battle';
  const r = Math.random();
  if (layer === total - 2) return r < 0.5 ? 'rest' : 'shop';
  if (r < 0.42) return 'battle';
  if (r < 0.55) return 'elite';
  if (r < 0.66) return 'shop';
  if (r < 0.80) return 'event';
  if (r < 0.92) return 'rest';
  return 'treasure';
}

function newRun(character = 'fire') {
  const deck = STARTER_DECK.map(makeCard);
  const run = {
    character,
    act: 1,
    layer: 0,
    maxHp: 70,
    hp: 70,
    gold: 50,
    deck,
    relics: [],
    removals: 1,
    revived: false,
    usedReviveAd: false,
    kills: 0,
    map: null,
    achievements: [],
    finished: false,
    dead: false,
  };
  run.map = generateMap(run.act);
  return run;
}

function generateMap(act) {
  const conf = ACTS[act - 1];
  const layers = [];
  for (let i = 0; i < conf.layers; i++) {
    const width = i === 0 || i === conf.layers - 1 ? 1 : (Math.random() < 0.5 ? 2 : 3);
    const nodes = [];
    for (let j = 0; j < width; j++) {
      nodes.push({ type: runeNodeType(i, conf.layers, act), cleared: false });
    }
    layers.push(nodes);
  }
  return { act, layers, conf };
}

function currentNode(run) {
  const layer = run.map.layers[run.layer];
  return layer ? layer[run.choosing ?? 0] : null;
}

function nodeOptions(run) {
  return run.map.layers[run.layer] || [];
}

// 根据节点类型生成敌人
function enemiesForNode(run, node) {
  const conf = ACTS[run.act - 1];
  const scale = 1 + (run.act - 1) * 0.15;
  if (node.type === 'boss') return [{ id: conf.boss, count: 1 }];
  if (node.type === 'elite') return [{ id: pick(conf.elite), count: Math.random() < 0.4 ? 2 : 1 }];
  const count = Math.random() < 0.55 ? 1 : (Math.random() < 0.8 ? 2 : 3);
  const out = [];
  for (let i = 0; i < count; i++) out.push({ id: pick(conf.pool), count: 1 });
  return out;
}

function rewardCards(run, n = 3) {
  const all = Object.values(CARDS);
  const out = [];
  for (let i = 0; i < n; i++) {
    const r = Math.random();
    let pool = all.filter((c) => c.rarity === 'common');
    if (r > 0.72) pool = all.filter((c) => c.rarity === 'rare');
    if (r > 0.92) pool = all.filter((c) => c.rarity === 'epic' || c.rarity === 'legend');
    const c = pick(pool);
    if (!out.find((x) => x.id === c.id)) out.push(c);
    else i -= 1;
  }
  return out.map((c) => makeCard(c.id));
}

function gainRandomCard(rarity) {
  const all = Object.values(CARDS);
  const pool = rarity ? all.filter((c) => c.rarity === rarity) : all;
  return makeCard(pick(pool).id);
}

function randomRelic(run) {
  const owned = new Set(run.relics);
  const avail = RELICS.filter((r) => !owned.has(r.id));
  if (!avail.length) return null;
  const r = pick(avail);
  run.relics.push(r.id);
  return r;
}

function shopStock(run) {
  const cards = rewardCards(run, 5).map((c) => ({ card: c, price: 45 + rand(40) }));
  const owned = new Set(run.relics);
  const relicPool = RELICS.filter((r) => !owned.has(r.id));
  const relics = [];
  for (let i = 0; i < Math.min(2, relicPool.length); i++) {
    const r = relicPool.splice(rand(relicPool.length), 1)[0];
    relics.push({ relic: r, price: 120 + rand(60) });
  }
  return { cards, relics, removePrice: 60 + (run.removalsUsed || 0) * 20 };
}

function calcScore(run) {
  const floorBonus = run.act * 3 + run.layer;
  const base = floorBonus * 1000 + run.kills * 50 + Math.max(0, run.hp) * 10 + run.gold * 2;
  return Math.round(base * (run.revived ? 0.9 : 1));
}

function pickEvent(run) {
  return pick(EVENTS);
}


// ---------------- 单局存档（支持保存后回主界面、下次继续） ----------------
const RUN_KEY = 'elemental-echo:run';

function serializeRun(run) {
  return {
    v: 1,
    character: run.character,
    act: run.act,
    layer: run.layer,
    choosing: run.choosing || 0,
    hp: run.hp,
    maxHp: run.maxHp,
    gold: run.gold,
    relics: [...run.relics],
    deck: run.deck.map((c) => c.id),
    removals: run.removals || 0,
    removalsUsed: run.removalsUsed || 0,
    revived: !!run.revived,
    usedReviveAd: !!run.usedReviveAd,
    kills: run.kills || 0,
    map: {
      act: run.map.act,
      layers: run.map.layers.map((layer) => layer.map((n) => ({ type: n.type, cleared: !!n.cleared }))),
    },
  };
}

function deserializeRun(data) {
  if (!data || data.v !== 1) return null;
  const conf = ACTS[data.act - 1];
  if (!conf) return null;
  return {
    character: data.character || 'fire',
    act: data.act,
    layer: data.layer,
    choosing: data.choosing || 0,
    hp: data.hp,
    maxHp: data.maxHp,
    gold: data.gold,
    relics: [...(data.relics || [])],
    deck: (data.deck || []).map((id) => {
      try { return makeCard(id); } catch { return null; }
    }).filter(Boolean),
    removals: data.removals || 0,
    removalsUsed: data.removalsUsed || 0,
    revived: !!data.revived,
    usedReviveAd: !!data.usedReviveAd,
    kills: data.kills || 0,
    finished: false,
    dead: false,
    map: {
      act: data.act,
      conf,
      layers: (data.map && data.map.layers || []).map((layer) => layer.map((n) => ({ type: n.type, cleared: !!n.cleared }))),
    },
  };
}

function saveRun(run) {
  try { localStorage.setItem(RUN_KEY, JSON.stringify(serializeRun(run))); return true; }
  catch { return false; }
}

function loadRun() {
  try {
    const raw = localStorage.getItem(RUN_KEY);
    if (!raw) return null;
    return deserializeRun(JSON.parse(raw));
  } catch { return null; }
}

function hasRunSave() {
  try { return Boolean(localStorage.getItem(RUN_KEY)); } catch { return false; }
}

function clearRun() {
  try { localStorage.removeItem(RUN_KEY); } catch { /* 忽略 */ }
}

Object.assign(__exports, { makeCard: makeCard, ACTS: ACTS, newRun: newRun, generateMap: generateMap, currentNode: currentNode, nodeOptions: nodeOptions, enemiesForNode: enemiesForNode, rewardCards: rewardCards, gainRandomCard: gainRandomCard, randomRelic: randomRelic, shopStock: shopStock, calcScore: calcScore, pickEvent: pickEvent, EVENTS: EVENTS, RELICS: RELICS, CARDS: CARDS, ENEMIES: ENEMIES, serializeRun: serializeRun, deserializeRun: deserializeRun, saveRun: saveRun, loadRun: loadRun, hasRunSave: hasRunSave, clearRun: clearRun });
};

__mods["fx.js"] = function (__exports, __req) {
// 元素回响 — 特效（Canvas 粒子 / 屏幕震动）与音效（Web Audio 合成）

// ---------------- 粒子 ----------------
const P = { canvas: null, ctx: null, parts: [], running: false, max: 160 };

function loop() {
  if (!P.ctx) return;
  const ctx = P.ctx;
  ctx.clearRect(0, 0, P.canvas.width, P.canvas.height);
  for (let i = P.parts.length - 1; i >= 0; i--) {
    const p = P.parts[i];
    p.x += p.vx; p.y += p.vy;
    p.vy += p.g; p.vx *= 0.99; p.vy *= 0.99;
    p.life -= 1;
    if (p.life <= 0) { P.parts.splice(i, 1); continue; }
    const a = Math.max(0, p.life / p.maxLife);
    ctx.globalAlpha = a;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * a, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  if (P.parts.length > 0) requestAnimationFrame(loop);
  else { P.running = false; ctx.clearRect(0, 0, P.canvas.width, P.canvas.height); }
}

const FX = {
  init(canvas) {
    P.canvas = canvas;
    P.ctx = canvas.getContext('2d');
    this.resize();
    window.addEventListener('resize', () => this.resize());
  },
  resize() {
    if (!P.canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    P.canvas.width = window.innerWidth * dpr;
    P.canvas.height = window.innerHeight * dpr;
    P.canvas.style.width = window.innerWidth + 'px';
    P.canvas.style.height = window.innerHeight + 'px';
    P.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  },
  burst(x, y, color = '#FFC53D', count = 24, spread = 5) {
    if (!P.ctx) return;
    const n = Math.min(count, P.max - P.parts.length);
    for (let i = 0; i < n; i++) {
      const ang = Math.random() * Math.PI * 2;
      const spd = Math.random() * spread + 0.6;
      P.parts.push({
        x, y,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd - 1,
        g: 0.08,
        size: Math.random() * 3.2 + 1.4,
        color,
        life: 26 + Math.random() * 22,
        maxLife: 48,
      });
    }
    if (!P.running) { P.running = true; requestAnimationFrame(loop); }
  },
  burstEl(el, color, count) {
    if (!el) return;
    const r = el.getBoundingClientRect();
    this.burst(r.left + r.width / 2, r.top + r.height / 2, color, count);
  },
  shake(power = 4, ms = 240) {
    const app = document.getElementById('app');
    if (!app) return;
    app.style.setProperty('--shake', '0px');
    const start = performance.now();
    const step = (now) => {
      const t = (now - start) / ms;
      if (t >= 1) { app.style.setProperty('--shake', '0px'); return; }
      const amp = power * (1 - t);
      app.style.setProperty('--shake', `${(Math.random() * 2 - 1) * amp}px`);
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  },
};

// ---------------- 音效 ----------------
let actx = null;
let enabled = true;

function ctx() {
  if (!actx) {
    try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch { return null; }
  }
  if (actx && actx.state === 'suspended') actx.resume();
  return actx;
}

function tone(freq, dur, type = 'sine', gain = 0.12, slideTo = null) {
  const a = ctx();
  if (!a) return;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, a.currentTime);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, a.currentTime + dur);
  g.gain.setValueAtTime(0.0001, a.currentTime);
  g.gain.exponentialRampToValueAtTime(gain, a.currentTime + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + dur);
  o.connect(g); g.connect(a.destination);
  o.start(); o.stop(a.currentTime + dur + 0.02);
}

function noise(dur = 0.12, gain = 0.08) {
  const a = ctx();
  if (!a) return;
  const buf = a.createBuffer(1, a.sampleRate * dur, a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
  const src = a.createBufferSource();
  src.buffer = buf;
  const g = a.createGain();
  g.gain.value = gain;
  src.connect(g); g.connect(a.destination);
  src.start();
}

const SFX = {
  click:    () => tone(620, 0.05, 'triangle', 0.05),
  draw:     () => noise(0.06, 0.04),
  play:     () => { tone(380, 0.1, 'square', 0.06, 520); },
  reaction: () => { tone(520, 0.16, 'sawtooth', 0.08, 780); noise(0.1, 0.05); },
  burst:    () => { tone(160, 0.5, 'sine', 0.16, 60); noise(0.3, 0.1); },
  hurt:     () => { tone(140, 0.14, 'square', 0.09, 90); },
  kill:     () => { noise(0.18, 0.09); tone(300, 0.2, 'triangle', 0.07, 120); },
  coin:     () => { tone(880, 0.07, 'sine', 0.07); setTimeout(() => tone(1180, 0.08, 'sine', 0.06), 60); },
  win:      () => { [523, 659, 784].forEach((f, i) => setTimeout(() => tone(f, 0.22, 'sine', 0.09), i * 90)); },
  lose:     () => { [392, 311, 233].forEach((f, i) => setTimeout(() => tone(f, 0.3, 'sine', 0.09), i * 140)); },
  error:    () => tone(180, 0.12, 'square', 0.07),
};

const AUDIO = {
  unlock() { ctx(); },
  setEnabled(v) { enabled = v; },
  isEnabled() { return enabled; },
  sfx(name) {
    if (!enabled) return;
    const fn = SFX[name];
    if (fn) { try { fn(); } catch { /* 静默降级 */ } }
  },
};

Object.assign(__exports, { FX: FX, AUDIO: AUDIO });
};

__mods["tap.js"] = function (__exports, __req) {
// 元素回响 — TapTap 能力桥接层
// 原则：客户端不安装 SDK，tap 是运行时全局对象；无 tap 环境全部降级为本地实现。

const TAP_CONFIG = {
  leaderboardId: '',   // 由 MCP create_leaderboard 返回后填入
  shareTemplateId: '', // 由 MCP create_share_template 审核通过后填入
  adSpaceId: '',       // 由 MCP check_ads_status 返回后填入
};

const T = () => (typeof window !== 'undefined' ? window.tap : undefined);
const hasTap = () => typeof T() !== 'undefined';

// ---------------- 震动 ----------------
const haptics = {
  short() {
    if (!hasTap()) { if (navigator.vibrate) navigator.vibrate(15); return; }
    try { T().vibrateShort?.({ type: 'light' }); } catch { /* 静默 */ }
  },
  long() {
    if (!hasTap()) { if (navigator.vibrate) navigator.vibrate([30, 40, 30]); return; }
    try { T().vibrateLong?.({}); } catch { /* 静默 */ }
  },
};

// ---------------- 排行榜 ----------------
const leaderboard = {
  available() { return hasTap() && typeof T().getLeaderboardManager === 'function'; },
  configured() { return Boolean(TAP_CONFIG.leaderboardId); },
  async submit(score) {
    if (!this.available() || !this.configured()) return { ok: false, reason: 'unavailable' };
    return new Promise((resolve) => {
      try {
        T().getLeaderboardManager().submitScores({
          scores: [{ leaderboardId: TAP_CONFIG.leaderboardId, score }],
          callback: {
            onSuccess: () => resolve({ ok: true }),
            onFailure: (code, msg) => resolve({ ok: false, reason: `${code}:${msg}` }),
          },
        });
      } catch (e) { resolve({ ok: false, reason: String(e) }); }
    });
  },
  async open() {
    if (!this.available() || !this.configured()) return { ok: false, reason: 'unavailable' };
    return new Promise((resolve) => {
      try {
        T().getLeaderboardManager().openLeaderboard({
          leaderboardId: TAP_CONFIG.leaderboardId,
          collection: 'public',
          callback: {
            onSuccess: () => resolve({ ok: true }),
            onFailure: (code, msg) => resolve({ ok: false, reason: `${code}:${msg}` }),
          },
        });
      } catch (e) { resolve({ ok: false, reason: String(e) }); }
    });
  },
};

// ---------------- 计分 / 元进程存储 ----------------
const META_KEY = 'elemental-echo:meta';

function loadMeta() {
  try {
    const raw = localStorage.getItem(META_KEY);
    if (!raw) return { bestScore: 0, bestAct: 0, runs: 0, kills: 0, unlocked: [] };
    return JSON.parse(raw);
  } catch { return { bestScore: 0, bestAct: 0, runs: 0, kills: 0, unlocked: [] }; }
}

function saveMeta(meta) {
  try { localStorage.setItem(META_KEY, JSON.stringify(meta)); } catch { /* 忽略 */ }
}

// ---------------- 云存档 ----------------
// 约束：每分钟最多 1 次上传；存档名不能含中文/空格；不并发。
let lastCloudAt = 0;
let cloudBusy = false;
const ARCHIVE_NAME = 'elemental_echo_meta';

function fileSystem() {
  try { return T()?.getFileSystemManager?.(); } catch { return null; }
}

const cloud = {
  available() { return hasTap() && typeof T().getCloudSaveManager === 'function'; },

  // 节流 + 串行，失败静默降级（本地已有一份）
  async save(meta) {
    if (!this.available()) return { ok: false, reason: 'unavailable' };
    if (cloudBusy) return { ok: false, reason: 'busy' };
    const now = Date.now();
    if (now - lastCloudAt < 60_000) return { ok: false, reason: 'throttled' };
    cloudBusy = true;
    lastCloudAt = now;
    try {
      const fs = fileSystem();
      const cs = T().getCloudSaveManager();
      const path = `${T().env.USER_DATA_PATH}/${ARCHIVE_NAME}.json`;
      await new Promise((res, rej) => fs.writeFile({
        filePath: path, data: JSON.stringify(meta), encoding: 'utf8',
        success: res, fail: rej,
      }));
      const list = await new Promise((res) => cs.getArchiveList({ success: (r) => res(r.saves || []), fail: () => res([]) }));
      const exist = list.find((s) => s.name === ARCHIVE_NAME);
      await new Promise((res, rej) => {
        const cb = { success: res, fail: rej };
        const payload = {
          archiveMetaData: { name: ARCHIVE_NAME, summary: 'Elemental Echo progress', playtime: 0 },
          archiveFilePath: path,
          ...cb,
        };
        if (exist) cs.updateArchive({ archiveUUID: exist.uuid, ...payload });
        else cs.createArchive(payload);
      });
      return { ok: true };
    } catch (e) {
      return { ok: false, reason: String(e && e.errMsg || e) };
    } finally {
      cloudBusy = false;
    }
  },

  async load() {
    if (!this.available()) return null;
    try {
      const cs = T().getCloudSaveManager();
      const fs = fileSystem();
      const list = await new Promise((res) => cs.getArchiveList({ success: (r) => res(r.saves || []), fail: () => res([]) }));
      const arc = list.find((s) => s.name === ARCHIVE_NAME);
      if (!arc) return null;
      const target = `${T().env.USER_DATA_PATH}/${ARCHIVE_NAME}_dl.json`;
      await new Promise((res, rej) => cs.getArchiveData({
        archiveUUID: arc.uuid, archiveFileId: arc.fileId, targetFilePath: target, success: res, fail: rej,
      }));
      const data = await new Promise((res, rej) => fs.readFile({ filePath: target, encoding: 'utf8', success: res, fail: rej }));
      return JSON.parse(data.data);
    } catch { return null; }
  },
};

// ---------------- 分享 ----------------
const share = {
  available() { return hasTap() && typeof T().showShareboard === 'function'; },
  configured() { return Boolean(TAP_CONFIG.shareTemplateId); },
  async show() {
    if (!this.available() || !this.configured()) return { ok: false, reason: 'unavailable' };
    return new Promise((resolve) => {
      try {
        T().showShareboard({ templateId: TAP_CONFIG.shareTemplateId });
        resolve({ ok: true });
      } catch (e) { resolve({ ok: false, reason: String(e) }); }
    });
  },
};

// ---------------- 激励视频 ----------------
// 返回 true 表示"应当发放奖励"。广告不可用/加载失败/超时都放行或降级，绝不卡住玩家。
let adInstance = null;

const ads = {
  available() { return hasTap(); },

  async showRewarded(timeoutMs = 8000) {
    if (!hasTap()) return { ok: false, reason: 'no-tap' };
    const tap = T();

    const create = () => {
      if (adInstance) return adInstance;
      const factory = tap.createRewardedVideoAd || tap.createRewardVideoAd;
      if (typeof factory !== 'function') return null;
      try {
        adInstance = TAP_CONFIG.adSpaceId
          ? (factory.length > 0 ? factory({ spaceId: TAP_CONFIG.adSpaceId, adUnitId: TAP_CONFIG.adSpaceId }) : factory())
          : (factory.length > 0 ? factory({}) : factory());
      } catch { adInstance = null; }
      return adInstance;
    };

    const ad = create();
    if (!ad) return { ok: false, reason: 'unsupported' };

    return new Promise((resolve) => {
      let settled = false;
      const finish = (v) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        ad.onClose?.(() => {});
        resolve(v);
      };
      const timer = setTimeout(() => finish({ ok: false, reason: 'timeout' }), timeoutMs);

      const handleClose = (res) => {
        // res.isEnded / res.isEnd / res.count 等字段在不同版本略有差异
        const ended = res?.isEnded ?? res?.isEnd ?? res?.count ?? true;
        finish(ended ? { ok: true } : { ok: false, reason: 'skipped' });
      };

      try {
        if (ad.onClose) ad.onClose(handleClose);
        ad.onError?.((e) => finish({ ok: false, reason: String(e && e.errMsg || e) }));
        if (ad.load) ad.load();
        const p = ad.show?.();
        if (p && typeof p.catch === 'function') p.catch((e) => finish({ ok: false, reason: String(e) }));
      } catch (e) { finish({ ok: false, reason: String(e) }); }
    });
  },
};

Object.assign(__exports, { TAP_CONFIG: TAP_CONFIG, hasTap: hasTap, haptics: haptics, leaderboard: leaderboard, loadMeta: loadMeta, saveMeta: saveMeta, cloud: cloud, share: share, ads: ads });
};

__mods["ui.js"] = function (__exports, __req) {
// 元素回响 — 界面与交互
const { ELEMENTS, CARDS, RELICS, REACTIONS, RESONANCE, BURST, CARD_GLYPHS, ELEMENT_GLYPH } = __req("data.js");
const { createBattle, makeEnemy } = __req("engine.js");
const { newRun, makeCard, enemiesForNode, rewardCards, randomRelic, shopStock, calcScore, nodeOptions, ACTS, ENEMIES, EVENTS, gainRandomCard, saveRun, loadRun, hasRunSave, clearRun } = __req("run.js");
const { FX, AUDIO } = __req("fx.js");
const { leaderboard, cloud, share, ads, haptics, loadMeta, saveMeta, hasTap, TAP_CONFIG } = __req("tap.js");

const S = {
  screen: 'title',
  run: null,
  battle: null,
  shop: null,
  event: null,
  rewards: null,
  selected: null,
  log: [],
  modal: null,
  meta: loadMeta(),
  toast: null,
  settings: { sfx: true, music: true, haptic: true },
  phase: 'player',      // player | enemy
  banner: null,         // 回合横幅
  actingIdx: null,      // 正在行动的敌人
  combatLog: [],        // 战斗内最近动作
  tutStep: 0,           // 教学步骤
};

const app = () => document.getElementById('app');
const alive = (b) => b.enemies.filter((e) => !e.dead);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function toast(text, ms = 1400) {
  S.toast = { text, until: Date.now() + ms };
  render();
  setTimeout(() => { if (S.toast && Date.now() >= S.toast.until) { S.toast = null; render(); } }, ms + 40);
}

function flashReaction(name, text, kind) {
  const layer = document.createElement('div');
  layer.className = `reaction-flash ${kind}`;
  layer.innerHTML = `<div class="rf-name">${esc(name)}</div><div class="rf-text">${esc(text)}</div>`;
  document.body.appendChild(layer);
  setTimeout(() => layer.remove(), 1100);
  FX.shake(kind === 'burst' ? 10 : 5, kind === 'burst' ? 420 : 260);
  AUDIO.sfx(kind === 'burst' ? 'burst' : 'reaction');
  haptics.short();
}

// ---------------- 战斗反馈 ----------------
function spawnFloat(anchorEl, text, kind = 'dmg') {
  if (!anchorEl) return;
  const r = anchorEl.getBoundingClientRect();
  const el = document.createElement('div');
  el.className = `float-num ${kind}`;
  el.textContent = text;
  el.style.left = `${r.left + r.width / 2}px`;
  el.style.top = `${r.top + r.height / 2}px`;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 900);
}

// 把引擎产生的事件按节奏逐条回放，让敌人的每个动作都有可见反馈
function playEnemyEvents(events) {
  if (!events || !events.length) return;
  let delay = 80;
  for (const ev of events) {
    const at = delay;
    delay += 300;
    setTimeout(() => {
      const enemyEl = () => document.querySelector(`[data-enemy="${ev.idx}"]`);
      let msg = null;

      switch (ev.k) {
        case 'attack':
          S.actingIdx = ev.idx;
          msg = `${ev.name} 攻击 — 你受到 ${ev.amount} 伤害`;
          break;
        case 'miss':
          S.actingIdx = ev.idx;
          msg = `${ev.name} 攻击落空`;
          break;
        case 'heal':
          msg = `${ev.name} 回复 ${ev.amount} HP`;
          break;
        case 'buff':
          msg = `${ev.name} 获得「${ev.label}」`;
          break;
        case 'debuff':
          msg = `${ev.name} 施加「${ev.label}」`;
          break;
        case 'charge':
          S.actingIdx = ev.idx;
          msg = `${ev.name} 正在蓄力 ${ev.amount}！下回合重击`;
          break;
        case 'summon':
          msg = `${ev.name} 召唤了分裂体`;
          break;
        case 'burnTick':
          msg = `${ev.name} 被灼烧 ${ev.amount}`;
          break;
        default:
          msg = null;
      }

      if (msg) S.combatLog = [...S.combatLog.slice(-2), msg];
      render();

      // 浮动数字与屏幕反馈（挂到 body，不受重绘影响）
      if (ev.k === 'attack' && ev.amount > 0) {
        spawnFloat(document.querySelector('.battle-screen .tb-left .hpbar'), `-${ev.amount}`, 'dmg');
        FX.shake(6, 260); AUDIO.sfx('hurt'); haptics.short();
      } else if (ev.k === 'heal') {
        spawnFloat(enemyEl(), `+${ev.amount}`, 'heal'); AUDIO.sfx('coin');
      } else if (ev.k === 'burnTick') {
        spawnFloat(enemyEl(), `-${ev.amount}`, 'burn');
      } else if (ev.k === 'buff') {
        spawnFloat(enemyEl(), ev.label, 'buff');
      } else if (ev.k === 'charge') {
        spawnFloat(enemyEl(), `蓄力 ${ev.amount}`, 'warn'); AUDIO.sfx('reaction');
      } else if (ev.k === 'debuff') {
        AUDIO.sfx('reaction');
      }

      if (S.actingIdx != null) {
        setTimeout(() => { S.actingIdx = null; if (S.screen === 'battle') render(); }, 320);
      }
    }, at);
  }
}

// ---------------- 牌堆查看 ----------------
function openPile(kind) {
  const b = S.battle;
  if (!b) return;
  const list = kind === 'draw' ? b.drawPile : b.discard;
  const title = kind === 'draw' ? `抽牌堆（${list.length} 张）` : `弃牌堆（${list.length} 张）`;
  const order = ['fire', 'water', 'wind', 'thunder', 'earth', null];
  const sorted = [...list].sort((x, y) => order.indexOf(x.el) - order.indexOf(y.el));
  const body = list.length
    ? `<div class="pile-grid">${sorted.map((c) => cardFace(c)).join('')}</div>
       <p class="hint">抽牌堆用完时，弃牌堆会洗回抽牌堆</p>`
    : `<p class="muted" style="text-align:center;padding:18px 0">这里还是空的</p>`;
  S.modal = { title, body, scroll: true, actions: [{ label: '关闭' }] };
  render();
}

// ---------------- 元素规则 ----------------
const GLOSSARY = [
  { name: '灼烧', text: '回合开始时按层数受到伤害，可叠加、持续 2 回合' },
  { name: '致盲', text: '命中率下降，攻击有 40% 概率完全落空' },
  { name: '虚弱', text: '自身造成的伤害 -30%' },
  { name: '冻结', text: '跳过下一次行动（意图不消耗）' },
  { name: '眩晕', text: '跳过下一次行动' },
  { name: '沙暴', text: '命中率下降，且每回合受到 3 伤害' },
  { name: '护甲', text: '优先吸收伤害，回合结束清零（遗物可保留一部分）' },
  { name: '反噬', text: '打出高伤卡、或触发「过载」时自己受到的伤害' },
  { name: '蓄力', text: '敌人下回合的攻击会额外附加蓄力值' },
  { name: '反伤', text: '该敌人受到伤害时，把 50% 反弹给你' },
  { name: '熔岩', text: '战场效果：敌方回合开始时受到 4 伤害，持续 3 回合' },
  { name: '共鸣', text: '连续打出同元素 2 张时触发的小强化' },
  { name: '元素爆发', text: '连续打出同元素 3 张时触发，每场战斗每种元素 1 次' },
];

function rulesModal() {
  const rows = REACTIONS.map((r) => {
    const a = ELEMENTS[r.pair[0]];
    const c = ELEMENTS[r.pair[1]];
    return `<div class="rule-row">
      <div class="rule-head"><b style="color:${a.color}">${a.name}</b> + <b style="color:${c.color}">${c.name}</b><span class="rule-eq">→ ${r.name}</span></div>
      <div class="rule-text">${r.text}</div>
    </div>`;
  }).join('');

  const reso = Object.entries(RESONANCE)
    .map(([k, v]) => `<li><b style="color:${ELEMENTS[k].color}">${ELEMENTS[k].name}</b> 共鸣：${v.text}</li>`).join('');
  const burst = Object.entries(BURST)
    .map(([k, v]) => `<li><b style="color:${ELEMENTS[k].color}">${ELEMENTS[k].name}</b> 三连爆发：${v.text}</li>`).join('');

  S.modal = {
    title: '元素规则',
    scroll: true,
    body: `<div class="rule-section">
        <h4>一、元素反应（本回合连续打出<b>不同</b>元素）</h4>
        <p class="muted">共 10 组。顺序决定谁是「后手」，只有「过载」对顺序敏感。</p>
        ${rows}
      </div>
      <div class="rule-section">
        <h4>二、元素共鸣（连续打出<b>相同</b>元素 2 张）</h4>
        <ul class="rule-list">${reso}</ul>
      </div>
      <div class="rule-section">
        <h4>三、元素爆发（同一元素连打 3 张，每场每元素 1 次）</h4>
        <ul class="rule-list">${burst}</ul>
      </div>
      <div class="rule-section">
        <h4>四、每回合限制</h4>
        <ul class="rule-list">
          <li>能量 3 点，回合开始抽 5 张（手牌上限 7）</li>
          <li>元素反应每回合最多 <b>2 次</b>，共鸣/爆发不占次数</li>
          <li>选牌时中间提示条会告诉你这张牌接下去会触发什么</li>
        </ul>
      </div>
      <div class="rule-section">
        <h4>五、状态词条</h4>
        <div class="glossary">
          ${GLOSSARY.map((g) => `<div class="gloss-row"><b>${g.name}</b><span>${g.text}</span></div>`).join('')}
        </div>
      </div>`,
    actions: [{ label: '知道了', primary: true }],
  };
  render();
}

// ---------------- 新手教学 ----------------
const TUTORIAL = [
  {
    title: '第一步：出牌',
    body: `<p>每回合你有 <b>3 点能量</b>、<b>5 张手牌</b>。</p>
      <p>点击一张牌选中它（会抬起），再点敌人即可打出；无目标的牌再点一次自己就会生效。</p>
      <p>点右下角 <b>结束回合</b>，敌人就会行动。</p>
      <p class="muted">注意看敌人头顶的图标——那是它下回合要做的事。</p>`,
    label: '下一步',
  },
  {
    title: '第二步：元素配合才是核心',
    body: `<p>卡牌本身不强，<b>相邻打出</b>才有爆发力：</p>
      <div class="tut-block">
        <div class="tut-line"><b style="color:#3FD3A0">不同元素</b> → 触发<b>元素反应</b>（每回合最多 2 次）</div>
        <div class="muted">例：先打「火花」再打「疾风斩」→ 焚风，全体伤害 + 灼烧</div>
      </div>
      <div class="tut-block">
        <div class="tut-line"><b style="color:#FFC53D">相同元素</b> → 触发<b>元素共鸣</b>，连打 3 张触发<b>元素爆发</b></div>
        <div class="muted">例：火花 → 火花 → 火花 = 火·爆发，全体 15 伤害</div>
      </div>
      <p>选中卡牌时，中间那条提示会提前告诉你将触发什么。战斗中点右上角 <b>规则</b> 可随时查 10 组反应表。</p>`,
    label: '开始战斗',
  },
];

function showTutorial() {
  const step = TUTORIAL[S.tutStep];
  if (!step) { S.modal = null; render(); return; }
  S.modal = {
    title: step.title,
    body: step.body,
    actions: [{
      label: step.label,
      primary: true,
      act: S.tutStep < TUTORIAL.length - 1 ? 'tutNext' : 'tutDone',
    }],
  };
  render();
}

// ---------------- 通用组件 ----------------
function relicIcons(run) {
  return `<div class="relic-row">${run.relics.map((id) => {
    const r = RELICS.find((x) => x.id === id);
    return `<span class="relic" title="${esc(r ? r.text : id)}">${r ? esc(r.name[0]) : '?'}</span>`;
  }).join('')}</div>`;
}

function hpBar(cur, max, cls = '') {
  const pct = Math.max(0, Math.round((cur / max) * 100));
  return `<div class="hpbar ${cls}"><i style="width:${pct}%"></i><span>${cur}/${max}</span></div>`;
}

function cardFace(card, opts = {}) {
  const el = card.el ? ELEMENTS[card.el] : null;
  const color = el ? el.color : '#9aa4b2';
  const sel = opts.selected ? 'selected' : '';
  const disabled = opts.disabled ? 'disabled' : '';
  return `<div class="card ${sel} ${disabled}" ${opts.index != null ? `data-hand="${opts.index}"` : ''} style="--c:${color}">
    <div class="card-cost">${card.cost}</div>
    <div class="card-el">${el ? el.name : '双'}</div>
    <div class="card-name">${esc(card.name)}</div>
    <div class="card-text">${esc(card.text)}</div>
  </div>`;
}

// ---------------- 屏幕：标题 ----------------
function screenTitle() {
  const m = S.meta;
  const saved = hasRunSave();
  return `<div class="screen title-screen">
    <div class="title-glow"></div>
    <h1>元素回响</h1>
    <p class="subtitle">Elemental Echo · 卡牌肉鸽</p>
    <div class="title-stats">
      <span>最高分 ${m.bestScore}</span><span>最深层数 ${m.bestAct}</span><span>局数 ${m.runs}</span>
    </div>
    ${saved ? '<button class="btn primary big" data-act="continueRun">继续冒险</button>' : ''}
    <button class="btn ${saved ? '' : 'primary big'}" data-act="start">${saved ? '开始新的一局' : '开始冒险'}</button>
    <button class="btn" data-act="rules">元素规则（必看）</button>
    <button class="btn" data-act="rank">排行榜</button>
    <button class="btn" data-act="codex">卡牌图鉴</button>
    <button class="btn ghost" data-act="settings">设置</button>
    <p class="hint">${hasTap() ? 'TapTap 环境已就绪' : '浏览器预览模式（服务端功能已降级）'}</p>
    ${S.modal ? renderModal() : ''}
  </div>`;
}

// ---------------- 屏幕：地图 ----------------
const NODE_ICON = { battle: '⚔', elite: '💀', shop: '💰', event: '❓', rest: '🔥', treasure: '🎁', boss: '👑' };
const NODE_NAME = { battle: '战斗', elite: '精英', shop: '商店', event: '事件', rest: '休息', treasure: '宝箱', boss: 'Boss' };

function screenMap() {
  const run = S.run;
  const layers = run.map.layers;
  const conf = ACTS[run.act - 1];
  return `<div class="screen map-screen">
    <div class="topbar">
      <div class="tb-left">${hpBar(run.hp, run.maxHp)}</div>
      <div class="tb-mid">${esc(conf.name)} · 第 ${run.act} 层</div>
      <div class="tb-right"><span class="gold">🪙 ${run.gold}</span>
        <button class="icon-btn" data-act="deck">牌组</button>
        <button class="icon-btn" data-act="menu">菜单</button></div>
    </div>
    ${relicIcons(run)}
    <div class="map-path">
      ${layers.map((nodes, li) => `
        <div class="map-layer ${li === run.layer ? 'current' : ''} ${li < run.layer ? 'past' : ''}">
          ${nodes.map((n, ni) => `
            <button class="node ${n.type} ${li === run.layer ? 'selectable' : ''}" ${li === run.layer ? `data-node="${ni}"` : 'disabled'}>
              <span class="node-icon">${NODE_ICON[n.type]}</span>
              <span class="node-name">${NODE_NAME[n.type]}</span>
            </button>`).join('')}
        </div>`).join('')}
    </div>
    ${S.rewards ? renderRewardModal() : ''}
    ${S.modal ? renderModal() : ''}
  </div>`;
}

// ---------------- 屏幕：战斗 ----------------
function intentOf(e) {
  if (e.dead) return '';
  const it = e.intents[e.intentIndex % e.intents.length];
  const map = { attack: '⚔', block: '🛡', heal: '✚', burn: '🔥', charge: '⚡', reflect: '↩', summon: '✳' };
  let label = map[it.t] || '?';
  if (it.t === 'attack') label += ` ${it.v}${it.hits ? '×' + it.hits : ''}`;
  if (it.t === 'block') label += ` ${it.v}`;
  if (it.t === 'charge') label += ` ${it.v}`;
  return `<span class="intent">${label}</span>`;
}

function enemyStatuses(e) {
  const s = e.statuses;
  const out = [];
  const tag = (icon, turns, name) => out.push(`<span class="st" title="${name}：持续 ${turns} 回合">${icon}${turns}</span>`);
  if (s.burn) tag('🔥', s.burn.turns, '灼烧');
  if (s.weak) tag('💧', s.weak.turns, '虚弱');
  if (s.blind) tag('🌫', s.blind.turns, '致盲');
  if (s.freeze) tag('❄', s.freeze.turns, '冻结');
  if (s.stun) tag('💫', s.stun.turns, '眩晕');
  if (s.sand) tag('🌪', s.sand.turns, '沙暴');
  if (s.reflect) tag('↩', s.reflect.turns, '反伤');
  return out.length ? `<div class="statuses">${out.join('')}</div>` : '';
}

function previewText() {
  const b = S.battle;
  const card = S.selected != null ? b.hand[S.selected] : null;
  if (!card) return '点选卡牌，查看可触发的元素反应';
  if (!card.el) return '这张牌不携带元素';
  if (!b.lastEl) return `上一张牌：无 · 打出 ${ELEMENTS[card.el].name} 属性牌`;
  if (b.lastEl === card.el) {
    const n = b.sameChain + 1;
    return n >= 3 ? `${ELEMENTS[card.el].name} ×3 → 元素爆发！` : `${ELEMENTS[card.el].name} 共鸣（连续 ${n} 张）`;
  }
  const r = REACTIONS.find((x) => x.pair.includes(b.lastEl) && x.pair.includes(card.el));
  if (!r) return '无法触发反应';
  if (b.reactionsUsed >= b.reactionLimit) return `本回合反应次数已用尽（${b.reactionLimit}）`;
  return `✨ ${r.name}：${r.text}`;
}

function screenBattle() {
  const b = S.battle;
  const run = S.run;
  const busy = S.phase === 'enemy';
  const lastLog = S.combatLog.length ? S.combatLog[S.combatLog.length - 1] : null;
  return `<div class="screen battle-screen ${busy ? 'busy' : ''}">
    <div class="topbar">
      <div class="tb-left">${hpBar(run.hp, run.maxHp)}</div>
      <div class="tb-mid">${esc(b.enemies[0]?.name || '战斗')}</div>
      <div class="tb-right">
        <span class="armor">🛡 ${b.player.armor}</span>
        <button class="icon-btn" data-act="rules">规则</button>
        <button class="icon-btn" data-act="menu">菜单</button>
      </div>
    </div>

    <div class="enemy-row">
      ${b.enemies.map((e, i) => `
        <button class="enemy ${e.dead ? 'dead' : ''} ${S.actingIdx === i ? 'acting' : ''} ${!busy && S.selected != null && b.hand[S.selected]?.target === 'single' ? 'targetable' : ''}"
                ${e.dead || busy ? 'disabled' : ''} data-enemy="${i}">
          <div class="enemy-name">${esc(e.name)}</div>
          ${e.dead ? '<div class="dead-mark">已击败</div>' : `${intentOf(e)}${hpBar(e.hp, e.maxHp, 'small')}<div class="armor small">${e.armor > 0 ? '🛡' + e.armor : ''}</div>${enemyStatuses(e)}`}
        </button>`).join('')}
      </div>

    <div class="reaction-hint ${S.selected != null && !busy ? 'active' : ''}">${busy ? '敌方回合…' : esc(previewText())}</div>

    <div class="combat-log ${lastLog ? 'show' : ''}">${lastLog ? esc(lastLog) : ''}</div>

    <div class="player-row">
      <div class="energy">${b.energy}/${b.energyMax}</div>
      <div class="turn-info">回合 ${b.turn} · 反应 ${b.reactionsUsed}/${b.reactionLimit}</div>
      ${b.lavaTurns > 0 ? `<div class="field-tag">熔岩 ${b.lavaTurns}</div>` : ''}
      ${b.player.statuses.burn ? `<div class="field-tag" style="color:#ff8a5a">灼烧 ${b.player.statuses.burn.turns}</div>` : ''}
    </div>

    <div class="hand">
      ${b.hand.map((c, i) => cardFace(c, {
        index: i,
        selected: S.selected === i,
        disabled: busy || b.energy < c.cost,
      })).join('')}
    </div>

    <div class="bottom-bar">
      <button class="icon-btn" data-act="viewDiscard" title="查看弃牌堆">弃 ${b.discard.length}</button>
      <button class="btn primary" data-act="endTurn" ${busy ? 'disabled' : ''}>${busy ? '敌方行动中…' : '结束回合'}</button>
      <button class="icon-btn" data-act="viewDraw" title="查看抽牌堆">抽 ${b.drawPile.length}</button>
    </div>

    ${S.banner ? `<div class="turn-banner">${esc(S.banner)}</div>` : ''}
    ${S.toast ? `<div class="toast">${esc(S.toast.text)}</div>` : ''}
    ${S.modal ? renderModal() : ''}
  </div>`;
}

// ---------------- 弹窗 ----------------
function renderModal() {
  const m = S.modal;
  if (!m) return '';
  return `<div class="modal-backdrop"><div class="modal ${m.scroll ? 'wide' : ''}">
    <h3>${esc(m.title)}</h3>
    <div class="modal-body ${m.scroll ? 'scroll' : ''}">${m.body}</div>
    <div class="modal-actions">
      ${(m.actions || []).map((a, i) => `<button class="btn ${a.primary ? 'primary' : ''}" data-modal="${i}">${esc(a.label)}</button>`).join('')}
    </div>
  </div></div>`;
}

function renderRewardModal() {
  const cards = S.rewards;
  return `<div class="modal-backdrop"><div class="modal wide">
    <h3>战斗胜利 — 选择一张卡牌</h3>
    <div class="reward-cards">
      ${cards.map((c, i) => `<div class="reward-pick" data-reward="${i}">${cardFace(c)}</div>`).join('')}
    </div>
    <div class="modal-actions"><button class="btn ghost" data-act="skipReward">跳过</button></div>
  </div></div>`;
}

// ---------------- 屏幕：商店 ----------------
function screenShop() {
  const run = S.run;
  const shop = S.shop;
  return `<div class="screen shop-screen">
    <div class="topbar"><div class="tb-left">${hpBar(run.hp, run.maxHp)}</div>
      <div class="tb-mid">熔炉商店</div>
      <div class="tb-right"><span class="gold">🪙 ${run.gold}</span></div></div>
    <div class="shop-grid">
      ${shop.cards.map((s, i) => (s.sold ? '' : `<button class="shop-item" data-buy="${i}">
        ${cardFace(s.card)}<div class="price">🪙 ${s.price}</div></button>`)).join('')}
    </div>
    <h4>遗物</h4>
    <div class="shop-grid">
      ${shop.relics.map((s, i) => (s.sold ? '' : `<button class="shop-item relic-item" data-buyrelic="${i}">
        <div class="relic-name">${esc(s.relic.name)}</div>
        <div class="relic-text">${esc(s.relic.text)}</div>
        <div class="price">🪙 ${s.price}</div></button>`)).join('')}
    </div>
    <div class="shop-foot">
      <button class="btn" data-act="removeCard">移除卡牌 🪙${shop.removePrice}</button>
      <button class="btn primary" data-act="leaveNode">离开</button>
    </div>
    ${S.toast ? `<div class="toast">${esc(S.toast.text)}</div>` : ''}
    ${S.modal ? renderModal() : ''}
  </div>`;
}

// ---------------- 屏幕：休息 ----------------
function screenRest() {
  const run = S.run;
  return `<div class="screen rest-screen">
    <div class="campfire">🔥</div>
    <h2>篝火</h2>
    <p class="muted">元素在火焰中静静回响</p>
    <button class="btn primary" data-act="restHeal">休息（回复 30% HP）</button>
    <button class="btn" data-act="restRemove">冥想（移除 1 张卡）</button>
    ${S.modal ? renderModal() : ''}
  </div>`;
}

// ---------------- 屏幕：事件 ----------------
function screenEvent() {
  const ev = S.event;
  return `<div class="screen event-screen">
    <h2>${esc(ev.title)}</h2>
    <p class="event-body">${esc(ev.body)}</p>
    <div class="event-options">
      ${ev.options.map((o, i) => `<button class="btn" data-opt="${i}">${esc(o.label)}</button>`).join('')}
    </div>
    ${S.modal ? renderModal() : ''}
  </div>`;
}

// ---------------- 屏幕：结算 ----------------
function screenResult() {
  const run = S.run;
  const score = run.score ?? calcScore(run);
  const win = !run.dead;
  return `<div class="screen result-screen">
    <h1>${win ? '通关' : '冒险结束'}</h1>
    <div class="result-score">${score}</div>
    <p class="muted">结算分数</p>
    <div class="result-stats">
      <div><span>到达</span><b>第 ${run.act} 层 · ${ACT_S(run.act)}</b></div>
      <div><span>击杀</span><b>${run.kills}</b></div>
      <div><span>剩余 HP</span><b>${run.hp}</b></div>
      <div><span>使用复活</span><b>${run.revived ? '是' : '否'}</b></div>
    </div>
    <button class="btn primary" data-act="submitScore">提交到排行榜</button>
    <button class="btn" data-act="shareResult">分享本局</button>
    <button class="btn ghost" data-act="toTitle">返回标题</button>
    ${S.toast ? `<div class="toast">${esc(S.toast.text)}</div>` : ''}
    ${S.modal ? renderModal() : ''}
  </div>`;
}
function ACT_S(act) { return (ACTS[act - 1] || {}).name || ''; }

// ---------------- 屏幕：卡组 ----------------
function screenDeck() {
  const run = S.run;
  const list = run ? run.deck : [];
  return `<div class="screen deck-screen">
    <div class="topbar"><div class="tb-left"><button class="icon-btn" data-act="back">‹ 返回</button></div>
      <div class="tb-mid">卡组（${list.length}）</div><div class="tb-right"></div></div>
    <div class="deck-grid">
      ${list.map((c, i) => `<div class="deck-item" data-remove="${i}">${cardFace(c)}</div>`).join('')}
    </div>
    ${run ? `<p class="hint">剩余移除次数：${run.removals || 0}</p>` : ''}
    ${S.modal ? renderModal() : ''}
  </div>`;
}

// ---------------- 屏幕：设置 ----------------
function screenSettings() {
  return `<div class="screen settings-screen">
    <h2>设置</h2>
    <label class="row"><span>音效</span><input type="checkbox" data-set="sfx" ${S.settings.sfx ? 'checked' : ''}></label>
    <label class="row"><span>震动</span><input type="checkbox" data-set="haptic" ${S.settings.haptic ? 'checked' : ''}></label>
    ${S.run ? '<label class="row"><span>当前进度</span><button class="icon-btn" data-act="saveQuit">保存并回主界面</button></label>' : ''}
    <p class="hint">广告位 ${TAP_CONFIG.adSpaceId ? '已配置' : '未配置（需先开通广告）'} · 排行榜 ${TAP_CONFIG.leaderboardId ? '已配置' : '未配置'}</p>
    <button class="btn primary" data-act="back">返回</button>
    ${S.modal ? renderModal() : ''}
  </div>`;
}

// ---------------- 卡牌图鉴（未遇见只显示图案） ----------------
const RARITY_DOTS = { common: '●', rare: '●●', epic: '●●●', legend: '★★★★' };

function cardGlyph(card) {
  if (card && CARD_GLYPHS[card.id]) return CARD_GLYPHS[card.id];
  if (card && card.el && ELEMENT_GLYPH[card.el]) return ELEMENT_GLYPH[card.el];
  return '❖';
}

function codexCardHTML(card) {
  const el = card.el ? ELEMENTS[card.el] : null;
  const color = el ? el.color : '#9aa4b2';
  const seen = new Set(S.meta.cardSeen || []).has(card.id);
  const glyph = cardGlyph(card);
  const dots = RARITY_DOTS[card.rarity] || '●';

  if (!seen) {
    return `<div class="cx-card locked" style="--c:${color}">
      <div class="cx-cost">${card.cost}</div>
      <div class="cx-glyph">${glyph}</div>
      <div class="cx-name">？？？</div>
      <div class="cx-text">尚未遇见<br>在战斗奖励、商店或牌组中见到后解锁</div>
      <div class="cx-rarity">${dots}</div>
    </div>`;
  }
  return `<div class="cx-card" style="--c:${color}">
    <div class="cx-cost">${card.cost}</div>
    <div class="cx-glyph">${glyph}</div>
    <div class="cx-name">${esc(card.name)}</div>
    <div class="cx-text">${esc(card.text)}</div>
    <div class="cx-rarity">${dots}</div>
  </div>`;
}

function screenCodex() {
  const all = Object.values(CARDS);
  const order = ['fire', 'water', 'wind', 'thunder', 'earth', null];
  const sorted = [...all].sort((a, b) => order.indexOf(a.el) - order.indexOf(b.el) || a.cost - b.cost);
  const seen = new Set(S.meta.cardSeen || []);
  const unlocked = sorted.filter((c) => seen.has(c.id)).length;
  return `<div class="screen codex-screen">
    <div class="topbar">
      <div class="tb-left"><button class="icon-btn" data-act="back">‹ 返回</button></div>
      <div class="tb-mid">卡牌图鉴 ${unlocked}/${sorted.length}</div>
      <div class="tb-right"></div>
    </div>
    <div class="codex-grid">
      ${sorted.map((c) => codexCardHTML(c)).join('')}
    </div>
    <p class="hint">图鉴初始只有图案，卡牌在战斗奖励 / 商店 / 牌组中真实出现过才会解锁具体效果</p>
    ${S.modal ? renderModal() : ''}
  </div>`;
}

// 记录"已遇见"的卡牌
function markSeen(cards) {
  const seen = new Set(S.meta.cardSeen || []);
  let added = 0;
  for (const c of cards || []) {
    const id = typeof c === 'string' ? c : (c && c.id);
    if (!id) continue;
    if (!seen.has(id)) { seen.add(id); added += 1; }
  }
  if (added > 0) {
    S.meta.cardSeen = [...seen];
    saveMeta(S.meta);
  }
  return added;
}

// ---------------- 渲染 ----------------
function render() {
  const map = {
    title: screenTitle, map: screenMap, battle: screenBattle, shop: screenShop,
    rest: screenRest, event: screenEvent, result: screenResult, deck: screenDeck,
    codex: screenCodex, settings: screenSettings,
  };
  const fn = map[S.screen] || screenTitle;
  app().innerHTML = fn();
  bind();
}

// ---------------- 流程 ----------------
function startRun() {
  S.run = newRun();
  markSeen(S.run.deck);
  saveRun(S.run);
  S.screen = 'map';
  S.rewards = null;
  S.modal = null;
  S.returnTo = null;
  toast('新的冒险开始了', 1200);
  render();
}

function enterNode(nodeIdx) {
  const run = S.run;
  const node = run.map.layers[run.layer][nodeIdx];
  if (!node) return;
  run.choosing = nodeIdx;
  switch (node.type) {
    case 'battle': case 'elite': case 'boss': {
      const spec = enemiesForNode(run, node);
      const enemies = [];
      spec.forEach((s) => {
        for (let i = 0; i < s.count; i++) {
          const e = makeEnemy(s.id, 1 + (run.act - 1) * 0.1);
          if (spec.length > 1 || s.count > 1) e.name = `${e.name}${['A', 'B', 'C'][i]}`;
          enemies.push(e);
        }
      });
      S.battle = createBattle({
        enemies, deck: run.deck.map((c) => c), hp: run.hp, maxHp: run.maxHp,
        relics: run.relics, onLog: (msg, kind) => { S.log.push({ msg, kind }); },
      });
      S.selected = null;
      S.phase = 'player';
      S.actingIdx = null;
      S.banner = null;
      S.combatLog = [];
      S.screen = 'battle';
      AUDIO.sfx('play');
      if (!S.meta.tutorialDone) { S.tutStep = 0; showTutorial(); }
      else render();
      break;
    }
    case 'shop': S.shop = shopStock(run); markSeen(S.shop.cards.map((s) => s.card)); S.screen = 'shop'; render(); break;
    case 'rest': S.screen = 'rest'; render(); break;
    case 'event': S.event = EVENTS[Math.floor(Math.random() * EVENTS.length)]; S.screen = 'event'; render(); break;
    case 'treasure': {
      const r = randomRelic(run);
      run.gold += 30;
      toast(r ? `获得遗物：${r.name} 与 30 金币` : '获得 30 金币');
      finishNode();
      break;
    }
    default: finishNode();
  }
}

function finishNode() {
  const run = S.run;
  run.layer += 1;
  run.choosing = 0;
  if (run.layer >= run.map.layers.length) {
    if (run.act >= 3) { endRun(false); return; }
    run.act += 1;
    run.layer = 0;
    run.map = { act: run.act, conf: ACTS[run.act - 1], layers: (function gen() {
      const conf = ACTS[run.act - 1];
      const out = [];
      for (let i = 0; i < conf.layers; i++) {
        const width = i === 0 || i === conf.layers - 1 ? 1 : (Math.random() < 0.5 ? 2 : 3);
        const nodes = [];
        for (let j = 0; j < width; j++) {
          let type;
          if (i === conf.layers - 1) type = 'boss';
          else if (i === 0) type = 'battle';
          else {
            const r = Math.random();
            type = r < 0.42 ? 'battle' : r < 0.55 ? 'elite' : r < 0.66 ? 'shop' : r < 0.80 ? 'event' : r < 0.92 ? 'rest' : 'treasure';
          }
          nodes.push({ type, cleared: false });
        }
        out.push(nodes);
      }
      return out;
    })() };
    toast(`进入第 ${run.act} 层：${ACTS[run.act - 1].name}`, 1600);
  }
  saveRun(run);
  S.screen = 'map';
  render();
}

function onBattleVictory() {
  const run = S.run;
  const b = S.battle;
  run.hp = b.player.hp;
  run.kills += b.enemies.filter((e) => e.dead).length;
  run.gold += 15 + Math.floor(Math.random() * 11) + (b.enemies.some((e) => e.boss) ? 60 : 0);
  AUDIO.sfx('win');
  S.rewards = rewardCards(run, 3);
  markSeen(S.rewards);
  S.battle = null;
  S.screen = 'map';
  render();
}

function onBattleDefeat() {
  const run = S.run;
  run.hp = 0;
  // 复活广告位
  if (!run.usedReviveAd) {
    S.modal = {
      title: '你的元素尚未熄灭',
      body: `<p>HP 归零，但元素还在回响。</p><p class="muted">观看一段广告可恢复 50% 生命继续冒险（每局 1 次）。</p>`,
      actions: [
        { label: '观看广告复活', primary: true, act: 'reviveAd' },
        { label: '就此结束', act: 'giveUp' },
      ],
    };
    render();
    return;
  }
  endRun(true);
}

function endRun(dead) {
  const run = S.run;
  run.dead = dead;
  run.score = calcScore(run);
  S.battle = null;
  S.rewards = null;
  S.modal = null;
  S.screen = 'result';
  S.meta.runs += 1;
  S.meta.kills += run.kills;
  if (run.score > S.meta.bestScore) S.meta.bestScore = run.score;
  S.meta.bestAct = Math.max(S.meta.bestAct, run.act);
  saveMeta(S.meta);
  cloud.save(S.meta);
  clearRun();
  AUDIO.sfx(dead ? 'lose' : 'win');
  render();
}

// ---------------- 事件绑定 ----------------
function bind() {
  const root = app();

  root.querySelectorAll('[data-act]').forEach((el) => {
    el.addEventListener('click', () => onAct(el.dataset.act, el));
  });
  root.querySelectorAll('[data-node]').forEach((el) => {
    el.addEventListener('click', () => { enterNode(Number(el.dataset.node)); });
  });
  root.querySelectorAll('[data-hand]').forEach((el) => {
    el.addEventListener('click', () => onCardClick(Number(el.dataset.hand)));
  });
  root.querySelectorAll('[data-enemy]').forEach((el) => {
    el.addEventListener('click', () => onEnemyClick(Number(el.dataset.enemy)));
  });
  root.querySelectorAll('[data-reward]').forEach((el) => {
    el.addEventListener('click', () => {
      const c = S.rewards[Number(el.dataset.reward)];
      markSeen([c]);
      S.run.deck.push(makeCard(c.id));
      S.rewards = null;
      AUDIO.sfx('coin');
      finishNode();
    });
  });
  root.querySelectorAll('[data-buy]').forEach((el) => {
    el.addEventListener('click', () => buyCard(Number(el.dataset.buy)));
  });
  root.querySelectorAll('[data-buyrelic]').forEach((el) => {
    el.addEventListener('click', () => buyRelic(Number(el.dataset.buyrelic)));
  });
  root.querySelectorAll('[data-opt]').forEach((el) => {
    el.addEventListener('click', () => {
      const opt = S.event.options[Number(el.dataset.opt)];
      const msg = opt.apply(wrapRun());
      toast(msg || '...', 1600);
      AUDIO.sfx('coin');
      finishNode();
    });
  });
  root.querySelectorAll('[data-modal]').forEach((el) => {
    el.addEventListener('click', () => {
      const a = S.modal.actions[Number(el.dataset.modal)];
      S.modal = null;
      if (a.act) onAct(a.act);
      else render();
    });
  });
  root.querySelectorAll('[data-set]').forEach((el) => {
    el.addEventListener('change', () => {
      S.settings[el.dataset.set] = el.checked;
      if (el.dataset.set === 'sfx') AUDIO.setEnabled(el.checked);
    });
  });
  root.querySelectorAll('[data-remove]').forEach((el) => {
    el.addEventListener('click', () => removeCardAt(Number(el.dataset.remove)));
  });

  // 点击弹窗外的遮罩关闭
  const backdrop = root.querySelector('.modal-backdrop');
  if (backdrop) {
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) { S.modal = null; render(); }
    });
  }
}

// 给事件里的 run 补上可用的辅助方法
function wrapRun() {
  const run = S.run;
  return {
    ...run,
    get hp() { return S.run.hp; }, set hp(v) { S.run.hp = v; },
    get gold() { return S.run.gold; }, set gold(v) { S.run.gold = v; },
    get removals() { return S.run.removals || 0; }, set removals(v) { S.run.removals = v; },
    heal(n) { S.run.hp = Math.min(S.run.maxHp, S.run.hp + n); },
    gainRandomCard(rarity) { S.run.deck.push(gainRandomCard(rarity)); },
    gainCard(id) { S.run.deck.push(makeCard(id)); },
    gainRandomRelic() { return randomRelic(S.run); },
  };
}

function onCardClick(index) {
  const b = S.battle;
  if (!b) return;
  const card = b.hand[index];
  if (!card) return;
  AUDIO.sfx('click');
  if (S.selected === index) {
    // 再次点击 = 直接打出（非单体卡直接生效，单体卡打到第一个存活敌人）
    playSelected(0);
    return;
  }
  if (b.energy < card.cost) { AUDIO.sfx('error'); toast('能量不足'); return; }
  S.selected = index;
  render();
}

function onEnemyClick(index) {
  const b = S.battle;
  if (!b || S.selected == null) return;
  const card = b.hand[S.selected];
  if (!card) return;
  if (card.target === 'single') playSelected(index);
  else playSelected(index);
}

function playSelected(targetIdx) {
  const b = S.battle;
  if (!b || S.selected == null) return;
  const before = b.player.hp;
  const target = b.enemies[targetIdx] && !b.enemies[targetIdx].dead
    ? targetIdx
    : b.enemies.findIndex((e) => !e.dead);
  const idx = S.selected;
  S.selected = null;
  const res = b.playCard(idx, Math.max(0, target));
  if (!res) { AUDIO.sfx('error'); render(); return; }
  AUDIO.sfx('play');

  const chain = res.chain;
  if (chain) {
    const kind = chain.kind;
    if (kind === 'reaction') flashReaction(chain.name, chain.text, 'reaction');
    else if (kind === 'burst') flashReaction(chain.name, chain.text, 'burst');
    else if (kind === 'resonance') flashReaction(chain.name, chain.text, 'resonance');
  }

  // 敌人受击特效
  b.enemies.forEach((e, i) => {
    if (!e.dead) {
      const el = document.querySelector(`[data-enemy="${i}"]`);
      if (res.card.el) FX.burstEl(el, ELEMENTS[res.card.el]?.color || '#fff', 18);
    }
  });

  if (b.player.hp !== before) AUDIO.sfx('hurt');
  if (b.player.hp <= 0) { onBattleDefeat(); return; }
  if (b.enemies.every((e) => e.dead)) { onBattleVictory(); return; }
  render();
}

function openGameMenu() {
  const inBattle = S.screen === 'battle';
  S.modal = {
    title: inBattle ? '暂停' : '菜单',
    body: inBattle
      ? '<p class="muted">战斗内的操作进度不会被保存——保存后从「上一次进入节点前」继续。</p>'
      : '<p class="muted">进度会保存到本地，下次可从主界面「继续冒险」接着玩。</p>',
    actions: [
      { label: '继续游戏', primary: true, act: 'pauseResume' },
      { label: '元素规则', act: 'pauseRules' },
      { label: '设置', act: 'pauseSettings' },
      { label: '保存并回主界面', act: 'saveQuit' },
      { label: '放弃本局', act: 'abandon' },
    ],
  };
  render();
}

function onAct(act) {
  const b = S.battle;
  switch (act) {
    case 'start': startRun(); break;
    case 'continueRun': {
      const run = loadRun();
      if (!run) { toast('没有可继续的存档'); clearRun(); break; }
      S.run = run;
      S.battle = null;
      S.modal = null;
      S.rewards = null;
      S.screen = 'map';
      toast(`继续冒险：第 ${run.act} 层 · ${(ACTS[run.act - 1] || {}).name || ''}`, 1600);
      break;
    }
    case 'back': {
      // 返回到"进入前的界面"，而不是一律回地图
      S.modal = null;
      S.screen = S.returnTo || (S.run ? 'map' : 'title');
      S.returnTo = null;
      render();
      break;
    }
    case 'deck': S.returnTo = S.returnTo || S.screen; S.modal = null; S.screen = 'deck'; render(); break;
    case 'codex': S.returnTo = S.returnTo || S.screen; S.modal = null; S.screen = 'codex'; render(); break;
    case 'settings': S.returnTo = S.returnTo || S.screen; S.modal = null; S.screen = 'settings'; render(); break;
    case 'menu': openGameMenu(); break;
    case 'pauseResume': S.modal = null; render(); break;
    case 'pauseRules': rulesModal(); break;
    case 'pauseSettings': S.returnTo = S.screen; S.modal = null; S.screen = 'settings'; render(); break;
    case 'saveQuit': {
      if (S.run) saveRun(S.run);
      S.modal = null;
      S.battle = null;
      S.run = null;
      S.returnTo = null;
      S.screen = 'title';
      toast('进度已保存', 1400);
      break;
    }
    case 'abandon': {
      S.modal = {
        title: '放弃本局？',
        body: '<p>当前进度会丢失，元进程（最高分等）不受影响。</p>',
        actions: [
          { label: '继续游戏', primary: true },
          { label: '确认放弃', act: 'abandonConfirm' },
        ],
      };
      render();
      break;
    }
    case 'abandonConfirm': {
      clearRun();
      S.modal = null;
      S.battle = null;
      S.run = null;
      S.returnTo = null;
      S.screen = 'title';
      render();
      break;
    }
    case 'rank':
      leaderboard.open().then((r) => {
        if (!r.ok) toast(r.reason === 'unavailable' ? '排行榜未配置（需先创建并填入 leaderboardId）' : '打开失败：' + r.reason, 2200);
      });
      break;
    case 'endTurn': {
      if (!b || S.phase === 'enemy') break;
      // 阶段一：敌方回合提示，让玩家看清"轮到谁"
      S.phase = 'enemy';
      S.selected = null;
      S.banner = '敌方回合';
      S.combatLog = [];
      render();
      setTimeout(() => {
        S.banner = null;
        b.endPlayerTurn();
        S.phase = 'player';
        const events = b.events.slice();
        b.events = [];
        if (b.over) {
          b.victory ? onBattleVictory() : onBattleDefeat();
          return;
        }
        render();
        playEnemyEvents(events);
      }, 620);
      break;
    }
    case 'viewDraw': openPile('draw'); break;
    case 'viewDiscard': openPile('discard'); break;
    case 'rules': rulesModal(); break;
    case 'tutNext': S.tutStep += 1; showTutorial(); break;
    case 'tutDone':
      S.tutStep = 0;
      S.modal = null;
      S.meta.tutorialDone = true;
      saveMeta(S.meta);
      render();
      break;
    case 'skipReward': S.rewards = null; finishNode(); break;
    case 'leaveNode': finishNode(); break;
    case 'restHeal': {
      S.run.hp = Math.min(S.run.maxHp, S.run.hp + Math.round(S.run.maxHp * 0.3));
      toast('你恢复了生命');
      finishNode();
      break;
    }
    case 'restRemove': {
      S.run.removals = (S.run.removals || 0) + 1;
      S.deckContext = 'node';
      S.screen = 'deck';
      toast('点击一张卡牌将其移除');
      render();
      break;
    }
    case 'removeCard': {
      const price = (S.shop && S.shop.removePrice) || 60;
      if (S.run.gold < price) { AUDIO.sfx('error'); toast('金币不足'); break; }
      S.run.gold -= price;
      S.run.removals = (S.run.removals || 0) + 1;
      S.deckContext = 'node';
      S.modal = null;
      S.screen = 'deck';
      toast('点击一张卡牌移除');
      render();
      break;
    }
    case 'toTitle': S.screen = 'title'; S.run = null; S.battle = null; render(); break;
    case 'submitScore': {
      leaderboard.submit(S.run.score).then((r) => {
        toast(r.ok ? '已提交到排行榜' : (r.reason === 'unavailable' ? '排行榜未配置' : '提交失败：' + r.reason), 2000);
      });
      break;
    }
    case 'shareResult':
      share.show().then((r) => { if (!r.ok) toast('分享未配置，需先创建分享模板', 2000); });
      break;
    case 'reviveAd': {
      ads.showRewarded().then((r) => {
        if (r.ok) {
          S.run.revived = true;
          S.run.usedReviveAd = true;
          S.run.hp = Math.round(S.run.maxHp * 0.5);
          S.battle = null;
          S.screen = 'map';
          toast('元素重燃 — 恢复 50% 生命');
          haptics.long();
          render();
        } else {
          toast('广告未完成（' + (r.reason || 'skip') + '），本局结束', 1800);
          S.run.usedReviveAd = true;
          endRun(true);
        }
      });
      break;
    }
    case 'giveUp': S.run.usedReviveAd = true; endRun(true); break;
    default: break;
  }
}

function buyCard(i) {
  const s = S.shop.cards[i];
  if (!s || s.sold) return;
  if (S.run.gold < s.price) { AUDIO.sfx('error'); toast('金币不足'); return; }
  S.run.gold -= s.price;
  S.run.deck.push(s.card);
  s.sold = true;
  AUDIO.sfx('coin');
  render();
}

function buyRelic(i) {
  const s = S.shop.relics[i];
  if (!s || s.sold) return;
  if (S.run.gold < s.price) { AUDIO.sfx('error'); toast('金币不足'); return; }
  S.run.gold -= s.price;
  S.run.relics.push(s.relic.id);
  s.sold = true;
  AUDIO.sfx('coin');
  render();
}

function removeCardAt(index) {
  const run = S.run;
  const inBattleDeck = S.screen === 'battle';
  if (inBattleDeck) return;
  if (!run.deck[index]) return;
  if ((run.removals || 0) <= 0) { toast('没有移除次数'); return; }
  run.removals -= 1;
  run.deck.splice(index, 1);
  AUDIO.sfx('click');
  toast('卡牌已移除');
  if (S.shop) { S.shop.removeUsed = true; }
  if (S.deckContext === 'node') {
    S.deckContext = null;
    finishNode();
    return;
  }
  render();
}

function boot() {
  S.meta = loadMeta();
  FX.init(document.getElementById('fx'));
  render();
}

Object.assign(__exports, { S: S, openPile: openPile, rulesModal: rulesModal, showTutorial: showTutorial, screenCodex: screenCodex, markSeen: markSeen, render: render, openGameMenu: openGameMenu, boot: boot });
};

__mods["main.js"] = function (__exports, __req) {
// 元素回响 — 启动
const { boot, S, render } = __req("ui.js");
const { AUDIO } = __req("fx.js");
const { cloud, saveMeta, hasTap } = __req("tap.js");

function unlockAudioOnce() {
  AUDIO.unlock();
  window.removeEventListener('pointerdown', unlockAudioOnce);
  window.removeEventListener('keydown', unlockAudioOnce);
}
window.addEventListener('pointerdown', unlockAudioOnce);
window.addEventListener('keydown', unlockAudioOnce);

// 启动后尝试用云存档覆盖本地元进程（仅当云端更优）
(async function start() {
  boot();
  if (!hasTap()) return;
  try {
    const remote = await cloud.load();
    if (remote && typeof remote.bestScore === 'number') {
      if (remote.bestScore > S.meta.bestScore || remote.runs > S.meta.runs) {
        saveMeta(remote);
        S.meta = remote;
        render();
      }
    }
  } catch { /* 云存档不可用时静默降级 */ }
})();

// 防止移动端双击缩放
document.addEventListener('dblclick', (e) => e.preventDefault(), { passive: false });

};
__req('main.js');
})();