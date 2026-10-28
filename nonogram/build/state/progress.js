import { STORAGE_KEYS, LIMITS } from '../config.js';
const DEFAULT = {
    unlockedMainline: 1, // 第 1 关（index 0）始终可玩
    unlockedChallenge: 0,
    records: {},
};
/** 旧星级存档迁移：保留历史最佳用时；零失误（perfect）可推出 minMistakes=0 */
function migrateStars(stars) {
    const out = {};
    for (const [id, rec] of Object.entries(stars)) {
        if (rec && typeof rec.bestTimeSec === 'number' && rec.bestTimeSec > 0) {
            out[id] = { bestTimeSec: rec.bestTimeSec, ...(rec.perfect ? { minMistakes: 0 } : {}) };
        }
    }
    return out;
}
export function loadProgress() {
    try {
        const raw = localStorage.getItem(STORAGE_KEYS.progress);
        if (!raw)
            return structuredClone(DEFAULT);
        const p = JSON.parse(raw);
        return {
            unlockedMainline: clampInt(p.unlockedMainline ?? 1, 1, LIMITS.mainlineCount),
            unlockedChallenge: clampInt(p.unlockedChallenge ?? 0, 0, LIMITS.challengeCount),
            records: typeof p.records === 'object' && p.records
                ? p.records
                : p.stars
                    ? migrateStars(p.stars)
                    : {},
        };
    }
    catch {
        return structuredClone(DEFAULT);
    }
}
export function saveProgress(p) {
    try {
        localStorage.setItem(STORAGE_KEYS.progress, JSON.stringify(p));
    }
    catch {
        // 存储不可用（隐私模式等）：忽略，进度仅存内存
    }
}
function clampInt(v, lo, hi) {
    return Math.min(hi, Math.max(lo, Math.floor(v)));
}
/** 通关结算：更新"最少失误 / 最佳用时"记录 + 线性解锁（§3.2） */
export function recordWin(p, levelId, type, index, mistakes, timeSec) {
    const prev = p.records[levelId];
    const rec = {
        bestTimeSec: prev ? Math.min(prev.bestTimeSec, timeSec) : timeSec,
        minMistakes: Math.min(prev?.minMistakes ?? mistakes, mistakes),
    };
    p.records[levelId] = rec;
    if (type === 'mainline') {
        p.unlockedMainline = Math.max(p.unlockedMainline, Math.min(index + 2, LIMITS.mainlineCount));
    }
    else if (type === 'challenge') {
        p.unlockedChallenge = Math.max(p.unlockedChallenge, Math.min(index + 2, LIMITS.challengeCount));
    }
    saveProgress(p);
}
/** 挑战区是否解锁 —— 试玩模式：全部开放（原规格 §3.2 为通关主线第 35 关） */
export function challengeZoneUnlocked(_p) {
    return true;
}
/** 试玩模式：主线关卡全解锁（原规格 §3.2 为线性解锁） */
export function isMainlineUnlocked(_p, _index) {
    return true;
}
/** 试玩模式：挑战关卡全解锁 */
export function isChallengeUnlocked(_p, _index) {
    return true;
}
// ---------- 教学页"已看过"标记 ----------
export function tutorialSeen(id) {
    try {
        return localStorage.getItem(STORAGE_KEYS.tutorialPrefix + id) === '1';
    }
    catch {
        return false;
    }
}
export function markTutorialSeen(id) {
    try {
        localStorage.setItem(STORAGE_KEYS.tutorialPrefix + id, '1');
    }
    catch {
        /* ignore */
    }
}
export function loadDailyCache(key) {
    try {
        const raw = localStorage.getItem(STORAGE_KEYS.dailyPrefix + key);
        if (!raw)
            return null;
        const c = JSON.parse(raw);
        if (!c || !Array.isArray(c.rows))
            return null;
        return c;
    }
    catch {
        return null;
    }
}
export function saveDailyCache(key, c) {
    try {
        localStorage.setItem(STORAGE_KEYS.dailyPrefix + key, JSON.stringify(c));
    }
    catch {
        /* ignore */
    }
}
export function resetProgress() {
    try {
        localStorage.removeItem(STORAGE_KEYS.progress);
    }
    catch {
        /* ignore */
    }
    return structuredClone(DEFAULT);
}
