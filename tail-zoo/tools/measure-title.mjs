/* 对比标题页在合并前后的高度占用（360×640 / 390×844） */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PORT = 9357;
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'tz-title-'));
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
    if (r.exceptionDetails) return { __error: r.exceptionDetails.exception?.description };
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

const files = ['index.html', 'index.premerge.html'];
const sizes = [{ w: 360, h: 640 }, { w: 390, h: 844 }];

for (const f of files) {
  for (const s of sizes) {
    await page.send('Emulation.setDeviceMetricsOverride', { width: s.w, height: s.h, deviceScaleFactor: 2, mobile: true });
    await page.send('Page.navigate', { url: 'http://127.0.0.1:8766/' + f });
    for (let i = 0; i < 80; i++) { if (await page.eval('!!window.__tailzoo').catch(() => false)) break; await sleep(150); }
    await sleep(500);
    const m = await page.eval(`(() => {
      const p = document.querySelector('#screen-title .panel');
      return { scrollH: p.scrollHeight, clientH: p.clientHeight, over: p.scrollHeight - p.clientHeight };
    })()`);
    console.log(`${f} @ ${s.w}x${s.h}  panel scrollH=${m.scrollH} clientH=${m.clientH} 溢出=${m.over}`);
  }
}

proc.kill();
await sleep(300);
try { fs.rmSync(profile, { recursive: true, force: true }); } catch {}
process.exit(0);
