// 例外狀況提醒（黃色警告）和網站檢查（在你自己的網站上檢查 GA、GTM、sitemap、robots.txt）
(() => {
  const {
    el, unique, GH,
    onGitHub, onRender, onGA, onGSC, onGTM, onSitemapGen, onMySite,
    meta, user, currentRepo, onRepo, path,
    NEW_REPO_PAGE, NEW_FILE_PAGE, PAGES_SETTINGS, REPO_NAME_INPUT, FILE_NAME_INPUT, RENDER_PUBLISH_DIR,
    extensionAlive, state, setState, repoUrl, mySiteUrl, course, currentStep,
  } = Guide;

  // ---------- 例外狀況 ----------
  function domainProblem(value) {
    const v = value.trim();
    if (!v) return null;
    let fixed = v.replace(/\s+/g, '').toLowerCase();
    if (/\.github\.io\/?$/.test(fixed)) {
      return 'xxx.github.io 是 GitHub 給你的網址，本來就能用，不用填在 Custom domain。這裡要填你自己買的網域，例如 www.example.com。';
    }
    const reasons = [];
    if (/^[a-z]+:\/\//.test(fixed)) reasons.push('不要加 https://');
    fixed = fixed.replace(/^[a-z]+:\/\//, '');
    if (fixed.includes('/')) reasons.push('不要加 / 或後面的路徑');
    fixed = fixed.replace(/\/.*$/, '');
    if (/\s/.test(v)) reasons.push('不能有空格');
    if (/[^a-z0-9.-]/.test(fixed)) reasons.push('只能有英文字母、數字、- 和 .');
    fixed = fixed.replace(/[^a-z0-9.-]/g, '');
    const shapeOk = /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(fixed) && !/(^-|-\.|\.-|-$)/.test(fixed);
    if (!shapeOk) reasons.push('格式要像 example.com 或 www.example.com');
    if (!reasons.length) return null;
    return `Custom domain 格式不對：${reasons.join('、')}。` + (shapeOk ? `請改成：${fixed}` : '');
  }

  // 在 repo 首頁時，檢查最外層有沒有 index.html
  function missingRootIndex() {
    const repo = currentRepo();
    if (!repo) return false;
    const parts = path().split('/').filter(Boolean);
    const isRoot = parts.length === 2 || (parts.length === 4 && parts[2] === 'tree');
    if (!isRoot) return false;
    const links = [...document.querySelectorAll('a[href*="/blob/"]')]
      .map((a) => a.getAttribute('href'))
      .filter((href) => href.toLowerCase().startsWith(`/${repo.toLowerCase()}/blob/`));
    if (!links.length) return false; // 檔案清單還沒載入
    return !links.some((href) => /^\/[^/]+\/[^/]+\/blob\/[^/]+\/index\.html$/.test(href));
  }

  function checkProblems(foundCount) {
    const list = [];
    if (!extensionAlive()) {
      list.push({ text: '擴充功能剛更新過，請按 F5 重新整理這個頁面。' });
      return list;
    }
    const s = currentStep();
    if (onGitHub() && !user()) list.push({ text: '你還沒登入 GitHub，要先登入才能繼續。', href: `${GH}/login`, label: '去登入' });

    const onPage = !s.page || s.page();
    if (!onPage) {
      list.push({
        text: `這一步要在「${s.pageName}」做。如果你已經做完這一步，直接按「下一步」。`,
        href: s.goto?.(),
        label: '帶我過去',
      });
    } else if (s.targets.length && foundCount === 0 && Date.now() - Guide.stepShownAt > 4000) {
      list.push({ text: '畫面上找不到這一步要按的按鈕（網站可能改版了）。照上面的文字做，或按「問問題」。' });
    }

    if (onGitHub() && NEW_REPO_PAGE.test(path())) {
      if (/already exists/i.test(document.querySelector('main')?.textContent || '')) {
        list.push({
          text: '這個名稱你已經用過了。換一個名稱；如果之前已經建好了，可以直接用那個 repo。',
          href: user() ? `${GH}/${user()}?tab=repositories` : null,
          label: '看我的 repo',
        });
      }
      const name = document.querySelector(REPO_NAME_INPUT)?.value.trim().toLowerCase();
      if (name && user() && name.endsWith('.github.io') && name !== `${user().toLowerCase()}.github.io`) {
        list.push({
          text: `用 .github.io 結尾的話，前面要是你自己的帳號：${user()}.github.io，不然網址不會是 https://${user().toLowerCase()}.github.io。`,
        });
      }
    }

    if (course().needsPublic && s.usesRepo && meta('octolytics-dimension-repository_public') === 'false' && onRepo()) {
      list.push({
        text: '這個 repo 是 Private，免費帳號不能開 GitHub Pages。到 Settings 最下方 Danger Zone → Change visibility 改成 Public。',
        href: `${GH}/${currentRepo()}/settings`,
        label: '去 Settings',
      });
    }

    if (s.checkFileName && onGitHub() && NEW_FILE_PAGE.test(path())) {
      const file = document.querySelector(FILE_NAME_INPUT)?.value.trim();
      if (file && file !== 'index.html') {
        list.push({ text: `檔名要是 index.html（全部小寫、沒有空格）。你現在輸入的是「${file}」。` });
      }
    }

    if (s.checkIndex && missingRootIndex()) {
      list.push({
        text:
          'repo 最外層沒有 index.html，網站會顯示 404。如果你是把整個資料夾拖進去，index.html 會在資料夾裡面：' +
          '請重新上傳資料夾「裡面」的檔案。檔名也要全部小寫。',
        href: repoUrl('/upload/main'),
        label: '去上傳',
      });
    }

    if (onRender()) {
      const dir = document.querySelector(RENDER_PUBLISH_DIR)?.value.trim();
      if (dir && /\.html?$/i.test(dir)) {
        list.push({ text: `Publish Directory 要填「資料夾」，不是檔案。index.html 在 repo 最外層的話填 ./（你現在填的是「${dir}」）。` });
      } else if (dir && (/^[a-z]:[\\/]/i.test(dir) || dir.startsWith('/') || dir.includes('\\'))) {
        list.push({ text: `Publish Directory 要填 repo 裡的相對路徑，不是電腦上的路徑。index.html 在最外層的話填 ./（你現在填的是「${dir}」）。` });
      }
    }

    if (onGitHub() && PAGES_SETTINGS.test(path())) {
      for (const box of document.querySelectorAll('main input[type="text"], main input:not([type])')) {
        const problem = domainProblem(box.value);
        if (problem) list.push({ text: problem });
      }
    }

    // GA、GSC、GTM、產生 sitemap 的網站：檢查網址有沒有填錯
    if (onGA() || onGSC() || onGTM() || onSitemapGen()) {
      const example = mySiteUrl() || 'https://帳號.github.io/repo名稱/';
      for (const box of document.querySelectorAll('input')) {
        if (box.closest('.gh-guide-panel')) continue;
        const v = (box.value || '').trim();
        if (!v) continue;
        if (/(^|\/\/|^www\.)github\.com\//i.test(v) || /dashboard\.render\.com/i.test(v)) {
          list.push({ text: `「${v}」是後台網址。這裡要填實際的網站網址，例如 ${example}` });
        } else if (s.checkGaStream && /^https?:\/\//i.test(v) && /\.(github\.io|onrender\.com)/i.test(v)) {
          list.push({ text: 'GA 的網址欄位前面已經有 https:// 選單了，請把你貼上的「https://」刪掉。' });
        } else if (s.checkGscPrefix && /\.(github\.io|onrender\.com)/i.test(v) && !/^https:\/\//i.test(v)) {
          list.push({ text: 'GSC 的「網址前置字元」要填完整網址，前面要有 https://。' });
        }
      }
    }

    // 同樣的提醒只顯示一次
    return list.filter((w, i) => list.findIndex((o) => o.text === w.text) === i);
  }

  // ---------- 網站檢查：在你自己的網站上檢查 GA、GTM、sitemap、robots.txt ----------
  // GitHub Pages 的專案網站網址是 帳號.github.io/repo名稱/，要找出 repo 名稱那一段
  function siteBase() {
    const first = path().split('/').filter(Boolean)[0];
    if (location.host.endsWith('.github.io') && first && !first.includes('.')) {
      const repo = state.repo.split('/')[1];
      const isUserSite = location.host.toLowerCase() === `${(state.repo.split('/')[0] || '').toLowerCase()}.github.io`;
      if ((repo && first.toLowerCase() === repo.toLowerCase()) || (!repo && !isUserSite)) {
        return `${location.origin}/${first}/`;
      }
    }
    return `${location.origin}/`;
  }

  async function fetchText(url) {
    try {
      const res = await fetch(url, { cache: 'no-store' });
      return res.ok ? await res.text() : null;
    } catch {
      return null;
    }
  }

  // 回傳檢查結果：[[狀態, 文字], ...]，狀態是 ok / warn / no（面板負責顯示）
  async function siteCheckRows() {
    const rows = [];

    // GA 追蹤碼（gtag.js）
    const inline = [...document.scripts].filter((sc) => !sc.src);
    const gaInline = inline.filter((sc) => /gtag\(\s*['"]config['"]/.test(sc.textContent));
    const gaIds = unique(
      gaInline.flatMap((sc) => [...sc.textContent.matchAll(/gtag\(\s*['"]config['"]\s*,\s*['"](G-[A-Z0-9]+)/g)].map((m) => m[1]))
    );
    if (gaIds.length) {
      const inHead = gaInline.some((sc) => sc.closest('head'));
      rows.push([inHead ? 'ok' : 'warn', `GA 追蹤碼：${gaIds.join('、')}${inHead ? '（在 <head> 裡）' : '（不在 <head> 裡，請移到 <head>）'}`]);
      if (state.gaId && !gaIds.includes(state.gaId)) {
        rows.push(['warn', `網站上的 GA ID 跟你 GA 帳號的（${state.gaId}）不一樣，請確認有沒有貼錯`]);
      }
    } else {
      rows.push(['no', '找不到 GA 追蹤碼（gtag.js）。還沒做「安裝 GA 追蹤碼」的話可以忽略']);
    }

    // GTM 的兩段程式碼
    const gtmHead = inline.filter((sc) => sc.textContent.includes('googletagmanager.com/gtm.js'));
    const gtmIds = unique(gtmHead.flatMap((sc) => sc.textContent.match(/GTM-[A-Z0-9]+/g) || []));
    if (gtmIds.length) {
      const inHead = gtmHead.some((sc) => sc.closest('head'));
      rows.push([inHead ? 'ok' : 'warn', `GTM <head> 程式碼：${gtmIds.join('、')}${inHead ? '' : '（不在 <head> 裡）'}`]);
      if (state.gtmId && !gtmIds.includes(state.gtmId)) {
        rows.push(['warn', `網站上的 GTM ID 跟你 GTM 帳號的（${state.gtmId}）不一樣，請確認有沒有貼錯`]);
      }
    } else {
      rows.push(['no', '找不到 GTM <head> 程式碼。還沒做「安裝 GTM」的話可以忽略']);
    }
    const noscript = [...document.querySelectorAll('noscript')].find((n) => n.textContent.includes('googletagmanager.com/ns.html'));
    if (noscript) rows.push([noscript.closest('body') ? 'ok' : 'warn', 'GTM <body> 程式碼（noscript）']);
    else rows.push([gtmIds.length ? 'warn' : 'no', '找不到 GTM <body> 程式碼（<noscript> 那段）']);

    // sitemap.xml
    const base = siteBase();
    const sitemap = await fetchText(`${base}sitemap.xml`);
    if (sitemap && sitemap.includes('<urlset')) {
      const locs = [...sitemap.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((m) => m[1]);
      rows.push(['ok', `sitemap.xml（${locs.length} 個網址）`]);
      const wrong = locs.find((u) => !u.startsWith(location.origin));
      if (wrong) rows.push(['warn', `sitemap 裡有不是這個網站的網址：${wrong}，請用正確的網站網址重新產生`]);
    } else {
      rows.push(['no', `找不到 ${base}sitemap.xml（要放在網站最外層，跟 index.html 同一層）`]);
    }

    // robots.txt（一定要在網域的最外層）
    const robots = await fetchText(`${location.origin}/robots.txt`);
    if (robots != null) {
      rows.push(['ok', `robots.txt${/sitemap:/i.test(robots) ? '（有寫 Sitemap）' : ''}`]);
    } else {
      rows.push([
        'warn',
        location.host.endsWith('.github.io') && base !== `${location.origin}/`
          ? '沒有 robots.txt：GitHub 專案網站的 robots.txt 要放在「帳號.github.io」那個 repo 裡（不一定需要）'
          : '沒有 robots.txt（不一定需要；GSC 讀不到 sitemap 時可以加）',
      ]);
    }
    return rows;
  }

  // 在 GA、GTM 頁面上看到唯一的 ID 時記下來（之後產生程式碼、比對網站用）
  function captureIds() {
    if (!extensionAlive()) return;
    const text = document.body.innerText || '';
    if (onGA()) {
      const ids = unique(text.match(/\bG-[A-Z0-9]{6,12}\b/g) || []);
      if (ids.length === 1 && ids[0] !== state.gaId) setState({ gaId: ids[0] });
    }
    if (onGTM()) {
      const ids = unique(text.match(/\bGTM-[A-Z0-9]{5,10}\b/g) || []);
      if (ids.length === 1 && ids[0] !== state.gtmId) setState({ gtmId: ids[0] });
    }
  }
  if (onGA() || onGTM()) setInterval(captureIds, 3000);

  Object.assign(Guide, { checkProblems, siteBase, siteCheckRows });
})();
