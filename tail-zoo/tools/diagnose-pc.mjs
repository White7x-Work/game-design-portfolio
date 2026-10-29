/* PC 端诊断：线上 URL 与本地文件，在桌面分辨率下抓控制台错误、DOM 与布局尺寸 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PORT = 9347;
const OUT = 'D:\\DSH\\MONEY\\tail-zoo\\screenshots';
fs.mkdirSync(OUT, { recursive: true });
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'tz-pc-'));
const proc = spawn(EDGE, ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, '--no-first-run', '--hide-scrollbars', 'about:blank'], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));

class CDP {
  constructor(url) {
    this.ws = new WebSocket(url); this.id = 0; this.pending = new Map(); this.events = [];
    this.ws.onmessage = ev => {
      const m = JSON.parse(ev.data);
      if (m.id && this.pending.has(m.id)) {
        const p = this.pending.get(m.id); this.pending.delete(m.id);
        m.error ? p.reject(new Error(m.error.message)) : p.resolve(m.result);
        return;
      }
      if (m.method === 'Runtime.exceptionThrown') {
        this.events.push('EXCEPTION ' + (m.params.exceptionDetails?.exception?.description || m.params.exceptionDetails?.text || ''));
      }
      if (m.method === 'Runtime.consoleAPICalled') {
        const txt = (m.params.args || []).map(a => a.value ?? a.description ?? a.type).join(' ');
        this.events.push(m.params.type.toUpperCase() + ' ' + txt);
      }
      if (m.method === 'Log.entryAdded') {
        this.events.push('LOG-' + m.params.entry.level + ' ' + m.params.entry.text);
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
    if (r.exceptionDetails) return { __error: r.exceptionDetails.exception?.description || r.exceptionDetails.text };
    return r.result.value;
  }
  async shot(file) {
    try {
      const r = await this.send('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync(path.join(OUT, file), Buffer.from(r.data, 'base64'));
      return true;
    } catch (e) { return false; }
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
await page.send('Log.enable');

const cases = [
  { name: 'live', url: 'https://white7x-work.github.io/game-design-portfolio/tail-zoo/' },
  { name: 'live-root', url: 'https://white7x-work.github.io/game-design-portfolio/' },
  { name: 'local', url: 'http://127.0.0.1:8766/index.html' }
];

for (const c of cases) {
  await page.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  page.events = [];
  let navErr = null;
  try {
    const r = await page.send('Page.navigate', { url: c.url });
    if (r.errorText) navErr = r.errorText;
  } catch (e) { navErr = e.message; }

  await sleep(3500);
  const info = await page.eval(`(() => {
    const canvas = document.getElementById('game');
    const board = document.getElementById('boardWrap');
    const title = document.getElementById('screen-title');
    return {
      title: document.title,
      readyState: document.readyState,
      hasHook: typeof window.__tailzoo !== 'undefined',
      screen: window.__tailzoo ? window.__tailzoo.snapshot().screen : null,
      layoutW: window.__tailzoo ? (window.__tailzoo.resize(), document.getElementById('game').clientWidth) : null,
      canvasPx: canvas ? [canvas.clientWidth, canvas.clientHeight] : null,
      boardPx: board ? [Math.round(board.getBoundingClientRect().width), Math.round(board.getBoundingClientRect().height)] : null,
      titleVisible: title ? getComputedStyle(title).display : null,
      bodyScroll: [document.documentElement.scrollWidth, document.documentElement.scrollHeight],
      view: [innerWidth, innerHeight],
      bodyText: document.body.innerText.slice(0, 80).replace(/\\s+/g, ' ')
    };
  })()`);

  const shotOk = await page.shot(`pc-${c.name}.png`);
  const events = page.events.slice(0, 8);
  console.log(`\n===== ${c.name} =====`);
  console.log('url      ', c.url);
  console.log('navError ', navErr || '-');
  console.log('info     ', JSON.stringify(info));
  console.log('events   ', events.length ? JSON.stringify(events) : '无');
  console.log('shot     ', shotOk ? `screenshots/pc-${c.name}.png` : '失败');
}

proc.kill();
await sleep(300);
try { fs.rmSync(profile, { recursive: true, force: true }); } catch {}
process.exit(0);
