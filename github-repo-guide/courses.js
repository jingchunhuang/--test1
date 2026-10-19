// 教學內容：每一套教學的每一個步驟。要改步驟說明、加新教學，改這個檔案就好。
//
// 每一步的欄位：
//   title     標題
//   body      說明文字（可以用 <b>粗體</b>、<br> 換行、<small>小字</small>）
//   targets   要框起來的按鈕：{ text: '按鈕上的文字', tip: '提示' } 或 { selector: 'CSS 選擇器', tip: '提示' }
//             加 path: 網址規則 → 只在符合的 GitHub 頁面上找
//   page / pageName / goto   這一步該在哪個頁面做、頁面名稱、「帶我過去」的網址
//   where: 'vscode'          這一步在 VS Code 裡做（網頁上不會有標示）
//   usesRepo                 會用到剛建立的 repo
//   checkFileName / checkIndex / checkGaStream / checkGscPrefix   額外檢查（在 checks.js）
//   doneWhen: () => 條件      做完自動跳下一步：條件從「不成立」變成「成立」時跳（通常是網址變了）
//   targets 裡加 done: true   點了這個按鈕就算完成，自動跳下一步
//
// 最下面的 COURSES 是下拉選單裡的教學清單。
(() => {
  const {
    esc, GH, RENDER, GA_URL, GSC_URL, GTM_URL, SITEMAP_GEN_URL,
    onGitHub, onRender, onGA, onGSC, onGTM, onSitemapGen, onMySite,
    user, onRepo, path,
    NEW_REPO_PAGE, NEW_FILE_PAGE, UPLOAD_PAGE, FILE_PAGE, SETTINGS_PAGE, PAGES_SETTINGS, DELETE_PAGE, ACTIONS_PAGE,
    REPO_NAME_INPUT, FILE_NAME_INPUT, RENDER_PUBLISH_DIR,
    state, repoUrl, repoGitUrl, siteUrl, mySiteUrl,
  } = Guide;

  // 說明文字裡用的小工具
  const code = (s) => `<code>${esc(s)}</code>`;
  const copyBtn = (text, label = '複製') =>
    `<button class="gh-guide-copy" data-copy="${esc(text)}" data-label="${esc(label)}">${esc(label)}</button>`;

  const SAMPLE_HTML = `<!DOCTYPE html>
<html lang="zh-Hant">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>我的第一個網站</title>
</head>
<body>
  <h1>Hello！這是我的網站</h1>
  <p>用 GitHub Pages 架設。</p>
</body>
</html>
`;

  // ---------- 各個步驟 ----------
  // title/body：標題和說明　targets：要標示的按鈕（selector 用 CSS 選擇器找，text 用按鈕上的文字找）
  // page/pageName/goto：這一步該在哪個頁面做　where: 'vscode' 表示這一步在 VS Code 裡做
  // usesRepo：會用到剛建立的 repo　checkFileName / checkIndex：額外檢查
  const S = {
    openNew: {
      title: '打開「建立 repo」頁面',
      body: () => '點右上角的 <b>+</b> → <b>New repository</b>，或點綠色的 <b>New</b> 按鈕。',
      pageName: 'GitHub',
      page: onGitHub,
      goto: () => GH,
      doneWhen: () => onGitHub() && NEW_REPO_PAGE.test(path()),
      targets: [
        { selector: 'button[aria-label="Create something new"]', tip: '① 點「+」' },
        { selector: 'a[href="/new"]', tip: '點這裡建立新 repo' },
      ],
    },
    repoName: (forPages) => ({
      title: '取 repo 名稱',
      body: () => {
        const u = user() || '你的帳號';
        if (!forPages) {
          return '在 <b>Repository name</b> 輸入名稱，用英文、數字或 - 就好，例如 ' + code('my-website') + '。';
        }
        return (
          `在 <b>Repository name</b> 輸入名稱。repo 名稱也會變成網址的一部分：<br>` +
          `・取 ${code(`${u}.github.io`)} → 網址是 ${code(`https://${u.toLowerCase()}.github.io`)}<br>` +
          `・取別的名稱，例如 ${code('115SEO')} → 網址是 ${code(`https://${u.toLowerCase()}.github.io/115SEO`)}`
        );
      },
      pageName: '建立 repo 頁面',
      page: () => onGitHub() && NEW_REPO_PAGE.test(path()),
      goto: () => `${GH}/new`,
      targets: [{ path: NEW_REPO_PAGE, selector: REPO_NAME_INPUT, tip: '在這裡輸入名稱' }],
    }),
    publicReadme: {
      title: '設成 Public，並加上 README',
      body: () => '選 <b>Public</b>（免費帳號的 repo 要公開才能架網站），再打開 <b>Add README</b>。',
      pageName: '建立 repo 頁面',
      page: () => onGitHub() && NEW_REPO_PAGE.test(path()),
      goto: () => `${GH}/new`,
      targets: [
        { path: NEW_REPO_PAGE, text: 'Public', tip: '選 Public' },
        { path: NEW_REPO_PAGE, text: 'Add README', tip: '打開這個' },
        { path: NEW_REPO_PAGE, text: 'Add a README file', tip: '勾這個' },
      ],
    },
    createRepo: {
      title: '建立 repo',
      body: () => '按最下方的 <b>Create repository</b>。',
      pageName: '建立 repo 頁面',
      page: () => onGitHub() && NEW_REPO_PAGE.test(path()),
      goto: () => `${GH}/new`,
      doneWhen: onRepo,
      targets: [{ path: NEW_REPO_PAGE, text: 'Create repository', tip: '點這裡' }],
    },

    // 直接在 GitHub 上寫 index.html
    addNewFile: {
      title: '新增首頁檔案',
      body: () => 'repo 建好後，點 <b>Add file</b> → <b>Create new file</b>。',
      pageName: '你的 repo 首頁',
      page: () => onRepo() && !NEW_FILE_PAGE.test(path()),
      goto: () => repoUrl(),
      usesRepo: true,
      doneWhen: () => onGitHub() && NEW_FILE_PAGE.test(path()),
      targets: [
        { text: 'Add file', tip: '① 點 Add file' },
        { text: 'Create new file', tip: '② 點這個' },
      ],
    },
    pasteContent: {
      title: '貼上網頁內容',
      body: () =>
        `1. 檔名輸入 ${code('index.html')}（網站首頁一定要叫這個名字）<br>` +
        '2. 按下面的按鈕複製範例，貼到下方的大框框裡<br>' +
        copyBtn(SAMPLE_HTML, '複製範例 HTML'),
      pageName: '新增檔案頁面',
      page: () => onGitHub() && NEW_FILE_PAGE.test(path()),
      goto: () => repoUrl('/new/main'),
      usesRepo: true,
      checkFileName: true,
      targets: [{ path: NEW_FILE_PAGE, selector: FILE_NAME_INPUT, tip: '輸入 index.html' }],
    },
    commitNewFile: {
      title: '儲存檔案（Commit）',
      body: () => '點右上角的 <b>Commit changes...</b>，跳出視窗後再按一次 <b>Commit changes</b>。',
      pageName: '新增檔案頁面',
      page: () => onGitHub() && NEW_FILE_PAGE.test(path()),
      goto: () => repoUrl('/new/main'),
      usesRepo: true,
      doneWhen: () => onRepo() && !NEW_FILE_PAGE.test(path()),
      targets: [{ text: 'Commit changes', tip: '點這裡' }],
    },

    // 簡報方法 1：上傳電腦上的網站檔案
    uploadOpen: {
      title: '打開上傳頁面',
      body: () => '在 repo 首頁點 <b>Add file</b> → <b>Upload files</b>。',
      pageName: '你的 repo 首頁',
      page: () => onRepo() && !UPLOAD_PAGE.test(path()),
      goto: () => repoUrl(),
      usesRepo: true,
      doneWhen: () => onGitHub() && UPLOAD_PAGE.test(path()),
      targets: [
        { text: 'Add file', tip: '① 點 Add file' },
        { text: 'Upload files', tip: '② 點這個' },
      ],
    },
    uploadDrop: {
      title: '拖曳檔案並 Commit',
      body: () =>
        '1. 打開電腦上的網站資料夾，<b>全選資料夾「裡面」的東西</b>拖到上傳區<br>' +
        '<small>（不要拖整個資料夾，不然 index.html 會跑到資料夾裡，網站會 404）</small><br>' +
        '2. 下方 Commit changes 填一句說明，例如「上傳網站」<br>' +
        '3. 按 <b>Commit changes</b>',
      pageName: '上傳檔案頁面',
      page: () => onGitHub() && UPLOAD_PAGE.test(path()),
      goto: () => repoUrl('/upload/main'),
      usesRepo: true,
      doneWhen: () => onRepo() && !UPLOAD_PAGE.test(path()),
      targets: [{ path: UPLOAD_PAGE, text: 'Commit changes', tip: '檔案拖好後按這裡' }],
    },

    // 刪除檔案
    deleteOpen: {
      title: '打開要刪除的檔案',
      body: () => '在 repo 首頁點你要刪除的檔案，進入那個檔案的頁面。',
      pageName: '你的 repo',
      page: onRepo,
      goto: () => repoUrl(),
      usesRepo: true,
      doneWhen: () => onGitHub() && FILE_PAGE.test(path()),
      targets: [],
    },
    deleteFile: {
      title: '刪除檔案',
      body: () => '點右上角的 <b>⋯</b>（三個點）→ <b>Delete file</b>。',
      pageName: '檔案頁面',
      page: () => onGitHub() && FILE_PAGE.test(path()),
      usesRepo: true,
      targets: [
        { path: FILE_PAGE, selector: 'button[aria-label="More file actions"]', tip: '① 點 ⋯' },
        { path: FILE_PAGE, text: 'Delete file', tip: '② 點 Delete file' },
      ],
      doneWhen: () => onGitHub() && DELETE_PAGE.test(path()),
    },
    deleteCommit: {
      title: '確認刪除（Commit）',
      body: () => '點右上角的 <b>Commit changes...</b>，在跳出的視窗填說明，再按 <b>Commit changes</b>，才算刪除成功。',
      pageName: '刪除檔案頁面',
      page: onRepo,
      usesRepo: true,
      targets: [{ text: 'Commit changes', tip: '點這裡' }],
    },

    // 開啟 GitHub Pages
    settings: {
      title: '打開 Settings',
      body: () => '點 repo 上方的 <b>Settings</b>（齒輪圖示）。',
      pageName: '你的 repo 頁面',
      page: onRepo,
      goto: () => repoUrl(),
      usesRepo: true,
      checkIndex: true,
      doneWhen: () => onGitHub() && SETTINGS_PAGE.test(path()),
      targets: [{ selector: '#settings-tab, a[data-tab-item="settings-tab"]', tip: '點 Settings' }],
    },
    pagesMenu: {
      title: '打開 Pages 設定',
      body: () => '點左側選單的 <b>Pages</b>。',
      pageName: 'Settings 頁面',
      page: () => onGitHub() && SETTINGS_PAGE.test(path()),
      goto: () => repoUrl('/settings'),
      usesRepo: true,
      doneWhen: () => onGitHub() && PAGES_SETTINGS.test(path()),
      targets: [{ selector: 'a[href$="/settings/pages"]', tip: '點 Pages' }],
    },
    pagesSave: {
      title: '開啟 GitHub Pages',
      body: () =>
        '1. <b>Source</b> 選 <b>Deploy from a branch</b><br>' +
        '2. <b>Branch</b> 從 <b>None</b> 改成 <b>main</b>，旁邊保持 <b>/ (root)</b><br>' +
        '3. 按 <b>Save</b> 發布網站',
      pageName: 'Pages 設定頁面',
      page: () => onGitHub() && PAGES_SETTINGS.test(path()),
      goto: () => repoUrl('/settings/pages'),
      usesRepo: true,
      targets: [
        { path: PAGES_SETTINGS, text: 'None', tip: '改成 main' },
        { path: PAGES_SETTINGS, text: 'Save', tip: '按 Save', done: true },
      ],
    },
    actions: {
      title: '確認部署完成',
      body: () =>
        '點 repo 上方的 <b>Actions</b>：<br>' +
        '・最新一筆是綠色勾勾 ✅ → 部署好了<br>' +
        '・黃色圓圈 🟡 → 還在跑，等 1～2 分鐘<br>' +
        '・紅色叉叉 ❌ → 失敗了，可以按「問問題」',
      pageName: '你的 repo 頁面',
      page: onRepo,
      goto: () => repoUrl('/actions'),
      usesRepo: true,
      checkIndex: true,
      doneWhen: () => onGitHub() && ACTIONS_PAGE.test(path()),
      targets: [{ selector: '#actions-tab, a[data-tab-item="actions-tab"]', tip: '點 Actions' }],
    },
    visit: {
      title: '打開你的網站 🎉',
      body: () =>
        '回到 Settings → Pages，上方會顯示網址，點網址或 <b>Visit site</b>。<br>' +
        `你的網站：<a href="${esc(siteUrl())}" target="_blank" rel="noopener">${esc(siteUrl())}</a><br>` +
        '<small>出現 404：代表 repo 最外層沒有 index.html。之後改檔案再 Commit，網站會自動更新。</small>',
      pageName: 'Pages 設定頁面',
      page: () => onGitHub() && PAGES_SETTINGS.test(path()),
      goto: () => repoUrl('/settings/pages'),
      usesRepo: true,
      targets: [{ path: PAGES_SETTINGS, text: 'Visit site', tip: '點這裡看網站' }],
    },
  };

  // 簡報方法 2：VS Code + Git（這些步驟在 VS Code 裡做，畫面上沒有標示）
  const VSCODE_GIT = [
    {
      title: '安裝 Git',
      where: 'vscode',
      body: () =>
        '方法 2 要先安裝 Git。在 cmd 執行下面的指令，裝好後<b>關掉 VS Code 再重開</b>：<br>' +
        code('winget install --id Git.Git -e --source winget') +
        '<br>' +
        copyBtn('winget install --id Git.Git -e --source winget') +
        '<br><small>Mac 建議改用方法 1。</small>',
      targets: [],
    },
    {
      title: '設定 Git 的名字和 Email',
      where: 'vscode',
      body: () =>
        'VS Code 上方選 <b>View → Terminal</b> 打開終端機，輸入下面兩行（把引號裡換成你 GitHub 帳號的 Email 和要顯示的名字）：<br>' +
        code('git config --global user.email "你的Email"') +
        '<br>' +
        code('git config --global user.name "你的名字"') +
        '<br>' +
        copyBtn('git config --global user.email "你的Email"\ngit config --global user.name "你的名字"', '複製指令'),
      targets: [],
    },
    {
      title: '確認設定成功',
      where: 'vscode',
      body: () =>
        '輸入下面兩行，會顯示你剛剛設定的 Email 和名字：<br>' +
        code('git config --global user.email') +
        '<br>' +
        code('git config --global user.name') +
        '<br>' +
        copyBtn('git config --global user.email\ngit config --global user.name', '複製指令'),
      targets: [],
    },
    {
      title: '發布到 GitHub',
      where: 'vscode',
      body: () =>
        '1. 左上角 <b>File → Open Folder</b>，打開網站資料夾<br>' +
        '2. 左邊點 <b>Source Control</b>（分岔圖示）→ <b>Publish to GitHub</b><br>' +
        '3. 輸入 repo 名稱，選 <b>public</b><br>' +
        '4. 勾選要上傳的檔案，按 <b>OK</b>',
      targets: [],
    },
    {
      title: '到 GitHub 確認上傳成功',
      body: () => '打開 GitHub 上剛發布的 repo，確認檔案都在，而且 <b>index.html 在最外層</b>。',
      pageName: '你的 repo',
      page: onRepo,
      goto: () => repoUrl() || (user() ? `${GH}/${user()}?tab=repositories` : null),
      usesRepo: true,
      checkIndex: true,
      targets: [],
    },
    {
      title: '之後修改要怎麼上傳',
      where: 'vscode',
      body: () =>
        '改完檔案後：<br>' +
        '1. 左邊 <b>Source Control</b> 會出現 <b>Changes</b><br>' +
        '2. 上方填一句修改說明<br>' +
        '3. 點 <b>Commit</b> 旁邊的 <b>▼</b> → <b>Commit & Push</b>，跳出視窗按 <b>Yes</b><br>' +
        '<small>現在先接著做下一步，開啟 GitHub Pages。</small>',
      targets: [],
    },
  ];

  // 簡報的 Render 部署
  const RENDER_STEPS = [
    {
      title: '用 GitHub 登入 Render',
      body: () => `打開 <a href="${RENDER}/login" target="_blank" rel="noopener">Render 登入頁</a>，選 <b>GitHub</b> 登入。`,
      pageName: 'Render 網站',
      page: onRender,
      goto: () => `${RENDER}/login`,
      targets: [{ text: 'GitHub', tip: '用 GitHub 登入', done: true }],
    },
    {
      title: '建立專案',
      body: () => '選 <b>Create new project</b>，輸入專案名稱。',
      pageName: 'Render 網站',
      page: onRender,
      goto: () => RENDER,
      targets: [
        { text: 'Create new project', tip: '點這裡' },
        { text: 'New Project', tip: '點這裡' },
        { text: 'Create Project', tip: '輸入名稱後按這裡', done: true },
      ],
    },
    {
      title: '建立靜態網站服務',
      body: () => '選 <b>Create new service</b> → <b>Static Sites</b>。',
      pageName: 'Render 網站',
      page: onRender,
      goto: () => RENDER,
      targets: [
        { text: 'Create new service', tip: '① 點這裡' },
        { text: 'Static Sites', tip: '② 選 Static Sites', done: true },
        { text: 'New Static Site', tip: '② 選這個', done: true },
      ],
    },
    {
      title: '連接你的 repo',
      body: () =>
        '・repo 是 Public：選 <b>Public Git Repository</b>，貼上 repo 網址，按 <b>Connect</b><br>' +
        `${code(repoGitUrl())} ${copyBtn(repoGitUrl(), '複製網址')}<br>` +
        '・Public 或 Private 都可以：在 <b>Git Provider</b> 清單裡選你的 repo',
      pageName: 'Render 網站',
      page: onRender,
      goto: () => RENDER,
      targets: [
        { text: 'Public Git Repository', tip: '選這個' },
        { text: 'Connect', tip: '貼上網址後按這裡', done: true },
      ],
    },
    {
      title: '設定名稱並部署',
      body: () =>
        '1. <b>Name</b> 填網站名稱（會變成網址 名稱.onrender.com）<br>' +
        '2. 確認 <b>Branch</b> 是 <b>main</b><br>' +
        `3. <b>Publish Directory</b> 填 ${code('./')}（index.html 在 repo 最外層的意思）<br>` +
        '<small>　index.html 在資料夾裡的話，改填那個資料夾名稱，例如 <code>website</code></small><br>' +
        '4. 拉到最下面按 <b>Deploy Static Site</b>',
      pageName: 'Render 網站',
      page: onRender,
      goto: () => RENDER,
      targets: [
        { selector: RENDER_PUBLISH_DIR, tip: '填 ./' },
        { text: 'Deploy Static Site', tip: '按這裡部署', done: true },
      ],
    },
    {
      title: '打開你的網站 🎉',
      body: () =>
        '看到 <b>Your site is live</b> 就成功了。到部署頁面上方點 <b>xxx.onrender.com</b> 的網址打開網站。<br>' +
        '<small>之後上傳新版本到 GitHub，Render 會自動重新部署。</small>',
      pageName: 'Render 網站',
      page: onRender,
      goto: () => RENDER,
      targets: [{ selector: 'a[href*=".onrender.com"]', tip: '你的網站網址' }],
    },
    {
      title: '（選用）手動重新部署',
      body: () => '網站沒有更新時：點 <b>Manual Deploy</b> 旁邊的 <b>▼</b> → <b>Clear build cache & deploy</b>。',
      pageName: 'Render 網站',
      page: onRender,
      goto: () => RENDER,
      targets: [
        { text: 'Manual Deploy', tip: '① 點 ▼' },
        { text: 'Clear build cache', tip: '② 點這個' },
      ],
    },
  ];

  const VSCODE_SETUP = [
    {
      title: '安裝 VS Code',
      body: () =>
        `到 <a href="https://code.visualstudio.com/Download" target="_blank" rel="noopener">VS Code 官網</a>下載安裝。<br>` +
        '安裝時：選「我同意」→ 位置和選項都用預設，一直按 <b>Next</b> → <b>Install</b>。<br>' +
        '<small>學校電腦跳出權限視窗時按「是」。</small>',
      where: 'vscode',
      targets: [],
    },
    {
      title: '登入 GitHub 帳號',
      body: () =>
        '在 VS Code 選 <b>Continue with GitHub</b> 登入，瀏覽器跳出視窗時按 <b>Open</b>。<br>' +
        '左下角出現你的頭像就是登入成功。',
      where: 'vscode',
      targets: [],
    },
    {
      title: '安裝擴充功能',
      body: () =>
        '左邊點 <b>Extensions</b>（四個方塊的圖示），搜尋並安裝：<br>' +
        `・${code('preview on web server')}（預覽網頁用）<br>` +
        `・想要中文介面：${code('Chinese (Traditional) Language Pack')}`,
      where: 'vscode',
      targets: [],
    },
    {
      title: '建立 HTML 檔案',
      body: () =>
        '1. 左上角 <b>File → Open Folder</b>，打開網站資料夾<br>' +
        `2. 新增檔案，檔名要是「名稱 + .html」，首頁要叫 ${code('index.html')}<br>` +
        `3. 在檔案裡輸入 ${code('!')} 再按 <b>Enter</b>（或 <b>Tab</b>），會自動產生 HTML 基本架構`,
      where: 'vscode',
      targets: [],
    },
    {
      title: '預覽網頁',
      body: () => '在程式碼的空白處按右鍵 → <b>vscode-preview-server: Launch on browser</b>（preview on browser），就會用瀏覽器打開網頁。',
      where: 'vscode',
      targets: [],
    },
    {
      title: '開啟自動存檔',
      body: () => '左下角齒輪 → <b>Settings</b> → 把 <b>Auto Save</b> 改成 <b>afterDelay</b>，改了程式碼就會自動存檔。',
      where: 'vscode',
      targets: [],
    },
  ];

  // ---------- SEO 課程：GA、GSC、GTM、Sitemap（課堂簡報「連結 GA、GSC、GTM、sitemap」） ----------
  const gaSnippet = (id) => `<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=${id}"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());

  gtag('config', '${id}');
</script>`;
  const gtmHeadSnippet = (id) => `<!-- Google Tag Manager -->
<script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${id}');</script>
<!-- End Google Tag Manager -->`;
  const gtmBodySnippet = (id) => `<!-- Google Tag Manager (noscript) -->
<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=${id}"
height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>
<!-- End Google Tag Manager (noscript) -->`;

  // Google 的介面可能是中文或英文，兩種文字都找
  const both = (zh, en, tip) => [
    { text: zh, tip },
    { text: en, tip },
  ];
  const link = (url, text) => `<a href="${esc(url)}" target="_blank" rel="noopener">${esc(text)}</a>`;
  const siteLine = (withHttps = true) => {
    const url = mySiteUrl();
    if (!url) return '<small>（還不知道你的網站網址：先打開一次你的網站，擴充功能就會記下來）</small>';
    const shown = withHttps ? url : url.replace(/^https?:\/\//, '');
    return `${code(shown)} ${copyBtn(shown, '複製網址')}`;
  };

  const gaStep = (title, body, targets = [], extra = {}) => ({
    title, body, targets, pageName: 'Google Analytics', page: onGA, goto: () => GA_URL, ...extra,
  });
  const gscStep = (title, body, targets = [], extra = {}) => ({
    title, body, targets, pageName: 'Google Search Console', page: onGSC, goto: () => GSC_URL, ...extra,
  });
  const gtmStep = (title, body, targets = [], extra = {}) => ({
    title, body, targets, pageName: 'Google 代碼管理工具（GTM）', page: onGTM, goto: () => GTM_URL, ...extra,
  });
  const vsStep = (title, body) => ({ title, body, where: 'vscode', targets: [] });
  const siteCheckStep = (title, body) => ({
    title, body, targets: [], pageName: '你的網站', page: onMySite, goto: () => mySiteUrl() || null,
  });
  // 改好檔案後上傳到 GitHub（沿用上傳教學的步驟）
  const uploadSteps = (what) => [
    {
      ...S.uploadOpen,
      title: `把${what}上傳到 GitHub`,
      body: () =>
        S.uploadOpen.body() +
        '<br><small>用 VS Code + Git 的話：Source Control → Commit & Push，做完直接按兩次「下一步」。</small>',
    },
    {
      ...S.uploadDrop,
      title: '拖曳改過的檔案並 Commit',
      body: () =>
        '1. 把改過的檔案拖進上傳區（同名檔案會被取代）<br>2. 按 <b>Commit changes</b><br>' +
        '3. 等 1～3 分鐘部署完成（GitHub Pages 和 Render 都會自動更新）',
    },
  ];

  // GA 建立帳戶的畫面上方有 5 個階段：建立帳戶 → 建立資源 → 商家詳細資料 → 業務目標 → 資料收集
  // 這裡的步驟跟那 5 個階段一一對應；按了框起來的「下一步」就自動跳到下一個階段
  const GA_CREATE_PAGE = () => onGA() && /\/admin\/(account|property)\/create/.test(location.hash);
  const gaNext = (tip = '填好後按這裡') => both('下一步', 'Next', tip).map((t) => ({ ...t, done: true }));
  const GA_SETUP = [
    gaStep(
      '打開「建立帳戶」',
      () =>
        `打開 ${link(GA_URL, 'Google Analytics')}，左下角點 <b>管理</b>（齒輪）→ 左上角 <b>建立</b> → <b>帳戶</b>。<br>` +
        '<small>畫面上方出現「建立帳戶 → 建立資源 → … → 資料收集」5 個階段，就是對的頁面。</small>',
      [],
      { doneWhen: GA_CREATE_PAGE }
    ),
    gaStep(
      '① 建立帳戶',
      () => '<b>帳戶名稱</b>填公司或團隊名稱（例如課程名稱），下面的資料共用設定照預設就好，按 <b>下一步</b>。',
      [
        { selector: 'input[aria-label*="帳戶名稱"], input[aria-label*="Account name"]', tip: '填帳戶名稱' },
        ...gaNext(),
      ]
    ),
    gaStep(
      '② 建立資源',
      () =>
        '1. <b>屬性名稱</b>（資源名稱）填你的<b>網站名稱</b>，要 <b>4～100 個字元</b>，太短會顯示紅字<br>' +
        '2. <b>報表時區</b>選台灣，<b>貨幣</b>選新台幣（通常已經選好）<br>' +
        '3. 按 <b>下一步</b>',
      [
        {
          selector:
            'input[aria-label*="屬性名稱"], input[aria-label*="資源名稱"], input[aria-label*="Property name"]',
          tip: '填網站名稱（至少 4 個字）',
        },
        ...gaNext(),
      ]
    ),
    gaStep(
      '③ 商家詳細資料',
      () => '選<b>產業類別</b>和<b>商家規模</b>（照實際情況選，練習用的話隨便選一個也可以），按 <b>下一步</b>。',
      gaNext('選好後按這裡')
    ),
    gaStep(
      '④ 業務目標',
      () =>
        '1. 勾選你想達成的目標（練習用可以選「取得基準報表」）<br>' +
        '2. 按 <b>建立</b><br>' +
        '3. 跳出服務條款：國家選<b>台灣</b>，勾選同意，按 <b>我接受</b>',
      [
        { ...both('建立', 'Create', '② 按建立')[0], exact: true },
        { ...both('建立', 'Create', '② 按建立')[1], exact: true },
        ...both('我接受', 'I Accept', '③ 同意條款').map((t) => ({ ...t, done: true })),
      ]
    ),
    gaStep(
      '⑤ 資料收集：建立網站資料串流',
      () =>
        '1. 平台選 <b>網站</b><br>' +
        `2. 網址貼上你的網站網址，<b>前面的 https:// 要刪掉</b>（欄位前面已經有 https:// 選單）：<br>${siteLine(false)}<br>` +
        '<small>要填實際的網站網址，不要貼後台網址（github.com/… 或 dashboard.render.com）</small><br>' +
        '3. 輸入串流名稱（例如網站名稱），按 <b>建立並繼續</b>（或 <b>建立串流</b>）',
      [
        { text: '網站', tip: '① 選網站', exact: true },
        { text: 'Web', tip: '① 選網站', exact: true },
        ...both('建立並繼續', 'Create & continue', '③ 按這裡').map((t) => ({ ...t, done: true })),
        ...both('建立串流', 'Create stream', '③ 按這裡').map((t) => ({ ...t, done: true })),
      ],
      { checkGaStream: true }
    ),
    gaStep('完成設定 🎉', () =>
      '會跳出「安裝操作說明」視窗，先關掉就好（下一套教學「在網站安裝 GA 追蹤碼」會再用到）。<br>' +
      '畫面上的<b>評估 ID</b>（G- 開頭）擴充功能會自動記下來。' +
      (state.gaId ? `<br>已記下：${code(state.gaId)}` : '')),
  ];

  const GA_INSTALL = [
    gaStep(
      '打開資料串流',
      () => 'GA 左下角 <b>管理</b> → <b>資料收集和修改</b> → <b>資料串流</b>，點你的網站串流。',
      both('資料串流', 'Data streams', '點這裡')
    ),
    gaStep(
      '複製 Google 代碼',
      () =>
        '點 <b>查看代碼操作說明</b> → <b>手動安裝</b>，複製整段程式碼。' +
        (state.gaId ? `<br>擴充功能已經記下你的評估 ID：${code(state.gaId)}` : ''),
      both('查看代碼操作說明', 'View tag instructions', '點這裡')
    ),
    vsStep('貼到每個網頁的 <head>', () =>
      '在 VS Code 打開網站資料夾，把程式碼貼到<b>每一個</b> .html 檔的 <code>&lt;head&gt;</code> 裡面（緊接在 <code>&lt;head&gt;</code> 後面）。<br>' +
      (state.gaId
        ? `${copyBtn(gaSnippet(state.gaId), `複製 GA 程式碼（${state.gaId}）`)}<br><small>跟 GA 上「手動安裝」的程式碼一樣</small>`
        : '<small>從 GA 複製；或先打開 GA 的資料串流頁面，擴充功能記下評估 ID 後，這裡會出現複製按鈕</small>')),
    ...uploadSteps('加了 GA 程式碼的檔案'),
    siteCheckStep('確認安裝成功', () =>
      '打開你的網站，看面板上的 <b>🔍 網站檢查</b>，GA 追蹤碼那一行出現 ✅ 就成功了。<br>' +
      `也可以照簡報安裝 ${link('https://chromewebstore.google.com/detail/tag-assistant/kejbdjndbnbjgmefkgdddjlbokphdefk', 'Tag Assistant')}：` +
      '右上角拼圖圖示 → Tag Assistant，右下角出現你的評估 ID 就成功。'),
  ];

  const GSC_LINK = [
    gscStep(
      '新增資源',
      () => `打開 ${link(`${GSC_URL}/about`, 'Google Search Console')}，按 <b>立即開始</b>，左上角資源選單 → <b>新增資源</b>。`,
      both('新增資源', 'Add property', '點這裡')
    ),
    gscStep(
      '選「網址前置字元」',
      () =>
        `右邊選 <b>網址前置字元</b>，輸入<b>完整的網站網址</b>（這裡要有 https://），按 <b>繼續</b>：<br>${siteLine(true)}`,
      both('網址前置字元', 'URL prefix', '選這個'),
      { checkGscPrefix: true }
    ),
    gscStep('完成驗證', () =>
      '網站已經裝了 GA 追蹤碼，所以會<b>自動驗證</b>，按 <b>前往資源</b>。資料大約要 1～2 天才會出現。<br>' +
      '<small>驗證失敗：先做完「安裝 GA 追蹤碼」教學，確認網站上找得到 GA 程式碼。</small>'),
    gaStep(
      '在 GA 打開 Search Console 連結',
      () => '回到 GA，左下角 <b>管理</b> → 往下找到 <b>產品連結</b> → <b>Search Console 連結</b>。',
      both('Search Console 連結', 'Search Console links', '點這裡')
    ),
    gaStep('選擇 GSC 資源', () =>
      '右上角 <b>連結</b> → <b>選擇帳戶</b> → 勾選你網站網址的 GSC 資源 → <b>確認</b> → <b>下一步</b>。'),
    gaStep(
      '選擇資料串流並提交',
      () => '點 <b>選取</b> → 選你的網站資料串流 → <b>下一步</b> → <b>提交</b>。顯示「已建立連結」就成功了。',
      both('提交', 'Submit', '最後按這裡')
    ),
  ];

  const GTM_INSTALL = [
    gtmStep(
      '建立 GTM 帳戶',
      () =>
        `打開 ${link(GTM_URL, 'Google 代碼管理工具')}，右上角 <b>建立帳戶</b>，輸入公司名稱和網站名稱，按 <b>建立</b>，再同意服務條款。`,
      both('建立帳戶', 'Create Account', '點這裡')
    ),
    gtmStep(
      '找到安裝程式碼',
      () =>
        '會跳出視窗，裡面有兩段程式碼：一段放 <code>&lt;head&gt;</code>、一段放 <code>&lt;body&gt;</code>。<br>' +
        '<small>不小心關掉了：點右上角的 GTM-XXXX（GTM ID）就能再叫出來。</small>' +
        (state.gtmId ? `<br>擴充功能已經記下你的 GTM ID：${code(state.gtmId)}` : ''),
      [{ text: 'GTM-', tip: '點這裡叫出程式碼' }]
    ),
    vsStep('貼上 <head> 的程式碼', () =>
      '每個網頁的 <code>&lt;head&gt;</code> 標籤<b>下方</b>，貼上第一段（<code>&lt;!-- Google Tag Manager --&gt;</code> 開頭）。<br>' +
      (state.gtmId
        ? copyBtn(gtmHeadSnippet(state.gtmId), `複製 <head> 程式碼（${state.gtmId}）`)
        : '<small>從 GTM 複製；或先打開 GTM，擴充功能記下 GTM ID 後，這裡會出現複製按鈕</small>')),
    vsStep('貼上 <body> 的程式碼', () =>
      '每個網頁的 <code>&lt;body&gt;</code> 標籤<b>下方</b>，貼上第二段（<code>&lt;noscript&gt;</code> 那段）。<br>' +
      (state.gtmId
        ? copyBtn(gtmBodySnippet(state.gtmId), `複製 <body> 程式碼（${state.gtmId}）`)
        : '<small>從 GTM 複製第二段程式碼</small>')),
    ...uploadSteps('加了 GTM 程式碼的檔案'),
    siteCheckStep('確認 GTM 有執行', () =>
      '打開你的網站，看面板上的 <b>🔍 網站檢查</b>，GTM 的兩行都出現 ✅ 就成功了。也可以用 Tag Assistant 檢查。'),
  ];

  const GTM_GA = [
    gaStep(
      '複製 GA 評估 ID',
      () =>
        'GA 左下角 <b>管理</b> → <b>資料串流</b> → 點第一個串流右邊的箭頭，複製 <b>評估 ID</b>（G- 開頭）。' +
        (state.gaId ? `<br>已記下：${code(state.gaId)} ${copyBtn(state.gaId)}` : ''),
      both('資料串流', 'Data streams', '點這裡')
    ),
    gtmStep(
      '把評估 ID 存成常數變數',
      () =>
        '1. 左邊 <b>變數</b> → 使用者定義的變數 <b>新增</b><br>' +
        '2. 左上角名稱改成「GA 評估 ID」<br>' +
        '3. 點中間選變數類型 → 往下選 <b>常數</b><br>' +
        '4. 值貼上評估 ID → 右上角 <b>儲存</b>',
      both('變數', 'Variables', '① 點變數')
    ),
    gtmStep(
      '新增「網頁瀏覽」代碼',
      () => '左邊 <b>代碼</b> → <b>新增</b> → 代碼設定選 <b>Google Analytics</b> → <b>Google Analytics：GA4 事件</b>。',
      both('代碼', 'Tags', '① 點代碼')
    ),
    gtmStep('設定評估 ID', () =>
      '點評估 ID 右邊的<b>積木圖示</b>，選剛建立的「GA 評估 ID」常數。<br>' +
      '<small>顯示「找不到 Google 代碼」：點右邊 <b>建立代碼</b>，命名「GA 評估 ID」後儲存。</small>'),
    gtmStep('事件名稱和觸發條件', () =>
      '1. 事件名稱照功能取，例如 <code>GA_網頁瀏覽</code><br>' +
      '2. 下方 <b>觸發條件</b> 選 <b>All Pages</b>（所有網頁）<br>' +
      '3. 幫代碼取名，右上角 <b>儲存</b>'),
    gtmStep(
      '提交並發布',
      () => '右上角 <b>提交</b> → <b>發布</b>，設定才會正式生效。<b>沒發布的話，網站上不會有效果。</b>',
      both('提交', 'Submit', '點這裡')
    ),
    gtmStep(
      '預覽測試',
      () => `右上角 <b>預覽</b>，貼上網站網址，會打開網站測試頁和 GTM 預覽區（偵錯模式）：<br>${siteLine(true)}`,
      both('預覽', 'Preview', '點這裡')
    ),
    gaStep('在 GA 即時報表確認', () =>
      'GA 左邊 <b>報表</b> → <b>即時總覽</b>，事件計數會出現剛設定的 <code>GA_網頁瀏覽</code>。<br>' +
      '<small>要先在網站上觸發（打開網頁）才會出現。</small>'),
    gtmStep('新增「頁面捲動」代碼', () =>
      '照前面的步驟再新增一個代碼：<br>・代碼名稱：<code>GA 頁面捲動</code><br>・事件名稱：<code>GA_頁面捲動超過50%</code>'),
    gtmStep('設定捲動觸發條件', () =>
      '1. 觸發條件右上角 <b>+</b> → 選觸發條件類型 <b>捲動深度</b><br>' +
      '2. 勾 <b>垂直捲動深度</b>，百分比填 <code>50</code><br>' +
      '3. 左上角幫觸發條件取名 → 右上角 <b>儲存</b>'),
    gtmStep('提交、預覽、到 GA 確認', () =>
      '儲存代碼 → 右上角 <b>提交</b> → 用預覽確認代碼有觸發 → 到 GA 即時總覽看資料。<br>' +
      '<small>沒出現：可能網頁太短，捲不到 50%。把百分比調低，或把網頁內容加長。</small>'),
  ];

  const SITEMAP = [
    {
      title: '產生 Sitemap',
      body: () =>
        `打開 ${link(SITEMAP_GEN_URL, 'xml-sitemaps.com')}，輸入你的網站網址，按 <b>Generate XML Sitemap</b>（START）：<br>${siteLine(true)}`,
      pageName: 'xml-sitemaps.com',
      page: onSitemapGen,
      goto: () => SITEMAP_GEN_URL,
      targets: [],
    },
    {
      title: '下載 sitemap.xml',
      body: () => '完成後選 <b>View Sitemap Details</b>，下載 <code>sitemap.xml</code>。',
      pageName: 'xml-sitemaps.com',
      page: onSitemapGen,
      goto: () => SITEMAP_GEN_URL,
      targets: [],
    },
    vsStep('放到網站資料夾最外層', () =>
      '把下載的 <code>sitemap.xml</code> 放到網站專案資料夾的<b>最外層</b>（跟 index.html 同一層），檔名不要改。'),
    ...uploadSteps(' sitemap.xml '),
    siteCheckStep('確認網站上有 sitemap.xml', () =>
      '打開你的網站，看面板上的 <b>🔍 網站檢查</b>，sitemap.xml 那一行出現 ✅ 就對了。'),
    gscStep(
      '在 GSC 提交 Sitemap',
      () =>
        '左邊 <b>Sitemap</b> → 右邊「新增 Sitemap」輸入 <code>sitemap.xml</code> → <b>提交</b>。<br>' +
        '狀態顯示 <b>成功</b> 就完成了。<br>' +
        '<small>顯示「無法讀取」：確認 robots.txt 設定正確，過幾天可能就讀得到了。</small>',
      both('Sitemap', 'Sitemaps', '點這裡')
    ),
  ];

  const INDEXING = [
    gscStep(
      '網址審查',
      () => `GSC 上方的搜尋列（<b>網址審查</b>）輸入網站網址，按 Enter：<br>${siteLine(true)}`,
      both('網址審查', 'URL inspection', '點這裡')
    ),
    gscStep(
      '測試線上網址',
      () => '按 <b>測試線上網址</b>，確認網頁可以被 Google 建立索引。',
      both('測試線上網址', 'Test live URL', '點這裡')
    ),
    gscStep(
      '要求建立索引',
      () =>
        '測試成功後按 <b>要求建立索引</b>。<br>' +
        '<small>這只是告訴 Google 你想被收錄，速度還是看 Google 的爬蟲。<b>按很多次不會比較快，還可能被限制提交次數。</b></small>',
      both('要求建立索引', 'Request indexing', '按一次就好')
    ),
  ];

  const ADMIN = [
    gaStep(
      'GA：新增管理員',
      () =>
        '左下角齒輪 <b>管理</b> → 帳戶的 <b>帳戶存取管理</b> → 右上角 <b>+</b> → 新增使用者，輸入對方的 Email，角色選 <b>管理員</b>。<br>' +
        '<small>要加誰的 Email 請看課堂公告。</small>',
      both('帳戶存取管理', 'Account access management', '點這裡')
    ),
    gscStep(
      'GSC：新增使用者',
      () => '左邊 <b>設定</b> → <b>使用者和權限</b> → <b>新增使用者</b>，輸入 Email，選課堂要求的權限。',
      both('使用者和權限', 'Users and permissions', '點這裡')
    ),
    gtmStep(
      'GTM：新增使用者',
      () => '上方 <b>管理</b> 分頁 → 容器的 <b>使用者管理</b> → 右上角 <b>+</b> → 新增使用者，輸入 Email，選課堂要求的權限。',
      both('使用者管理', 'User Management', '點這裡')
    ),
  ];

  const PAGES_STEPS = [S.settings, S.pagesMenu, S.pagesSave, S.actions, S.visit];
  const CREATE_REPO = [S.openNew, S.repoName(true), S.publicReadme, S.createRepo];

  // 可以選擇的教學（needsPublic：要開 GitHub Pages，repo 必須是 Public）
  const COURSES = [
    {
      id: 'pages-upload',
      title: 'GitHub Pages 方法 1：網頁上傳（推薦）',
      needsPublic: true,
      steps: [...CREATE_REPO, S.uploadOpen, S.uploadDrop, ...PAGES_STEPS],
    },
    {
      id: 'pages-vscode',
      title: 'GitHub Pages 方法 2：VS Code + Git',
      needsPublic: true,
      steps: [...VSCODE_GIT, ...PAGES_STEPS],
    },
    {
      id: 'render',
      title: 'Render：上傳後部署靜態網站',
      steps: [...CREATE_REPO.slice(0, 1), S.repoName(false), ...CREATE_REPO.slice(2), S.uploadOpen, S.uploadDrop, ...RENDER_STEPS],
    },
    {
      id: 'update-delete',
      title: '更新或刪除 repo 裡的檔案',
      steps: [
        { ...S.uploadOpen, title: '更新或新增檔案：打開上傳頁面' },
        { ...S.uploadDrop, title: '拖曳檔案並 Commit（同名檔案會被取代）' },
        S.deleteOpen,
        S.deleteFile,
        S.deleteCommit,
      ],
    },
    {
      id: 'create-file',
      title: '直接在 GitHub 上寫 index.html',
      needsPublic: true,
      steps: [...CREATE_REPO, S.addNewFile, S.pasteContent, S.commitNewFile, ...PAGES_STEPS],
    },
    {
      id: 'vscode-setup',
      title: '準備：安裝和設定 VS Code',
      steps: VSCODE_SETUP,
    },
    { id: 'ga-setup', group: 'seo', title: '1. GA 申請與設定', steps: GA_SETUP },
    { id: 'ga-install', group: 'seo', title: '2. 在網站安裝 GA 追蹤碼', steps: GA_INSTALL },
    { id: 'gsc-link', group: 'seo', title: '3. GSC 新增網站並連結 GA', steps: GSC_LINK },
    { id: 'gtm-install', group: 'seo', title: '4. 在網站安裝 GTM', steps: GTM_INSTALL },
    { id: 'gtm-ga', group: 'seo', title: '5. GTM 連接 GA（網頁瀏覽、捲動事件）', steps: GTM_GA },
    { id: 'sitemap', group: 'seo', title: '6. 建立並提交 Sitemap', steps: SITEMAP },
    { id: 'indexing', group: 'seo', title: '7. 要求 Google 建立索引', steps: INDEXING },
    { id: 'admin', group: 'seo', title: '8. 新增 GA、GSC、GTM 管理員', steps: ADMIN },
  ];
  const COURSE_GROUPS = [
    { id: undefined, label: '架網站：GitHub Pages / Render' },
    { id: 'seo', label: 'SEO：GA / GSC / GTM / Sitemap' },
    { id: 'custom', label: '我的教學（用截圖產生）' },
  ];

  // ---------- 用截圖做的教學（maker.html 存在 chrome.storage 的 customCourses） ----------
  // 存的是純資料：{ id, title, steps: [{ title, body, buttons: ['按鈕文字'], url }] }，在這裡換成一般步驟的格式
  const attr = (s) => s.replace(/["\\]/g, '\\$&');
  const hostOf = (url) => {
    try {
      return new URL(url).host;
    } catch {
      return '';
    }
  };

  function customStep(s) {
    const buttons = (s.buttons || []).filter(Boolean);
    const host = hostOf(s.url);
    return {
      title: s.title || '（沒有標題）',
      body: () => esc(s.body || '').replace(/\n/g, '<br>'),
      ...(host ? { pageName: host, page: () => location.host === host, goto: () => s.url } : {}),
      // 按鈕用文字找；輸入框沒有文字，再用 placeholder / aria-label 找。最後一個按鈕點了就算完成
      targets: buttons.flatMap((text, i) => {
        const tip = buttons.length > 1 ? `${i + 1}. 點「${text}」` : `點「${text}」`;
        const done = i === buttons.length - 1;
        return [
          { text, tip, done },
          { selector: `[placeholder="${attr(text)}"], input[aria-label="${attr(text)}"]`, tip: `在這裡填寫`, done },
        ];
      }),
    };
  }

  Guide.setCustomCourses = (list = []) => {
    for (let i = COURSES.length - 1; i >= 0; i--) if (COURSES[i].group === 'custom') COURSES.splice(i, 1);
    for (const c of list) {
      if (!c?.steps?.length) continue;
      COURSES.push({ id: `custom:${c.id}`, group: 'custom', title: c.title || '我的教學', steps: c.steps.map(customStep) });
    }
  };

  Guide.COURSES = COURSES;
  Guide.COURSE_GROUPS = COURSE_GROUPS;
})();
