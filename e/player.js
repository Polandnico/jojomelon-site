// Jojomelon 店内屏幕播放器：全屏轮播 slides.json 里的图片，每张按秒数停留，无限循环。
// - 两层图片交替淡入淡出；图片先预加载，加载失败就跳过
// - 每 5 分钟检查一次 slides.json 的 version，变了就整页刷新（改菜单后屏幕自动更新）
// - service worker 把页面和图片存在屏幕本地，断网照样播放
// - 防止屏幕休眠（Wake Lock），隐藏鼠标；点一下屏幕进入全屏
(() => {
  const base = location.pathname.replace(/[^/]*$/, '');
  const stage = document.getElementById('stage');
  const layers = [document.createElement('img'), document.createElement('img')];
  layers.forEach((l) => { l.className = 'layer'; l.alt = ''; stage.appendChild(l); });
  let slides = [], version = null, i = -1, front = 0, timer = null;

  const load = (src) => new Promise((res) => { const im = new Image(); im.onload = () => res(true); im.onerror = () => res(false); im.src = src; });

  async function fetchManifest() {
    const r = await fetch(`${base}slides.json?t=${Date.now()}`, { cache: 'no-store' });
    if (!r.ok) throw new Error('manifest ' + r.status);
    return r.json();
  }

  async function next() {
    clearTimeout(timer);
    if (!slides.length) return;
    for (let tries = 0; tries < slides.length; tries++) {
      i = (i + 1) % slides.length;
      const s = slides[i];
      if (await load(base + s.src)) {
        const back = layers[1 - front];
        back.src = base + s.src;
        back.classList.add('on'); layers[front].classList.remove('on');
        front = 1 - front;
        timer = setTimeout(next, (s.sec || 8) * 1000);
        return;
      }
    }
    timer = setTimeout(next, 10000); // 全部加载失败：10 秒后再试
  }

  async function start() {
    try {
      const m = await fetchManifest();
      slides = m.slides; version = m.version;
      slides.forEach((s) => load(base + s.src)); // 预加载
    } catch (e) {
      setTimeout(start, 15000); return;
    }
    next();
  }

  setInterval(async () => {
    try { const m = await fetchManifest(); if (version && m.version !== version) location.reload(); } catch (e) { /* 断网：继续播放 */ }
  }, 5 * 60 * 1000);

  // 防休眠
  let lock = null;
  const keepAwake = async () => { try { if ('wakeLock' in navigator) lock = await navigator.wakeLock.request('screen'); } catch (e) {} };
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') keepAwake(); });
  keepAwake();

  // 点一下进全屏
  document.addEventListener('click', () => { const d = document.documentElement; if (!document.fullscreenElement && d.requestFullscreen) d.requestFullscreen().catch(() => {}); });

  if ('serviceWorker' in navigator) navigator.serviceWorker.register('/e/sw.js', { scope: '/e/' }).catch(() => {});

  // 每天凌晨 4 点整页刷新一次，防止长时间运行后浏览器变慢
  setInterval(() => { const d = new Date(); if (d.getHours() === 4 && d.getMinutes() < 6) location.reload(); }, 5 * 60 * 1000);

  start();
})();
