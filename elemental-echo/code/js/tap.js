// 元素回响 — TapTap 能力桥接层
// 原则：客户端不安装 SDK，tap 是运行时全局对象；无 tap 环境全部降级为本地实现。

export const TAP_CONFIG = {
  leaderboardId: '',   // 由 MCP create_leaderboard 返回后填入
  shareTemplateId: '', // 由 MCP create_share_template 审核通过后填入
  adSpaceId: '',       // 由 MCP check_ads_status 返回后填入
};

const T = () => (typeof window !== 'undefined' ? window.tap : undefined);
export const hasTap = () => typeof T() !== 'undefined';

// ---------------- 震动 ----------------
export const haptics = {
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
export const leaderboard = {
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

export function loadMeta() {
  try {
    const raw = localStorage.getItem(META_KEY);
    if (!raw) return { bestScore: 0, bestAct: 0, runs: 0, kills: 0, unlocked: [] };
    return JSON.parse(raw);
  } catch { return { bestScore: 0, bestAct: 0, runs: 0, kills: 0, unlocked: [] }; }
}

export function saveMeta(meta) {
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

export const cloud = {
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
export const share = {
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

export const ads = {
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
