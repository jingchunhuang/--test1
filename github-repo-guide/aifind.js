// 找不到按鈕時，請 AI 看畫面找：
// 1. 收集畫面上所有看得到、可以點或填的元素，編號
// 2. 截圖並畫上編號（background.js；要有截圖權限和看圖模型，沒有就只給元素清單）
// 3. AI 回答編號 → 把那個元素變成一個「之後還找得到」的 target，交給 highlight.js 框起來
(() => {
  const { el } = Guide;

  const CANDIDATES =
    'button, a, summary, label, input:not([type="hidden"]), textarea, select, ' +
    '[role="button"], [role="link"], [role="tab"], [role="menuitem"], [role="option"]';
  const MAX_CANDIDATES = 50;

  const send = (msg) =>
    new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage(msg, (resp) =>
          resolve(chrome.runtime.lastError || !resp ? { ok: false, error: chrome.runtime.lastError?.message || '沒有回應' } : resp)
        );
      } catch {
        resolve({ ok: false, error: '擴充功能剛更新過，請按 F5 重新整理頁面。' });
      }
    });

  function collectCandidates() {
    const found = [];
    for (const node of document.querySelectorAll(CANDIDATES)) {
      if (node.closest('.gh-guide-panel, .gh-guide-launcher, .gh-guide-label')) continue;
      const r = node.getBoundingClientRect();
      if (r.width < 4 || r.height < 4 || r.bottom < 0 || r.right < 0 || r.top > innerHeight || r.left > innerWidth) continue;
      const style = getComputedStyle(node);
      if (style.visibility === 'hidden' || style.opacity === '0') continue;
      found.push({ node, r });
    }
    // 外層和內層都在清單裡時，只留最內層
    const inner = found.filter(({ node }) => !found.some((o) => o.node !== node && node.contains(o.node)));
    return inner.slice(0, MAX_CANDIDATES).map(({ node, r }, i) => ({
      node,
      info: {
        i,
        tag: node.tagName.toLowerCase(),
        text: (node.innerText || node.value || '').trim().replace(/\s+/g, ' ').slice(0, 60),
        aria: node.getAttribute('aria-label') || '',
        ph: node.getAttribute('placeholder') || '',
        title: node.getAttribute('title') || '',
        rect: [r.left, r.top, r.width, r.height].map(Math.round),
      },
    }));
  }

  // 把 AI 選的元素變成 target：盡量用之後換頁、重新整理還找得到的線索
  function targetFor(node, tip, done) {
    const tag = node.tagName.toLowerCase();
    const base = { tip: `🤖 ${tip}`, ai: true, done };
    for (const attr of ['aria-label', 'placeholder', 'name', 'data-testid']) {
      const v = node.getAttribute(attr);
      if (v) return { ...base, selector: `${tag}[${attr}="${CSS.escape(v)}"]` };
    }
    const text = node.textContent.trim().replace(/\s+/g, ' ');
    if (text) return { ...base, text: text.slice(0, 40) };
    if (node.id) return { ...base, selector: `#${CSS.escape(node.id)}` };
    return { ...base, node }; // 沒有好線索：只在這一頁有效
  }

  // 截圖時先把面板和提示框藏起來，不要擋到網頁
  function hideOverlay(hidden) {
    for (const node of document.querySelectorAll('.gh-guide-panel, .gh-guide-launcher, .gh-guide-label')) {
      node.style.visibility = hidden ? 'hidden' : '';
    }
  }

  // 回傳 { target, reason, mode, model } 或 { error } 或 { none, reason }
  async function aiFind(step) {
    const list = collectCandidates();
    if (!list.length) return { none: true, reason: '畫面上沒有可以點的東西' };

    hideOverlay(true);
    await new Promise((r) => setTimeout(r, 80)); // 等畫面更新再截圖
    const shot = await send({
      type: 'capture',
      candidates: list.map((c) => c.info),
      viewport: { width: innerWidth, height: innerHeight },
    });
    hideOverlay(false);

    const bodyText = el('div');
    bodyText.innerHTML = step.body();
    const hints = step.targets.map((t) => (t.text ? `文字「${t.text}」` : `選擇器 ${t.selector}`) + `（提示：${t.tip}）`);
    const resp = await send({
      type: 'findTarget',
      step: { title: step.title, text: bodyText.textContent.trim() },
      hints,
      candidates: list.map((c) => c.info),
      image: shot.ok ? shot.image : null,
    });
    if (!resp.ok) return { error: resp.error, why: shot.why };
    if (resp.index < 0) return { none: true, reason: resp.reason, why: shot.why, mode: resp.mode };

    const node = list[resp.index].node;
    const done = step.targets.some((t) => t.done);
    return {
      target: targetFor(node, 'AI 推測是這個', done),
      reason: resp.reason,
      mode: resp.mode,
      model: resp.model,
      why: shot.why,
    };
  }

  Guide.aiFind = aiFind;
  Guide.sendToBackground = send;
})();
