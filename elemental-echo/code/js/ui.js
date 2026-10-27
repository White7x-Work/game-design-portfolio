// 元素回响 — 界面与交互
import { ELEMENTS, CARDS, RELICS, REACTIONS, RESONANCE, BURST, CARD_GLYPHS, ELEMENT_GLYPH } from './data.js';
import { createBattle, makeEnemy } from './engine.js';
import { newRun, makeCard, enemiesForNode, rewardCards, randomRelic, shopStock, calcScore, nodeOptions, ACTS, ENEMIES, EVENTS, gainRandomCard, saveRun, loadRun, hasRunSave, clearRun } from './run.js';
import { FX, AUDIO } from './fx.js';
import { leaderboard, cloud, share, ads, haptics, loadMeta, saveMeta, hasTap, TAP_CONFIG } from './tap.js';

export const S = {
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
export function openPile(kind) {
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

export function rulesModal() {
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

export function showTutorial() {
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

export function screenCodex() {
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
export function markSeen(cards) {
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
export function render() {
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

export function openGameMenu() {
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

export function boot() {
  S.meta = loadMeta();
  FX.init(document.getElementById('fx'));
  render();
}
