// 元素回响 — 启动
import { boot, S, render } from './ui.js';
import { AUDIO } from './fx.js';
import { cloud, saveMeta, hasTap } from './tap.js';

function unlockAudioOnce() {
  AUDIO.unlock();
  window.removeEventListener('pointerdown', unlockAudioOnce);
  window.removeEventListener('keydown', unlockAudioOnce);
}
window.addEventListener('pointerdown', unlockAudioOnce);
window.addEventListener('keydown', unlockAudioOnce);

// 启动后尝试用云存档覆盖本地元进程（仅当云端更优）
(async function start() {
  boot();
  if (!hasTap()) return;
  try {
    const remote = await cloud.load();
    if (remote && typeof remote.bestScore === 'number') {
      if (remote.bestScore > S.meta.bestScore || remote.runs > S.meta.runs) {
        saveMeta(remote);
        S.meta = remote;
        render();
      }
    }
  } catch { /* 云存档不可用时静默降级 */ }
})();

// 防止移动端双击缩放
document.addEventListener('dblclick', (e) => e.preventDefault(), { passive: false });
