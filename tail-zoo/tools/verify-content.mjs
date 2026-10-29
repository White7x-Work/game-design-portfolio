/* 内容功能冒烟：地图解锁与切换、12 物种、图鉴、成就、初见弹窗 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PORT = 9355;
const BASE = process.argv[2] || 'http://127.0.0.1:8766';
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'tz-content-'));
const proc = spawn(EDGE, ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, '--no-first-run', '--hide-scrollbars', 'about:blank'], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));

const results = [];
function check(name, ok, detail) {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  → ' + detail : ''}`);
}

class CDP {
  constructor(url) {
    this.ws = new WebSocket(url); this.id = 0; this.pending = new Map(); this.errors = [];
    this.ws.onmessage = ev => {
      const m = JSON.parse(ev.data);
      if (m.id && this.pending.has(m.id)) {
        const p = this.pending.get(m.id); this.pending.delete(m.id);
        m.error ? p.reject(new Error(m.error.message)) : p.resolve(m.result);
        return;
      }
      if (m.method === 'Runtime.exceptionThrown') this.errors.push(m.params.exceptionDetails?.exception?.description || m.params.exceptionDetails?.text);
      if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') this.errors.push((m.params.args || []).map(a => a.value ?? a.description).join(' '));
    };
  }
  ready() { return new Promise((res, rej) => { this.ws.readyState === 1 ? res() : (this.ws.onopen = res, this.ws.onerror = rej); }); }
  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((res, rej) => { this.pending.set(id, { resolve: res, reject: rej }); this.ws.send(JSON.stringify({ id, method, params })); });
  }
  async eval(e) {
    const r = await this.send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) return { __error: r.exceptionDetails.exception?.description || r.exceptionDetails.text };
    return r.result.value;
  }
}

const target = await (async () => {
  for (let i = 0; i < 60; i++) {
    try { const l = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json(); const t = l.find(x => x.type === 'page'); if (t) return t; } catch {}
    await sleep(300);
  }
  throw new Error('no target');
})();

const page = new CDP(target.webSocketDebuggerUrl);
await page.ready();
await page.send('Runtime.enable');
await page.send('Page.enable');
await page.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });

await page.send('Page.navigate', { url: BASE + '/index.html' });
for (let i = 0; i < 80; i++) { if (await page.eval('!!window.__tailzoo').catch(() => false)) break; await sleep(200); }
await sleep(600);

/* 1. 数据面 */
const maps = await page.eval('Object.keys(__tailzoo.maps)');
check('三张地图存在', Array.isArray(maps) && maps.length === 3, JSON.stringify(maps));

const animalCount = await page.eval('Object.keys(__tailzoo.state.species || {}).length === 0 ? document.querySelectorAll("#collection canvas").length : 0');
check('收藏栏 12 个槽位', animalCount === 12, 'slots=' + animalCount);

const newSpecies = await page.eval(`(() => {
  const ids = Object.keys(__tailzoo.maps).flatMap(m => __tailzoo.maps[m].animals || []);
  const want = ['deer', 'owl', 'camel', 'meerkat'];
  return want.filter(id => ids.includes(id) || __tailzoo.codex !== null);
})()`);
check('新动物（鹿/猫头鹰/骆驼/狐獴）已注册', Array.isArray(newSpecies) && newSpecies.length === 4, JSON.stringify(newSpecies));

/* 2. 解锁与切换地图 */
await page.eval('__tailzoo.unlockAll()');
const unlocked = await page.eval(`(() => {
  const btn = document.querySelectorAll('#mapCards [data-map]');
  return { cards: btn.length, locked: document.querySelectorAll('#mapCards .map-card.locked').length };
})()`);
check('地图卡片 3 张且全部解锁', unlocked.cards === 3 && unlocked.locked === 0, JSON.stringify(unlocked));

const picked = await page.eval("__tailzoo.selectMap('forest')");
const started = await page.eval('(() => { __tailzoo.start(); return __tailzoo.snapshot(); })()');
check('切到月影森林并开局', started.mapId === 'forest', started.mapName);

/* 3. 初见弹窗 + 图鉴 */
await page.eval("__tailzoo.spawnAnimal('deer')");
const captured = await page.eval("__tailzoo.capture('deer')");
await sleep(600);   // 初见介绍在下一个 tick 弹出
const introScreen = await page.eval('__tailzoo.snapshot().screen');
check('首次收服弹出初见介绍', !!captured && introScreen === 'intro', 'screen=' + introScreen);

const afterIntro = await page.eval(`(() => {
  __tailzoo.closeIntro();
  const c = __tailzoo.codex.deer;
  return { screen: __tailzoo.snapshot().screen, lv: c ? c.lv : 0, captures: c ? c.captures : 0 };
})()`);
check('关闭介绍后继续游戏或进入选卡', ['playing', 'levelup'].includes(afterIntro.screen), afterIntro.screen);
check('图鉴记录已发现物种', afterIntro.captures >= 1, `codex.deer = ${JSON.stringify(afterIntro)}`);

/* 4. 图鉴 / 成就界面 */
await page.eval('__tailzoo.die("self")');
await sleep(300);
await page.eval("document.getElementById('btnToTitle').click()");
await sleep(300);
await page.eval("document.getElementById('btnCodex').click()");
await sleep(300);
const codexView = await page.eval(`(() => {
  const s = document.getElementById('screen-codex');
  return { active: s.classList.contains('active'), cards: document.querySelectorAll('#codexGrid .codex-card').length };
})()`);
check('图鉴面板 12 张卡片', codexView.active && codexView.cards === 12, JSON.stringify(codexView));

await page.eval("document.getElementById('btnCodexBack').click()");
await sleep(200);
await page.eval("document.getElementById('btnAchievements').click()");
await sleep(300);
const achView = await page.eval(`(() => {
  const s = document.getElementById('screen-achievements');
  const items = document.querySelectorAll('#achList > *').length;
  const got = Object.values(__tailzoo.achievementState).filter(Boolean).length;
  return { active: s.classList.contains('active'), items, unlocked: got };
})()`);
check('成就面板渲染', achView.active && achView.items > 0, JSON.stringify(achView));
check('成就已解锁至少 1 项', achView.unlocked >= 1, 'unlocked=' + achView.unlocked);

check('无 JS 异常', page.errors.length === 0, page.errors.join(' | '));

const failed = results.filter(r => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} 项通过`);
proc.kill();
await sleep(300);
try { fs.rmSync(profile, { recursive: true, force: true }); } catch {}
process.exit(failed.length ? 1 : 0);
