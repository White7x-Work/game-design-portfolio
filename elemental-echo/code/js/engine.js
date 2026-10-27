// 元素回响 — 战斗引擎（纯逻辑，不含 DOM）
import { CARDS, REACTIONS, RESONANCE, BURST, ENEMIES } from './data.js';

const rand = (n) => Math.floor(Math.random() * n);

export function shuffle(a) {
  const arr = [...a];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = rand(i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function makeEnemy(id, hpScale = 1) {
  const proto = ENEMIES[id];
  const hp = Math.round(proto.hp * hpScale);
  return {
    id: proto.id, name: proto.name, hp, maxHp: hp, armor: 0,
    statuses: {}, intentIndex: 0, intents: proto.intents,
    boss: !!proto.boss, elite: !!proto.elite, charging: 0, dead: false,
  };
}

export function createBattle({ enemies, deck, hp, maxHp, relics = [], onLog }) {
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
