/* 尾巴动物园 —— TapTap 接入层自动化验收
 * 用 Edge headless + CDP 跑通：排行榜按钮、结算自动提交、激励视频复活、复活次数上限。
 * 用法：node tools/verify-taptap.mjs [baseUrl]
 * 需要先启动本地预览：node tools/serve.mjs（默认 8765，可用 PORT 覆盖）
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PORT = 9333;
const BASE = process.argv[2] || 'http://127.0.0.1:8766';
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'tailzoo-e2e-'));

const results = [];
function check(name, ok, detail) {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  → ' + detail : ''}`);
}

const proc = spawn(EDGE, [
  '--headless=new',
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${profile}`,
  '--no-first-run',
  '--no-default-browser-check',
  '--disable-extensions',
  'about:blank'
], { stdio: 'ignore' });

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function waitFor(fn, timeout = 20000, step = 200) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    try { const v = await fn(); if (v) return v; } catch {}
    await sleep(step);
  }
  throw new Error('timeout waiting for condition');
}

class CDP {
  constructor(url) {
    this.ws = new WebSocket(url);
    this.id = 0;
    this.pending = new Map();
    this.errors = [];
    this.ws.onmessage = ev => {
      let msg;
      try { msg = JSON.parse(ev.data); } catch { return; }
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(msg.error.message));
        else resolve(msg.result);
        return;
      }
      if (msg.method === 'Runtime.exceptionThrown') {
        this.errors.push(msg.params.exceptionDetails?.text || 'exception');
      }
      if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
        this.errors.push(msg.params.args.map(a => a.value ?? a.description).join(' '));
      }
    };
  }
  ready() {
    return new Promise((resolve, reject) => {
      if (this.ws.readyState === WebSocket.OPEN) return resolve();
      this.ws.onopen = resolve;
      this.ws.onerror = () => reject(new Error('ws error'));
    });
  }
  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
  async eval(expression) {
    const r = await this.send('Runtime.evaluate', {
      expression, awaitPromise: true, returnByValue: true, userGesture: true
    });
    if (r.exceptionDetails) {
      throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
    }
    return r.result.value;
  }
}

let code = 0;
try {
  const target = await waitFor(async () => {
    const r = await fetch(`http://127.0.0.1:${PORT}/json/list`);
    const list = await r.json();
    return list.find(t => t.type === 'page');
  });
  const page = new CDP(target.webSocketDebuggerUrl);
  await page.ready();
  await page.send('Runtime.enable');
  await page.send('Page.enable');

  async function load(query) {
    await page.send('Page.navigate', { url: BASE + '/index.html' + query });
    await waitFor(() => page.eval('!!window.__tailzoo && !!window.__tailzoo.snapshot'));
    await sleep(400);
  }

  /* ---------- 1. 带 admock 的完整流程 ---------- */
  await load('?admock=1');

  check('页面启动、测试钩子可用', await page.eval('!!window.__tailzoo.snapshot'));
  check('admock 下广告就绪', await page.eval('__tailzoo.adsReady()'));
  check('排行榜 ID 与后台一致',
    await page.eval("__tailzoo.platform.leaderboardId === 'xbzw2e4303k6c7uwqo'"),
    await page.eval('__tailzoo.platform.leaderboardId'));
  check('棋盘为 18×18', (await page.eval('__tailzoo.snapshot().grid')) === 18,
    'grid=' + (await page.eval('__tailzoo.snapshot().grid')));

  // 标题页有排行榜入口
  const titleBtns = await page.eval(`(() => {
    const b = document.getElementById('btnRankTitle');
    return b ? { text: b.textContent.trim(), visible: b.offsetParent !== null } : null;
  })()`);
  check('标题页有排行榜按钮', !!(titleBtns && titleBtns.visible), JSON.stringify(titleBtns));

  // 点击排行榜（浏览器环境无 tap，应给出降级提示且不报错）
  await page.eval("document.getElementById('btnRankTitle').click()");
  await sleep(150);
  check('无 tap 环境点排行榜不抛错', page.errors.length === 0, page.errors.join(' | '));
  check('标题页能看到排行榜降级提示',
    await page.eval("document.getElementById('tapToast').classList.contains('show') && document.getElementById('tapToast').textContent.includes('TapTap 客户端')"),
    await page.eval("document.getElementById('tapToast').textContent"));

  // 开局 → 撞墙死亡
  await page.eval('__tailzoo.start()');
  await sleep(300);
  check('开局进入 playing', (await page.eval('__tailzoo.snapshot().screen')) === 'playing');

  await page.eval('__tailzoo.state.score = 321');
  await page.eval("__tailzoo.die('wall')");
  await sleep(300);
  const over = await page.eval('__tailzoo.snapshot()');
  check('死亡进入 gameover', over.screen === 'gameover');
  check('结算分数正确', over.score === 321, 'score=' + over.score);

  const reviveBtn = await page.eval(`(() => {
    const b = document.getElementById('btnReviveAd');
    return { text: b.textContent.trim(), hidden: b.classList.contains('hidden'), disabled: b.disabled };
  })()`);
  check('广告复活按钮出现', !reviveBtn.hidden, JSON.stringify(reviveBtn));

  const finalScore = over.score;
  await page.eval("document.getElementById('btnReviveAd').click()");
  await sleep(1800);
  const after = await page.eval('__tailzoo.snapshot()');
  check('看完广告回到 playing', after.screen === 'playing', after.screen);
  check('复活次数记为 1', after.adRevives === 1, 'adRevives=' + after.adRevives);
  check('复活后保留分数', after.score >= 321, `${finalScore} → ${after.score}`);
  check('复活后有无敌时间', await page.eval('__tailzoo.state.invuln > 0'),
    await page.eval('__tailzoo.state.invuln.toFixed(2)'));
  check('复活方向朝棋盘内', await page.eval(`(() => {
    const s = __tailzoo.state, h = s.snake[0], g = __tailzoo.snapshot().grid;
    const nx = h.x + s.dir.x, ny = h.y + s.dir.y;
    return nx >= 0 && ny >= 0 && nx < g && ny < g && !s.rocks.has(nx + ',' + ny);
  })()`));
  check('复活后不再贴着墙', await page.eval(`(() => {
    const s = __tailzoo.state, h = s.snake[0], g = __tailzoo.snapshot().grid;
    const nx = h.x + s.dir.x, ny = h.y + s.dir.y;
    return !(nx < 0 || ny < 0 || nx >= g || ny >= g);
  })()`));

  // 复活后蛇要真的重新动起来（而不是卡在墙上被冻结）
  const headBefore = await page.eval('[__tailzoo.state.snake[0].x, __tailzoo.state.snake[0].y]');
  await sleep(1200);
  const headAfter = await page.eval('[__tailzoo.state.snake[0].x, __tailzoo.state.snake[0].y]');
  check('复活后蛇重新移动', headAfter[0] !== headBefore[0] || headAfter[1] !== headBefore[1],
    `(${headBefore}) → (${headAfter})`);
  check('复活后仍在游戏中', (await page.eval('__tailzoo.snapshot().screen')) === 'playing',
    await page.eval('__tailzoo.snapshot().screen'));

  // 第二次死亡：复活次数已达上限，按钮应隐藏
  await page.eval("__tailzoo.die('self')");
  await sleep(300);
  const reviveBtn2 = await page.eval(`(() => {
    const b = document.getElementById('btnReviveAd');
    return { hidden: b.classList.contains('hidden') };
  })()`);
  check('复活上限 1 次，按钮隐藏', reviveBtn2.hidden, JSON.stringify(reviveBtn2));

  // 复活后继续跑几秒，确认不会卡死
  const screenBefore = await page.eval('__tailzoo.snapshot().screen');
  check('结算页停留正常', screenBefore === 'gameover');

  check('全流程无 JS 异常', page.errors.length === 0, page.errors.join(' | '));
  if (page.errors.length) code = 1;

  /* ---------- 2. 无广告位时（真实浏览器环境）不应出现广告按钮 ---------- */
  await load('');
  check('无 admock 时广告未就绪', (await page.eval('__tailzoo.adsReady()')) === false);
  await page.eval('__tailzoo.start()');
  await sleep(200);
  await page.eval("__tailzoo.die('rock')");
  await sleep(300);
  check('广告未就绪时隐藏复活按钮',
    await page.eval("document.getElementById('btnReviveAd').classList.contains('hidden')"));

  await load('');
  await page.eval("document.getElementById('btnRankTitle').click()");
  await sleep(150);
  check('排行榜降级提示可见',
    await page.eval("document.getElementById('tapToast').classList.contains('show')"),
    await page.eval("document.getElementById('tapToast').textContent"));

  check('第二轮无 JS 异常', page.errors.length === 0, page.errors.join(' | '));
  if (page.errors.length) code = 1;

  /* ---------- 3. 注入假 tap 宿主，验证真实调用参数 ---------- */
  await page.send('Page.addScriptToEvaluateOnNewDocument', {
    source: `window.__lb = [];
      window.__adUnitId = null;
      window.__adEnded = true;
      window.tap = {
        getLeaderboardManager() {
          return {
            submitScores(o) {
              window.__lb.push({ type: 'submit', scores: o.scores });
              if (o.callback && o.callback.onSuccess) o.callback.onSuccess({});
            },
            openLeaderboard(o) {
              window.__lb.push({ type: 'open', leaderboardId: o.leaderboardId, collection: o.collection });
              if (o.callback && o.callback.onSuccess) o.callback.onSuccess({});
            }
          };
        },
        createRewardedVideoAd(opts) {
          window.__adUnitId = opts && opts.adUnitId;
          const h = {};
          const failMode = () => window.__adMode === 'fail';
          return {
            onLoad(cb) { h.load = cb; },
            onError(cb) { h.error = cb; },
            onClose(cb) { h.close = cb; },
            // 故意在 fail 模式下返回 undefined，验证不会因非 Promise 抛错
            load() { return failMode() ? undefined : Promise.resolve(); },
            show() {
              if (failMode()) return Promise.reject(new Error('ad not ready'));
              setTimeout(() => { if (h.close) h.close({ isEnded: window.__adEnded === true }); }, 40);
              return Promise.resolve();
            },
            destroy() {}
          };
        }
      };`
  });
  await load('');
  check('检测到宿主 tap', await page.eval('__tailzoo.platform.inClient'));
  await page.eval('__tailzoo.start()');
  await sleep(250);
  await page.eval('__tailzoo.state.score = 888');
  await page.eval("__tailzoo.die('self')");
  await sleep(400);

  const submitCall = await page.eval("window.__lb.find(c => c.type === 'submit') || null");
  check('结算自动提交排行榜分数',
    !!submitCall && submitCall.scores[0].leaderboardId === 'xbzw2e4303k6c7uwqo' && submitCall.scores[0].score === 888,
    JSON.stringify(submitCall));
  check('结算页显示已上榜',
    await page.eval("document.getElementById('rankNote').textContent.includes('已上传排行榜')"),
    await page.eval("document.getElementById('rankNote').textContent"));

  await page.eval("document.getElementById('btnRankOver').click()");
  await sleep(200);
  const openCall = await page.eval("window.__lb.find(c => c.type === 'open') || null");
  check('排行榜按钮调用 openLeaderboard',
    !!openCall && openCall.leaderboardId === 'xbzw2e4303k6c7uwqo' && openCall.collection === 'public',
    JSON.stringify(openCall));

  // ---- 激励视频：真实宿主调用路径 ----
  check('启动时用真实广告位预加载', (await page.eval('window.__adUnitId')) === '1054324',
    String(await page.eval('window.__adUnitId')));
  check('宿主结算页出现复活按钮',
    !(await page.eval("document.getElementById('btnReviveAd').classList.contains('hidden')")));

  await page.eval("document.getElementById('btnReviveAd').click()");
  await sleep(700);
  const afterAd = await page.eval('__tailzoo.snapshot()');
  check('看完激励视频后复活成功', afterAd.screen === 'playing' && afterAd.adRevives === 1,
    `screen=${afterAd.screen} adRevives=${afterAd.adRevives}`);

  // 提前关闭不应发奖励
  await page.eval('window.__adEnded = false');
  const early = await page.eval("new Promise(res => __tailzoo.showRewarded('test', res))");
  check('提前关闭不发奖励', early.ok === false && early.reason === 'closed-early', JSON.stringify(early));
  await page.eval('window.__adEnded = true');

  // show() 失败 → load() 重试一次仍失败：安全收敛，不抛错（load 返回 undefined）
  await page.eval("window.__adMode = 'fail'");
  const adFailed = await page.eval("new Promise(res => __tailzoo.showRewarded('test', res))");
  check('广告失败时安全收敛', adFailed.ok === false && adFailed.reason === 'ad-show-failed', JSON.stringify(adFailed));
  await page.eval("window.__adMode = 'ok'");

  check('宿主环境无 JS 异常', page.errors.length === 0, page.errors.join(' | '));
  if (page.errors.length) code = 1;

  const failed = results.filter(r => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} 项通过`);
  if (failed.length) { console.log('失败项：', failed.map(f => f.name).join('，')); code = 1; }
} catch (e) {
  console.error('E2E 运行失败：', e);
  code = 1;
} finally {
  try { proc.kill(); } catch {}
  await sleep(300);
  try { fs.rmSync(profile, { recursive: true, force: true }); } catch {}
  process.exit(code);
}
