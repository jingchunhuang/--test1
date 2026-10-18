// 教學面板：選教學、上一步／下一步、提醒區、網站檢查區；畫面一有變化就重新標示和檢查。
// 這個檔案最後載入，負責把其他檔案的功能接起來。
(() => {
  const { el, state, setState, course, steps, currentStep, currentRepo, onMySite, COURSES, COURSE_GROUPS } = Guide;

  // ---------- 建立面板 ----------
  const panel = el('div', 'gh-guide-panel');
  panel.innerHTML = `
    <div class="gh-guide-head">
      <span class="gh-guide-count"></span>
      <button class="gh-guide-close" title="收起">×</button>
    </div>
    <select class="gh-guide-course" title="選擇教學"></select>
    <div class="gh-guide-warns"></div>
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
    <label class="gh-guide-auto"><input type="checkbox" class="gh-guide-auto-box"> 做完自動跳下一步</label>`;
  Guide.mountChat(panel); // 「問問題」在 chat.js

  const launcher = el('button', 'gh-guide-launcher', '📘 建網站教學');
  document.body.append(panel, launcher);

  const $ = (sel) => panel.querySelector(sel);
  const courseSelect = $('.gh-guide-course');
  const warnsBox = $('.gh-guide-warns');
  const siteBox = $('.gh-guide-site');
  const siteRows = $('.gh-guide-site-rows');

  // 下拉選單：教學分組
  for (const g of COURSE_GROUPS) {
    const optgroup = el('optgroup');
    optgroup.label = g.label;
    for (const c of COURSES.filter((c) => c.group === g.id)) {
      const option = el('option', null, c.title);
      option.value = c.id;
      optgroup.append(option);
    }
    courseSelect.append(optgroup);
  }

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
    const found = Guide.highlight(state.open ? s.targets : []);
    renderWarnings(state.open ? Guide.checkProblems(found) : []);
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
    chrome.storage.local.get('guideState', ({ guideState }) => {
      if (guideState) Object.assign(state, guideState);
      if (!COURSES.some((c) => c.id === state.course)) state.course = COURSES[0].id;
      render();
      renderSiteCheck();
    });
  } catch {
    render();
    renderSiteCheck();
  }
})();
