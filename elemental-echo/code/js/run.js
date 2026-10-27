// 元素回响 — 单局流程（地图、奖励、商店、计分）
import { CARDS, STARTER_DECK, RELICS, ENEMIES, EVENTS } from './data.js';

const rand = (n) => Math.floor(Math.random() * n);
const pick = (arr) => arr[rand(arr.length)];

let uid = 0;
export function makeCard(id) {
  const proto = CARDS[id];
  if (!proto) throw new Error('unknown card: ' + id);
  return { ...proto, uid: ++uid };
}

export const ACTS = [
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

export function newRun(character = 'fire') {
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

export function generateMap(act) {
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

export function currentNode(run) {
  const layer = run.map.layers[run.layer];
  return layer ? layer[run.choosing ?? 0] : null;
}

export function nodeOptions(run) {
  return run.map.layers[run.layer] || [];
}

// 根据节点类型生成敌人
export function enemiesForNode(run, node) {
  const conf = ACTS[run.act - 1];
  const scale = 1 + (run.act - 1) * 0.15;
  if (node.type === 'boss') return [{ id: conf.boss, count: 1 }];
  if (node.type === 'elite') return [{ id: pick(conf.elite), count: Math.random() < 0.4 ? 2 : 1 }];
  const count = Math.random() < 0.55 ? 1 : (Math.random() < 0.8 ? 2 : 3);
  const out = [];
  for (let i = 0; i < count; i++) out.push({ id: pick(conf.pool), count: 1 });
  return out;
}

export function rewardCards(run, n = 3) {
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

export function gainRandomCard(rarity) {
  const all = Object.values(CARDS);
  const pool = rarity ? all.filter((c) => c.rarity === rarity) : all;
  return makeCard(pick(pool).id);
}

export function randomRelic(run) {
  const owned = new Set(run.relics);
  const avail = RELICS.filter((r) => !owned.has(r.id));
  if (!avail.length) return null;
  const r = pick(avail);
  run.relics.push(r.id);
  return r;
}

export function shopStock(run) {
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

export function calcScore(run) {
  const floorBonus = run.act * 3 + run.layer;
  const base = floorBonus * 1000 + run.kills * 50 + Math.max(0, run.hp) * 10 + run.gold * 2;
  return Math.round(base * (run.revived ? 0.9 : 1));
}

export function pickEvent(run) {
  return pick(EVENTS);
}

export { EVENTS, RELICS, CARDS, ENEMIES };

// ---------------- 单局存档（支持保存后回主界面、下次继续） ----------------
const RUN_KEY = 'elemental-echo:run';

export function serializeRun(run) {
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

export function deserializeRun(data) {
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

export function saveRun(run) {
  try { localStorage.setItem(RUN_KEY, JSON.stringify(serializeRun(run))); return true; }
  catch { return false; }
}

export function loadRun() {
  try {
    const raw = localStorage.getItem(RUN_KEY);
    if (!raw) return null;
    return deserializeRun(JSON.parse(raw));
  } catch { return null; }
}

export function hasRunSave() {
  try { return Boolean(localStorage.getItem(RUN_KEY)); } catch { return false; }
}

export function clearRun() {
  try { localStorage.removeItem(RUN_KEY); } catch { /* 忽略 */ }
}
