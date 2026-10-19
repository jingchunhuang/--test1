// 共用的工具和狀態。其他檔案都從 Guide 這個物件拿東西，也把自己的功能放進 Guide。
// 載入順序（manifest.json）：common.js → courses.js → faq.js → highlight.js → checks.js → chat.js → panel.js
var Guide = {};

(() => {
  const esc = (s) =>
    String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const el = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  };

  const unique = (arr) => [...new Set(arr)];

  // ---------- 網址和「現在在哪個網站」 ----------
  const GH = 'https://github.com';
  const RENDER = 'https://dashboard.render.com';
  const GA_URL = 'https://analytics.google.com/analytics/web/';
  const GSC_URL = 'https://search.google.com/search-console';
  const GTM_URL = 'https://tagmanager.google.com/';
  const SITEMAP_GEN_URL = 'https://www.xml-sitemaps.com/';
  const onGitHub = () => location.host === 'github.com';
  const onRender = () => location.host === 'dashboard.render.com';
  const onGA = () => location.host === 'analytics.google.com';
  const onGSC = () => location.host === 'search.google.com' && location.pathname.startsWith('/search-console');
  const onGTM = () => location.host === 'tagmanager.google.com';
  const onSitemapGen = () => location.host === 'www.xml-sitemaps.com';
  const onMySite = () => /\.(github\.io|onrender\.com)$/.test(location.host); // 你自己的網站

  // GitHub 在 <meta> 裡放了登入帳號和目前 repo 的資訊
  const meta = (name) => document.querySelector(`meta[name="${name}"]`)?.content || '';
  const user = () => (onGitHub() ? meta('user-login') : '');
  const currentRepo = () => (onGitHub() ? meta('octolytics-dimension-repository_nwo') : ''); // 例如 "帳號/repo名稱"
  const onRepo = () => !!currentRepo();
  const path = () => location.pathname;

  // GitHub 各頁面的網址規則，和要找的輸入框
  const NEW_REPO_PAGE = /^\/new\/?$/;
  const NEW_FILE_PAGE = /^\/[^/]+\/[^/]+\/new\//;
  const UPLOAD_PAGE = /^\/[^/]+\/[^/]+\/upload\//;
  const FILE_PAGE = /^\/[^/]+\/[^/]+\/blob\//;
  const SETTINGS_PAGE = /^\/[^/]+\/[^/]+\/settings/;
  const PAGES_SETTINGS = /^\/[^/]+\/[^/]+\/settings\/pages/;
  const DELETE_PAGE = /^\/[^/]+\/[^/]+\/delete\//;
  const ACTIONS_PAGE = /^\/[^/]+\/[^/]+\/actions/;
  const REPO_NAME_INPUT = 'input[aria-label="Repository name"], #repository-name-input, input[name="repository[name]"]';
  const FILE_NAME_INPUT = 'input[aria-label="File name"], input[placeholder="Name your file..."]';
  const RENDER_PUBLISH_DIR = 'input[placeholder="e.g. build"], input[name="publishPath"], input[name="staticPublishPath"]';

  // 擴充功能更新或重新載入後，舊頁面上的程式就不能再用 chrome.* 了
  const extensionAlive = () => {
    try {
      return !!chrome.runtime?.id;
    } catch {
      return false;
    }
  };

  // ---------- 狀態（會存在 chrome.storage，換頁、換網站都記得） ----------
  // course / step：選的教學和第幾步　repo：建好的 repo　site：你的網站網址
  // gaId / gtmId：在 GA、GTM 頁面上自動記下的 ID
  // autoNext：做完自動跳下一步（面板上的開關）
  // aiFind：找不到按鈕時請 AI 看畫面　aiFound：AI 找到的按鈕（同一頁不用再問，也是「改版紀錄」）
  // armed：哪一步已經看過「還沒完成」，之後變成完成才會自動跳（避免一進到某步就被跳過）
  // 注意：state 只能用 setState 改，不要整個換掉，其他檔案拿到的都是同一個物件
  const state = {
    course: 'pages-upload', step: 0, open: true, repo: '', site: '', gaId: '', gtmId: '', autoNext: true, armed: '',
    aiFind: true, aiFound: {},
  };
  Guide.stepShownAt = Date.now(); // 這一步開始顯示的時間（判斷「找不到按鈕」用）

  function setState(patch) {
    if (('step' in patch && patch.step !== state.step) || ('course' in patch && patch.course !== state.course)) {
      Guide.stepShownAt = Date.now();
      // 換步驟就重新開始判斷，不然按「上一步」回到做過的步驟時會馬上又被跳過去
      if (!('armed' in patch)) patch = { ...patch, armed: '' };
    }
    Object.assign(state, patch);
    if (extensionAlive()) {
      try {
        chrome.storage.local.set({ guideState: { ...state } });
      } catch {
        // 擴充功能剛被更新，存不了也沒關係，警告區會提醒重新整理
      }
    }
    Guide.render?.(); // 由 panel.js 提供
  }

  const repoUrl = (suffix = '') => (state.repo ? `${GH}/${state.repo}${suffix}` : null);
  const repoGitUrl = () => (state.repo ? `${GH}/${state.repo}` : `${GH}/帳號/repo名稱`);

  function siteUrl() {
    const [owner, repo] = state.repo.split('/');
    const name = (owner || user() || '你的帳號').toLowerCase();
    if (!repo || repo.toLowerCase() === `${name}.github.io`) return `https://${name}.github.io/`;
    return `https://${name}.github.io/${repo}/`;
  }

  // 你的網站網址：去過自己的網站就用記下來的，不然用 repo 推算 GitHub Pages 網址
  const mySiteUrl = () => state.site || (state.repo ? siteUrl() : '');

  // 目前選的教學和步驟（COURSES 在 courses.js）
  const course = () => Guide.COURSES.find((c) => c.id === state.course) || Guide.COURSES[0];
  const steps = () => course().steps;
  const currentStep = () => steps()[state.step] || steps()[0];

  Object.assign(Guide, {
    esc, el, unique,
    GH, RENDER, GA_URL, GSC_URL, GTM_URL, SITEMAP_GEN_URL,
    onGitHub, onRender, onGA, onGSC, onGTM, onSitemapGen, onMySite,
    meta, user, currentRepo, onRepo, path,
    NEW_REPO_PAGE, NEW_FILE_PAGE, UPLOAD_PAGE, FILE_PAGE, SETTINGS_PAGE, PAGES_SETTINGS, DELETE_PAGE, ACTIONS_PAGE,
    REPO_NAME_INPUT, FILE_NAME_INPUT, RENDER_PUBLISH_DIR,
    extensionAlive, state, setState,
    repoUrl, repoGitUrl, siteUrl, mySiteUrl,
    course, steps, currentStep,
  });
})();
