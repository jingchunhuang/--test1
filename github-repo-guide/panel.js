// 教學面板：選教學、上一步／下一步、提醒區、網站檢查區；畫面一有變化就重新標示和檢查。
// 這個檔案最後載入，負責把其他檔案的功能接起來。
(() => {
  const { el, state, setState, course, steps, currentStep, currentRepo, onMySite, extensionAlive, COURSES, COURSE_GROUPS } = Guide;

  // ---------- 建立面板 ----------
  const panel = el('div', 'gh-guide-panel');
  panel.innerHTML = `
    <div class="gh-guide-head">
      <span class="gh-guide-count"></span>
      <button class="gh-guide-close" title="收起">×</button>
    </div>
    <select class="gh-guide-course" title="選擇教學"></select>
    <div class="gh-guide-warns"></div>
    <div class="gh-guide-ai" hidden></div>
    <div class="gh-guide-site" hidden>
      <div class="gh-guide-site-head">
        <b>🔍 網站檢查（這一頁）</b>
        <button class="gh-guide-site-recheck">重新檢查</button>
      </div>
      <div class="gh-guide-site-rows"></div>
    </div>
    <div class="gh-guide-where" hidden>💻 這一步在 VS Code 裡做，網頁上不會有標示</div>
    <div class="gh-guide-title"></div>
    <div class="gh-guide-body"></div>
    <div class="gh-guide-toast" hidden></div>
    <div class="gh-guide-nav">
      <button class="gh-guide-prev">上一步</button>
      <button class="gh-guide-next">下一步</button>
    </div>
    <label class="gh-guide-auto"><input type="checkbox" class="gh-guide-auto-box"> 做完自動跳下一步</label>
    <label class="gh-guide-auto"><input type="checkbox" class="gh-guide-ai-box"> 找不到按鈕時請 AI 看畫面</label>
    <button class="gh-guide-maker" title="上傳操作截圖，AI 自動寫出步驟">📷 用截圖做新教學</button>`;
  Guide.mountChat(panel); // 「問問題」在 chat.js

  const launcher = el('button', 'gh-guide-launcher', '📘 建網站教學');
  document.body.append(panel, launcher);

  const $ = (sel) => panel.querySelector(sel);
  const courseSelect = $('.gh-guide-course');
  const warnsBox = $('.gh-guide-warns');
  const siteBox = $('.gh-guide-site');
  const siteRows = $('.gh-guide-site-rows');

  // 下拉選單：教學分組（用截圖做的教學會變動，所以要能重建）
  function buildCourseSelect() {
    courseSelect.replaceChildren();
    for (const g of COURSE_GROUPS) {
      const list = COURSES.filter((c) => c.group === g.id);
      if (!list.length) continue;
      const optgroup = el('optgroup');
      optgroup.label = g.label;
      for (const c of list) {
        const option = el('option', null, c.title);
        option.value = c.id;
        optgroup.append(option);
      }
      courseSelect.append(optgroup);
    }
  }
  $('.gh-guide-maker').onclick = () => Guide.sendToBackground({ type: 'openMaker' });

  // ---------- 按鈕 ----------
  courseSelect.onchange = () => setState({ course: courseSelect.value, step: 0 });
  $('.gh-guide-close').onclick = () => setState({ open: false });
  launcher.onclick = () => setState({ open: true });
  $('.gh-guide-prev').onclick = () => setState({ step: Math.max(0, state.step - 1) });
  $('.gh-guide-next').onclick = () => {
    if (state.step === steps().length - 1) setState({ step: 0, open: false });
    else setState({ step: state.step + 1 });
  };
  $('.gh-guide-site-recheck').onclick = renderSiteCheck;
  const autoBox = $('.gh-guide-auto-box');
  autoBox.onchange = () => setState({ autoNext: autoBox.checked });

  // ---------- 自動跳下一步 ----------
  const stepKey = () => `${state.course}:${state.step}`;
  const isLastStep = () => state.step >= steps().length - 1;

  let toastTimer;
  function goNextAutomatically() {
    if (isLastStep()) return;
    const toast = $('.gh-guide-toast');
    toast.textContent = `✅ 「${currentStep().title}」完成，自動前往下一步`;
    toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (toast.hidden = true), 4000);
    setState({ step: state.step + 1 });
  }

  // 方式 1：網址變了（doneWhen 從「不成立」變成「成立」）
  // 一進到某一步時如果已經成立（例如按了「上一步」、或本來就在那個頁面），不會跳；
  // 要先看到「不成立」（armed），之後變成「成立」才跳。armed 存在 storage，整頁重新載入也記得。
  // 回傳 true 表示狀態變了（setState 會重新 render 和 scan）
  function checkAutoNext(s) {
    if (!state.autoNext || !state.open || !s.doneWhen || isLastStep()) return false;
    if (!s.doneWhen()) {
      if (state.armed !== stepKey()) {
        setState({ armed: stepKey() });
        return true;
      }
      return false;
    }
    if (state.armed === stepKey()) {
      goNextAutomatically();
      return true;
    }
    return false;
  }

  // ---------- 找不到按鈕時請 AI 看畫面（aifind.js、background.js） ----------
  const aiBox = $('.gh-guide-ai-box');
  aiBox.onchange = () => setState({ aiFind: aiBox.checked });
  const aiStatusBox = $('.gh-guide-ai');
  const aiAsked = new Set(); // 這次打開頁面已經問過的「步驟＋網址」，不重複問
  const aiNodeTargets = {}; // 沒辦法存起來的 AI 結果（只在這一頁有效）
  let aiStatus = null; // { key, text, buttons }

  // GA、GTM 每一頁的網址路徑都一樣，頁面的差別在 # 後面（#/home、#/…/variables），所以也要算進去；? 後面的參數不算
  const route = () => (location.hash.startsWith('#/') ? location.hash.split('?')[0] : '');
  const aiKey = () => `${stepKey()}@${location.host}${location.pathname}${route()}`;
  const aiTargetsFor = () => {
    const saved = state.aiFound?.[aiKey()];
    if (saved) return [saved.target];
    return aiNodeTargets[aiKey()] ? [aiNodeTargets[aiKey()]] : [];
  };

  function showAiStatus(text, buttons = []) {
    aiStatus = { key: aiKey(), text, buttons };
    renderAiStatus();
  }

  function renderAiStatus() {
    const show = !!aiStatus && aiStatus.key === aiKey() && state.open;
    aiStatusBox.hidden = !show;
    if (!show) return;
    aiStatusBox.replaceChildren(
      el('div', null, aiStatus.text),
      ...aiStatus.buttons.map(([label, onClick]) => {
        const btn = el('button', null, label);
        btn.onclick = onClick;
        return btn;
      })
    );
  }

  // 為什麼沒有截圖、要怎麼開
  const WHY = {
    'no-permission': ['（這次沒有截圖：要讓 AI 看畫面，要先開啟截圖權限）', [['開啟截圖權限', () => Guide.sendToBackground({ type: 'openOptions' })]]],
    'no-vision-model': ['（這次沒有截圖：還沒安裝看圖模型，在 cmd 執行 ollama pull qwen2.5vl:3b）', []],
  };
  const whyNote = (why) => WHY[why]?.[0] || '';
  const whyButtons = (why) => WHY[why]?.[1] || [];

  function forgetAi(key) {
    delete aiNodeTargets[key];
    const rest = { ...state.aiFound };
    delete rest[key];
    setState({ aiFound: rest });
    showAiStatus('已經拿掉 AI 推測的框，照上面的文字說明做就好。');
  }

  async function maybeAskAI(s) {
    const key = aiKey();
    if (!state.aiFind || aiAsked.has(key) || !extensionAlive()) return;
    if (s.page && !s.page()) return; // 不在這一步的頁面，找不到是正常的
    if (Date.now() - Guide.stepShownAt < 4000) return; // 先給網頁 4 秒載入
    aiAsked.add(key);
    showAiStatus('🤖 找不到這一步的按鈕，正在請 AI 看畫面找…（可能要等幾秒到幾十秒）');

    const result = await Guide.aiFind(s);
    if (aiKey() !== key) return; // 等的時候已經換步驟或換頁了
    if (result.error) {
      showAiStatus(`🤖 AI 沒辦法幫忙找：${result.error}`);
      return;
    }
    if (result.none) {
      showAiStatus(
        `🤖 AI 也找不到這一步的按鈕${result.reason ? `（${result.reason}）` : ''}，請照上面的文字說明做。${whyNote(result.why)}`,
        whyButtons(result.why)
      );
      return;
    }
    if (result.target.node) {
      aiNodeTargets[key] = result.target;
    } else {
      const entry = {
        target: result.target,
        reason: result.reason,
        mode: result.mode,
        model: result.model,
        course: course().title,
        step: s.title,
        original: s.targets.map((t) => t.text || t.selector),
        url: location.href,
        at: new Date().toISOString(),
      };
      setState({ aiFound: { ...state.aiFound, [key]: entry } });
    }
    showAiStatus(
      '🤖 原本的按鈕找不到（網站可能改版了）。紫色虛線框是 AI 推測的位置' +
        `（${result.mode === 'vision' ? '有看截圖' : '只看了按鈕清單'}），可能不準。` +
        (result.reason ? `理由：${result.reason}` : '') +
        whyNote(result.why),
      [['不對，拿掉', () => forgetAi(key)], ...whyButtons(result.why)]
    );
    scan();
  }

  // 方式 2：點了標示 done: true 的按鈕
  // 用 capture 在網頁處理點擊之前先記下，就算按鈕會換頁也來得及存進 storage
  document.addEventListener(
    'click',
    (e) => {
      if (!state.autoNext || !state.open || panel.contains(e.target)) return;
      if (Guide.clickedTarget(e.target)?.done) goNextAutomatically();
    },
    true
  );

  // 說明文字裡的「複製」按鈕
  panel.addEventListener('click', (e) => {
    const btn = e.target.closest('.gh-guide-copy');
    if (!btn) return;
    const text = btn.dataset.copy;
    navigator.clipboard.writeText(text).then(
      () => {
        btn.textContent = '已複製！';
        setTimeout(() => (btn.textContent = btn.dataset.label), 1500);
      },
      () => {
        // 瀏覽器不允許自動複製時，改成顯示文字讓使用者自己複製
        if (btn.nextElementSibling?.tagName === 'TEXTAREA') return;
        const box = el('textarea', 'gh-guide-sample');
        box.value = text;
        box.readOnly = true;
        btn.after(box);
        box.select();
        btn.textContent = '沒辦法自動複製，請按 Ctrl+C 複製下面的文字';
      }
    );
  });

  // ---------- 顯示 ----------
  function render() {
    if (state.step >= steps().length) state.step = 0;
    const s = currentStep();
    const last = state.step === steps().length - 1;
    panel.style.display = state.open ? 'block' : 'none';
    launcher.style.display = state.open ? 'none' : 'block';
    courseSelect.value = course().id;
    $('.gh-guide-count').textContent = `第 ${state.step + 1} / ${steps().length} 步`;
    $('.gh-guide-where').hidden = s.where !== 'vscode';
    $('.gh-guide-title').textContent = s.title;
    $('.gh-guide-body').innerHTML = s.body();
    $('.gh-guide-prev').disabled = state.step === 0;
    $('.gh-guide-next').textContent = last ? '結束教學' : '下一步';
    autoBox.checked = state.autoNext;
    aiBox.checked = state.aiFind;
    renderAiStatus();
    setTimeout(scan, 4100); // 4 秒後再檢查一次「找不到按鈕」
    scan();
  }
  Guide.render = render; // setState 改完狀態會呼叫

  // 標示按鈕、更新警告（highlight.js、checks.js）
  function scan() {
    const s = currentStep();
    // 建好 repo 之後，記住是哪一個 repo，之後的「帶我過去」和網址才知道要去哪
    if (s.usesRepo && currentRepo() && currentRepo() !== state.repo) {
      setState({ repo: currentRepo() });
      return; // setState 會重新 render 並再 scan 一次
    }
    // 打開自己的網站時，記下網站網址（之後填 GA、GSC 時用）
    if (onMySite() && Guide.siteBase() !== state.site) {
      setState({ site: Guide.siteBase() });
      return;
    }
    if (checkAutoNext(s)) return;
    const originalFound = Guide.countFound(s.targets);
    // 換頁了，或原本的線索後來找到了（例如展開選單後才出現），AI 的訊息就不用再顯示
    if (aiStatus && (aiStatus.key !== aiKey() || originalFound)) {
      aiStatus = null;
      renderAiStatus();
    }
    // 原本的線索找不到時，才用 AI 找到的（紫色虛線框）
    const extra = originalFound ? [] : aiTargetsFor();
    const found = Guide.highlight(state.open ? [...s.targets, ...extra] : []);
    problems = state.open ? Guide.checkProblems(found) : [];
    avoidCover();
    renderWarnings([...problems, ...offscreenHint()]);
    if (state.open && !found && s.targets.length) maybeAskAI(s);
  }

  // 接下來要點的按鈕在畫面外：第一次自動捲過去（每一步、每個網址一次，之後不跟使用者搶），並在面板上提示
  let problems = []; // checks.js 的警告，捲動時重畫提示要一起放
  const scrolledFor = new Set();
  function offscreenHint() {
    if (!state.open) return [];
    const off = Guide.nextOffscreen();
    if (!off) return [];
    if (off.scroll && !scrolledFor.has(aiKey())) {
      scrolledFor.add(aiKey());
      off.node.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    return [{ text: `要點的按鈕在畫面${off.below ? '下方，請往下捲' : '上方，請往上捲'}，找橘色框。` }];
  }

  // 面板擋到接下來要點的按鈕時，移到左下角；放回右下角也不會擋到時，再移回去
  function avoidCover() {
    const nodes = state.open ? Guide.nextNodes() : [];
    const r = panel.getBoundingClientRect();
    const width = document.documentElement.clientWidth; // 不含捲軸，跟 position: fixed 的 right 一樣算法
    const at = (left) => ({ left, right: left + r.width, top: r.top, bottom: r.bottom });
    const covers = (box) =>
      nodes.some((node) => {
        const b = node.getBoundingClientRect();
        return b.left < box.right && b.right > box.left && b.top < box.bottom && b.bottom > box.top;
      });
    const toLeft = covers(at(width - 20 - r.width)) && !covers(at(20));
    if (panel.classList.contains('gh-guide-panel-left') !== toLeft) panel.classList.toggle('gh-guide-panel-left', toLeft);
  }

  let lastWarnKey = '';
  function renderWarnings(list) {
    const key = JSON.stringify(list);
    if (key === lastWarnKey) return;
    lastWarnKey = key;
    warnsBox.replaceChildren(
      ...list.map((w) => {
        const box = el('div', 'gh-guide-warn', `⚠️ ${w.text}`);
        if (w.href) {
          const link = el('a', 'gh-guide-warn-link', w.label);
          link.href = w.href;
          box.append(document.createElement('br'), link);
        }
        return box;
      })
    );
  }

  async function renderSiteCheck() {
    siteBox.hidden = !onMySite();
    if (!onMySite()) return;
    siteRows.replaceChildren(el('div', 'gh-guide-site-row', '檢查中…'));
    const rows = await Guide.siteCheckRows();
    const icon = { ok: '✅', warn: '⚠️', no: '❌' };
    siteRows.replaceChildren(...rows.map(([kind, text]) => el('div', `gh-guide-site-row gh-guide-site-${kind}`, `${icon[kind]} ${text}`)));
  }

  // ---------- 監聽畫面變化 ----------
  // 網站換頁不會重新載入，所以要監聽畫面變化；打字時也要重新檢查（檔名、網域格式）
  let pending = false;
  const scheduleScan = () => {
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => {
      pending = false;
      scan();
    });
  };
  new MutationObserver(scheduleScan).observe(document.body, { childList: true, subtree: true });
  // 捲動時只更新「按鈕在畫面外」的提示（不用整個重新檢查）
  let hintPending = false;
  window.addEventListener(
    'scroll',
    () => {
      if (hintPending) return;
      hintPending = true;
      requestAnimationFrame(() => {
        hintPending = false;
        avoidCover();
        renderWarnings([...problems, ...offscreenHint()]);
      });
    },
    true
  );
  window.addEventListener('resize', avoidCover);
  document.addEventListener(
    'input',
    (e) => {
      if (!panel.contains(e.target)) scheduleScan();
    },
    true
  );

  // ---------- 開始 ----------
  // 記住上次選的教學和教到第幾步（換頁、重新整理、換網站都會接著教）
  try {
    chrome.storage.local.get(['guideState', 'customCourses'], ({ guideState, customCourses }) => {
      Guide.setCustomCourses(customCourses);
      buildCourseSelect();
      if (guideState) Object.assign(state, guideState);
      if (!COURSES.some((c) => c.id === state.course)) state.course = COURSES[0].id;
      render();
      renderSiteCheck();
    });
    // 在「用截圖做教學」頁面存了新教學：已經打開的頁面也馬上更新下拉選單；按「開始這套教學」就切過去
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'local') return;
      if (changes.customCourses) {
        Guide.setCustomCourses(changes.customCourses.newValue);
        buildCourseSelect();
      }
      const next = changes.guideState?.newValue;
      if (changes.customCourses || (next && next.course !== state.course)) {
        if (next) Object.assign(state, { course: next.course, step: next.step, open: next.open });
        if (!COURSES.some((c) => c.id === state.course)) state.course = COURSES[0].id;
        render();
      }
    });
  } catch {
    buildCourseSelect();
    render();
    renderSiteCheck();
  }
})();
