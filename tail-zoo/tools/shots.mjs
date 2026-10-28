/* 截图 + 布局检查：标题页 / 结算页（含广告复活与排行榜按钮），窄屏是否溢出 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PORT = 9341;
const OUT = 'D:\\DSH\\MONEY\\tail-zoo\\screenshots';
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'tz-shot-'));
fs.mkdirSync(OUT, { recursive: true });
const proc = spawn(EDGE, ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, '--no-first-run', '--hide-scrollbars', 'about:blank'], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));

class CDP {
  constructor(url) {
    this.ws = new WebSocket(url); this.id = 0; this.pending = new Map();
    this.ws.onmessage = ev => {
      const m = JSON.parse(ev.data);
      if (m.id && this.pending.has(m.id)) {
        const p = this.pending.get(m.id); this.pending.delete(m.id);
        m.error ? p.reject(new Error(m.error.message)) : p.resolve(m.result);
      }
    };
  }
  ready() { return new Promise((res, rej) => { this.ws.readyState === 1 ? res() : (this.ws.onopen = res, this.ws.onerror = rej); }); }
  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((res, rej) => { this.pending.set(id, { resolve: res, reject: rej }); this.ws.send(JSON.stringify({ id, method, params })); });
  }
  async eval(e) {
    const r = await this.send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
    return r.result.value;
  }
  async shot(file) {
    const r = await this.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(OUT, file), Buffer.from(r.data, 'base64'));
  }
}

const target = await (async () => {
  for (let i = 0; i < 50; i++) {
    try { const l = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json(); const t = l.find(x => x.type === 'page'); if (t) return t; } catch {}
    await sleep(300);
  }
  throw new Error('no target');
})();

const page = new CDP(target.webSocketDebuggerUrl);
await page.ready();
await page.send('Runtime.enable');
await page.send('Page.enable');

const sizes = [
  { name: '390x844', w: 390, h: 844, dpr: 3 },
  { name: '360x640', w: 360, h: 640, dpr: 2 }
];

for (const s of sizes) {
  await page.send('Emulation.setDeviceMetricsOverride', { width: s.w, height: s.h, deviceScaleFactor: s.dpr, mobile: true });
  await page.send('Page.navigate', { url: 'http://127.0.0.1:8766/index.html?admock=1' });
  for (let i = 0; i < 60; i++) { if (await page.eval('!!window.__tailzoo').catch(() => false)) break; await sleep(200); }
  await sleep(700);
  await page.shot(`title-${s.name}.png`);

  const titleFit = await page.eval(`(() => {
    const panel = document.querySelector('#screen-title .panel');
    const btns = ['btnStart','btnHowto','btnRankTitle','btnSoundTitle'].map(id => {
      const el = document.getElementById(id); const r = el.getBoundingClientRect();
      return { id, x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), inView: r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth };
    });
    return { panelScrolls: panel.scrollHeight > panel.clientHeight + 1, btns };
  })()`);
  console.log(`[${s.name}] 标题页`, JSON.stringify(titleFit));

  await page.eval('__tailzoo.start()');
  await sleep(400);
  await page.eval('__tailzoo.state.score = 1280');
  await page.eval("__tailzoo.die('self')");
  await sleep(700);
  await page.shot(`gameover-${s.name}.png`);

  const overFit = await page.eval(`(() => {
    const panel = document.querySelector('.gameover-panel');
    const ids = ['btnReviveAd','btnAgain','btnRankOver','btnToTitle','rankNote'];
    const els = ids.map(id => { const el = document.getElementById(id); const r = el.getBoundingClientRect();
      return { id, y: Math.round(r.y), h: Math.round(r.height), inView: r.top >= 0 && r.bottom <= innerHeight }; });
    return { panelScrolls: panel.scrollHeight > panel.clientHeight + 1, els };
  })()`);
  console.log(`[${s.name}] 结算页`, JSON.stringify(overFit));
}

proc.kill();
await sleep(300);
try { fs.rmSync(profile, { recursive: true, force: true }); } catch {}
console.log('截图输出目录：' + OUT);
process.exit(0);
