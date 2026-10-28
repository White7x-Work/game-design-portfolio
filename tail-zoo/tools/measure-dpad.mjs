/* 测量方向键（触屏布局）在各机型下的尺寸与是否溢出 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PORT = 9343;
const OUT = 'D:\\DSH\\MONEY\\tail-zoo\\screenshots';
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'tz-dpad-'));
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
  { name: '430x932', w: 430, h: 932 },
  { name: '390x844', w: 390, h: 844 },
  { name: '375x667', w: 375, h: 667 },
  { name: '360x640', w: 360, h: 640 }
];

for (const s of sizes) {
  await page.send('Emulation.setDeviceMetricsOverride', { width: s.w, height: s.h, deviceScaleFactor: 2, mobile: true });
  await page.send('Page.navigate', { url: 'http://127.0.0.1:8766/index.html?touch=1' });
  for (let i = 0; i < 60; i++) { if (await page.eval('!!window.__tailzoo').catch(() => false)) break; await sleep(200); }
  await sleep(400);
  await page.eval('__tailzoo.start()');
  await sleep(700);
  await page.eval('__tailzoo.setGod(true)');

  const m = await page.eval(`(() => {
    const r = el => { const b = el.getBoundingClientRect(); return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height), bottom: Math.round(b.bottom) }; };
    const dpad = document.getElementById('dpad');
    const btns = ['dpadUp','dpadDown','dpadLeft','dpadRight'].map(id => ({ id, ...r(document.getElementById(id)) }));
    const board = document.getElementById('boardWrap');
    const top = document.getElementById('topbar');
    const under = document.getElementById('underbar');
    const stage = document.getElementById('stage');
    return {
      vw: innerWidth, vh: innerHeight,
      docScroll: document.documentElement.scrollHeight,
      dpadVisible: getComputedStyle(dpad).visibility !== 'hidden' && dpad.offsetParent !== null,
      dpad: r(dpad),
      dpadCentered: Math.abs((r(dpad).x + r(dpad).w / 2) - innerWidth / 2) <= 2,
      btns,
      board: r(board),
      topbar: r(top),
      underbar: r(under),
      stage: r(stage)
    };
  })()`);

  const minBtn = Math.min(...m.btns.map(b => Math.min(b.w, b.h)));
  const fits = m.dpad.bottom <= m.vh && m.docScroll <= m.vh;
  const slack = m.vh - m.docScroll;
  console.log(`\n[${s.name}] vh=${m.vh} dpad=${m.dpad.w}x${m.dpad.h}@y${m.dpad.y} 按钮最小边=${minBtn}px 居中=${m.dpadCentered} 底部可见=${fits} 棋盘=${m.board.w} 滚动高=${m.docScroll}`);
  console.log(`    topbar=${m.topbar.h} underbar=${m.underbar.h} stage=${m.stage.h}(y${m.stage.y}) 剩余空间=${slack} 固定项=${m.vh - m.board.w - m.dpad.h - m.topbar.h - m.underbar.h}`);
  await page.shot(`play-dpad-${s.name}.png`);
}

proc.kill();
await sleep(300);
try { fs.rmSync(profile, { recursive: true, force: true }); } catch {}
process.exit(0);
