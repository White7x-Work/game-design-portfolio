// 可复现伪随机（mulberry32）+ 日期种子 — 规格 §7.2 / §8
// 全流程必须确定性：同 seed 同结果（跨设备一致，每日一题依赖此性质）。

/** mulberry32：返回 [0,1) 均匀分布的确定性 RNG */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type RNG = () => number;

/** xmur3 字符串散列 → 32bit seed（用于关卡 id → 种子） */
export function hashString(str: string): number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^= h >>> 16) >>> 0;
}

/** 日期种子：'YYYY-MM-DD' → YYYYMMDD 整数（规格 §8：prng(seed=YYYYMMDD)） */
export function dateSeed(dateStr: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  if (!m) throw new Error('bad date: ' + dateStr);
  return parseInt(m[1] + m[2] + m[3], 10);
}

/** 本地今天的 'YYYY-MM-DD' */
export function todayStr(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** 本地今天的 'YYYYMMDD' */
export function todayCompact(d: Date = new Date()): string {
  return String(dateSeed(todayStr(d)));
}

/** 随机整数 [0,n) */
export function randInt(rng: RNG, n: number): number {
  return Math.floor(rng() * n);
}

/** 随机浮点 [a,b) */
export function randRange(rng: RNG, a: number, b: number): number {
  return a + rng() * (b - a);
}

/** 原地洗牌（Fisher-Yates，确定性） */
export function shuffle<T>(rng: RNG, arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = randInt(rng, i + 1);
    const t = arr[i];
    arr[i] = arr[j];
    arr[j] = t;
  }
  return arr;
}
