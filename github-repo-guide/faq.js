// 常見問題清單：想讓擴充功能會回答更多問題，就在這裡加題目。
// q：問題標題　keywords：使用者的問題裡出現這些字就算符合（越多個符合越優先）　a：回答
// 改完後到 chrome://extensions 按「重新載入」，再重新整理 GitHub 頁面。
const GUIDE_FAQ = [
  {
    q: '自訂網域說格式不符',
    keywords: ['網域', 'domain', '自訂網址', '自定義網址', '格式不符', '格式不對', 'not valid', 'invalid'],
    a:
      'Custom domain 只能填網域本身，例如 www.example.com 或 example.com。\n' +
      '・不要加 https:// 或 http://\n' +
      '・結尾不要加 /，也不要加路徑（例如 /index.html）\n' +
      '・不能有空格或中文\n' +
      '・不能填 xxx.github.io（那是 GitHub 給的網址，本來就能用）\n' +
      '網域必須是你已經跟網域商買好的，然後還要設定 DNS（可以問「DNS 怎麼設」）。',
  },
  {
    q: 'DNS 怎麼設定',
    keywords: ['dns', 'cname', 'a 記錄', 'a record', '網域商', '指向'],
    a:
      '到你買網域的網站（網域商）找 DNS 設定：\n' +
      '・用 www.example.com：新增一筆 CNAME，名稱 www，值填「你的帳號.github.io」\n' +
      '・用 example.com（沒有 www）：新增 4 筆 A 記錄，值分別是\n' +
      '  185.199.108.153\n  185.199.109.153\n  185.199.110.153\n  185.199.111.153\n' +
      '設好後回 GitHub 的 Settings → Pages 填 Custom domain、按 Save。DNS 生效要幾分鐘到 24 小時。',
  },
  {
    q: '自訂網域設好了但打不開、DNS check 失敗',
    keywords: ['dns check', 'unsuccessful', '網域打不開', '網域沒反應', 'enforce https', '不安全', '憑證'],
    a:
      '1. DNS 剛設定要等，最久可能 24 小時\n' +
      '2. 檢查 DNS 是否跟「DNS 怎麼設定」裡寫的一樣，不要有多餘的舊記錄\n' +
      '3. 如果用 Cloudflare，先把那幾筆記錄的橘色雲朵（Proxy）關掉，改成灰色\n' +
      '4. DNS check 成功後，等一下再勾 Enforce HTTPS，網站就會有安全鎖頭',
  },
  {
    q: '網站顯示 404',
    keywords: ['404', 'not found', '打不開', '找不到網站', '看不到網站', '開不起來'],
    a:
      '1. 剛開 Pages 要等 1～3 分鐘\n' +
      '2. repo 裡要有 index.html，檔名全部小寫，而且要放在最外層（不能在資料夾裡）\n' +
      '   上傳時如果把整個資料夾拖進去，index.html 會跑到資料夾裡，要改成拖資料夾「裡面」的檔案\n' +
      '3. Settings → Pages 的 Branch 要選 main，資料夾選 / (root)，並按過 Save\n' +
      '4. 網址要對：repo 叫「帳號.github.io」的話網址是 https://帳號.github.io，其他名稱是 https://帳號.github.io/repo名稱/\n' +
      '5. 到 repo 的 Actions 分頁看有沒有紅色叉叉（代表發布失敗）',
  },
  {
    q: 'repo 名稱已經被用過',
    keywords: ['already exists', '已經存在', '名稱被用', '名稱已', '重複', '同名', '用過了'],
    a:
      '你的帳號裡已經有同名的 repo。可以：\n' +
      '・換一個名稱\n' +
      '・或直接去用那個舊的 repo（點右上角頭像 → Your repositories 找它）\n' +
      '・不要了的話，到那個 repo 的 Settings 最下方 Delete this repository 刪掉',
  },
  {
    q: '找不到 Pages 設定',
    keywords: ['找不到 pages', '沒有 pages', 'pages 在哪', 'pages 選項', 'pages 設定'],
    a:
      '1. 先進入你的 repo，點上方的 Settings（齒輪）\n' +
      '2. 左側選單往下找「Code and automation」區塊裡的 Pages\n' +
      '3. 看不到 Settings 的話，代表你不是這個 repo 的擁有者，或視窗太窄（Settings 被收進「⋯」選單）',
  },
  {
    q: 'Private repo 可以架網站嗎',
    keywords: ['private', '私人', '私密', 'upgrade', '升級', '改成公開', '公開'],
    a:
      '免費帳號只有 Public repo 可以用 GitHub Pages。\n' +
      '改成公開：repo 的 Settings → 最下方 Danger Zone → Change visibility → Make public。',
  },
  {
    q: '改了檔案但網站沒更新',
    keywords: ['沒更新', '沒有更新', '舊的', '快取', 'cache', '沒變'],
    a:
      '1. 每次 Commit 後要等 1～3 分鐘\n' +
      '2. 按 Ctrl + F5 強制重新整理（瀏覽器可能還在用舊的）\n' +
      '3. 到 repo 的 Actions 分頁，確認最新那筆是綠色勾勾',
  },
  {
    q: '要等多久網站才會上線',
    keywords: ['多久', '要等', '上線', 'live', '什麼時候'],
    a: '通常 1～3 分鐘。Settings → Pages 上方出現「Your site is live at ...」就代表上線了。',
  },
  {
    q: '我的網站網址是什麼',
    keywords: ['網址', 'url', '連結', '網站在哪'],
    a:
      '・repo 名稱是「帳號.github.io」：https://帳號.github.io\n' +
      '・其他名稱：https://帳號.github.io/repo名稱/\n' +
      '（帳號要全部小寫。Settings → Pages 上方也會顯示網址）',
  },
  {
    q: '檔名一定要 index.html 嗎',
    keywords: ['index', '檔名', '首頁', '檔案名稱'],
    a:
      '對，網站首頁一定要叫 index.html：全部小寫、沒有空格、副檔名是 .html。\n' +
      'Index.html、index.htm、index.html.txt 都不行。其他頁面可以取別的名字，例如 about.html。',
  },
  {
    q: '怎麼放圖片或 CSS',
    keywords: ['圖片', '照片', 'css', '樣式', '上傳', 'upload', '圖'],
    a:
      '1. 在 repo 首頁點 Add file → Upload files，把圖片或 .css 檔拖進去，按 Commit changes\n' +
      '2. 在 index.html 裡用檔名引用，例如：\n' +
      '  圖片：<img src="cat.jpg">\n' +
      '  CSS：<link rel="stylesheet" href="style.css">\n' +
      '檔名大小寫要完全一樣。',
  },
  {
    q: '怎麼修改網站內容',
    keywords: ['修改', '編輯', '改內容', '改網站', 'edit', '鉛筆'],
    a: '在 repo 裡點 index.html → 右上角的鉛筆圖示 → 修改 → Commit changes。等 1～3 分鐘網站就會更新。',
  },
  {
    q: 'Commit 是什麼',
    keywords: ['commit', '提交', '存檔', '儲存'],
    a: 'Commit 就是「存檔」，而且會留下紀錄。在 GitHub 改完檔案一定要按 Commit changes，改的東西才會存進 repo。',
  },
  {
    q: 'README 是什麼',
    keywords: ['readme'],
    a: 'README.md 是 repo 的說明檔，會顯示在 repo 首頁下方。架網站不一定需要，但建立 repo 時加上它，repo 一開始才不會是空的。',
  },
  {
    q: 'Branch 選不到 main',
    keywords: ['選不到 main', '沒有 main', 'main 分支', 'branch', '分支', 'master'],
    a:
      '・Branch 下拉選單裡沒有 main：repo 可能是空的，先新增一個檔案（例如 index.html）並 Commit\n' +
      '・只看到 master：舊的 repo 預設叫 master，直接選 master 就好',
  },
  {
    q: '找不到建立 repo 的按鈕',
    keywords: ['加號', 'new repository', '建立 repo', '新增 repo', '創 repo', '找不到按鈕'],
    a: '直接在網址列輸入 github.com/new 就能打開建立頁面。右上角的「+」在視窗太窄時會被收起來，把視窗拉寬就會出現。',
  },
  {
    q: 'repo 怎麼改名',
    keywords: ['改名', 'rename', '重新命名', '改名稱'],
    a: 'repo 的 Settings → 最上方 Repository name 改好後按 Rename。注意：網站網址也會跟著改變。',
  },
  {
    q: 'repo 怎麼刪除',
    keywords: ['刪除 repo', '刪掉 repo', 'delete repo', '刪除', '刪掉'],
    a: 'repo 的 Settings → 最下方 Danger Zone → Delete this repository。刪了就救不回來，要先確認裡面沒有要留的東西。',
  },
  {
    q: 'GitHub Pages 要錢嗎',
    keywords: ['要錢', '免費', '費用', '收費', '付費', '多少錢'],
    a: 'GitHub Pages 免費（Public repo）。只有自訂網域要另外跟網域商買，一年通常幾百元台幣起。',
  },
  {
    q: '可以用電腦上的 git 上傳嗎',
    keywords: ['git push', 'git clone', 'push', 'clone', '電腦上的檔案', '本機'],
    a:
      '可以。先安裝 Git，然後在 cmd：\n' +
      '  git clone https://github.com/帳號/repo名稱.git\n' +
      '把網頁檔案放進那個資料夾，再執行：\n' +
      '  git add .\n  git commit -m "更新網站"\n  git push',
  },
  // ---------- 以下來自課堂簡報「Github Pages & Render 介紹」 ----------
  {
    q: '怎麼刪除 repo 裡的檔案',
    keywords: ['刪除檔案', '刪掉檔案', '刪檔', 'delete file'],
    a:
      '1. 在 repo 裡點要刪除的檔案\n' +
      '2. 右上角 ⋯（三個點）→ Delete file\n' +
      '3. 右上角 Commit changes... → 填說明 → Commit changes，才算刪除成功\n' +
      '（面板上方可以選「更新或刪除 repo 裡的檔案」教學）',
  },
  {
    q: '怎麼更新或上傳新檔案',
    keywords: ['更新檔案', '上傳新', '覆蓋', '取代', 'upload files', '重新上傳'],
    a:
      '在 repo 首頁 Add file → Upload files，把檔案拖進去，按 Commit changes。\n' +
      '同名的檔案會直接被新的取代。',
  },
  {
    q: '怎麼確認 GitHub Pages 部署好了',
    keywords: ['actions', '部署好', '部署完成', '綠色勾', '紅色叉', '黃色', 'deploy'],
    a:
      '點 repo 上方的 Actions：\n' +
      '・綠色勾勾 → 部署好了，回 Settings → Pages 點網址或 Visit site\n' +
      '・黃色圓圈 → 還在跑，等 1～2 分鐘\n' +
      '・紅色叉叉 → 失敗，點進去看錯誤訊息，最常見是 Pages 的 Branch 沒選 main',
  },
  {
    q: '兩個資料夾各有 index.html，網址是什麼',
    keywords: ['兩個資料夾', '資料夾', 'folder', '子頁面', '其他頁面'],
    a:
      '資料夾裡的 index.html，網址是「網站網址/資料夾名稱/」。\n' +
      '例如 repo 叫 115SEO，資料夾叫 page1：https://帳號.github.io/115SEO/page1/\n' +
      '注意：最外層也要有一個 index.html，網站首頁才不會 404。資料夾名稱建議用英文、不要空格。',
  },
  {
    q: 'Render 是什麼？跟 GitHub Pages 差在哪',
    keywords: ['render', '是什麼', '差在哪', '差別', '哪個好', 'render 跟'],
    a:
      '兩個都能免費放靜態網站（HTML、CSS、圖片）：\n' +
      '・GitHub Pages：在 GitHub 裡開就好，網址是 帳號.github.io/repo名稱\n' +
      '・Render：要另外用 GitHub 登入 Render 再連接 repo，網址是 名稱.onrender.com；Private repo 也能用\n' +
      '兩個都會在你上傳新版本到 GitHub 後自動更新。',
  },
  {
    q: 'Render 網站沒有更新',
    keywords: ['render', '沒更新', '沒有更新', 'manual deploy', 'clear build cache', '重新部署'],
    a:
      '正常情況下，上傳新版本到 GitHub，Render 會自動重新部署。沒更新的話：\n' +
      '點 Manual Deploy 旁的 ▼ → Clear build cache & deploy，等它跑完再重新整理網站。',
  },
  {
    q: 'Render 找不到我的 repo 或連不上',
    keywords: ['render', '找不到 repo', '連不上', 'public git repository', 'git provider', 'connect'],
    a:
      '・用 Public Git Repository：repo 必須是 Public，網址要貼像 https://github.com/帳號/repo名稱\n' +
      '・用 Git Provider：要允許 Render 讀取你的 GitHub repo，清單裡沒有的話點 Configure 加入那個 repo\n' +
      '・Branch 要選 main',
  },
  {
    q: 'Render 的 Publish Directory 要填什麼',
    keywords: ['publish directory', 'directory', 'required', '發布目錄', '要填什麼', 'build'],
    a:
      'Publish Directory 是「網站檔案放在 repo 的哪個資料夾」：\n' +
      '・index.html 在 repo 最外層（照簡報上傳的）→ 填 ./\n' +
      '・index.html 在資料夾裡，例如 website/index.html → 填 website\n' +
      '不要填 index.html（那是檔案），也不要填電腦上的路徑（C:\\...）。',
  },
  {
    q: 'Render 網址在哪、怎麼確認成功',
    keywords: ['render', '網址', '成功', 'onrender', 'your site is live', 'site is live', 'render 成功'],
    a: '部署畫面出現「Your site is live」就成功了。網址在服務頁面上方，格式是 名稱.onrender.com，點下去就能打開。',
  },
  {
    q: 'git config 怎麼設定',
    keywords: ['git config', 'user.email', 'user.name', '名字和 email', '設定 git'],
    a:
      '在 VS Code 上方 View → Terminal 打開終端機，輸入：\n' +
      '  git config --global user.email "你的GitHub Email"\n' +
      '  git config --global user.name "你的名字"\n' +
      '確認：只輸入 git config --global user.email（或 user.name），會顯示剛剛設定的內容。',
  },
  {
    q: 'VS Code 找不到 Publish to GitHub',
    keywords: ['publish to github', 'publish', 'source control', '原始檔控制', '發布到 github'],
    a:
      '1. 先確認 Git 已經安裝（cmd 輸入 git --version 有版本號），裝完要重開 VS Code\n' +
      '2. 要先用 File → Open Folder 打開一個資料夾\n' +
      '3. 左邊點 Source Control（分岔圖示）就會看到 Publish to GitHub\n' +
      '4. VS Code 要登入 GitHub（左下角有頭像）',
  },
  {
    q: 'VS Code 改了檔案怎麼上傳到 GitHub',
    keywords: ['commit & push', 'commit and push', 'vs code 上傳', 'vscode 上傳', 'changes'],
    a:
      '1. 左邊 Source Control 會出現 Changes\n' +
      '2. 上方填一句修改說明\n' +
      '3. 點 Commit 旁的 ▼ → Commit & Push，跳出視窗按 Yes\n' +
      '多人一起做的專案，push 前要先 pull 別人的修改，避免蓋掉別人的檔案。',
  },
  {
    q: 'VS Code 怎麼預覽網頁',
    keywords: ['預覽', 'preview', 'launch on browser', '看網頁長怎樣'],
    a:
      '1. 左邊 Extensions 搜尋安裝「preview on web server」\n' +
      '2. 在 HTML 檔的空白處按右鍵 → vscode-preview-server: Launch on browser\n' +
      '建議也把 Auto Save 改成 afterDelay（左下齒輪 → Settings），改了就會自動存檔。',
  },
  {
    q: 'VS Code 怎麼快速產生 HTML 架構',
    keywords: ['!+enter', '! enter', '驚嘆號', '基本架構', 'html 架構', 'emmet'],
    a: '新增 .html 檔後，輸入 ! 再按 Enter（或 Tab），就會自動產生 <!DOCTYPE html>、<head>、<body> 等基本架構。',
  },
  {
    q: 'VS Code 怎麼改成中文',
    keywords: ['中文介面', '改中文', 'language pack', '語言'],
    a: '左邊 Extensions 搜尋安裝「Chinese (Traditional) Language Pack」，裝好後依右下角提示重新啟動 VS Code。',
  },
  {
    q: '作業一要做什麼',
    keywords: ['作業', 'assignment', '繳交', '交作業', '表單'],
    a:
      '把自己做的練習網站網址填到老師給的 Google 表單。\n' +
      '・平台不限：GitHub Pages、Render、Google Blogger、Webflow 都可以\n' +
      '・可以用模板或自己設計\n' +
      '・不能是空白網站，放一些圖片、文字、按鈕、影片，內容豐富一點就能拿滿分\n' +
      '・內容太少、連結錯誤、交成後台網址會扣分\n' +
      '期限和表單連結請看課堂公告。',
  },
  // ---------- 以下來自課堂簡報「連結 GA、GSC、GTM、sitemap」 ----------
  {
    q: 'GA、GSC、GTM 是什麼？差在哪',
    keywords: ['ga 是什麼', 'gsc 是什麼', 'gtm 是什麼', 'ga 跟', 'gtm 跟', 'gsc 跟', '跟 ga', '跟 gtm', '跟 gsc', '差在哪', '差別', '是什麼'],
    a:
      '・GA（Google Analytics）：看有多少人來你的網站、看了哪些頁面、做了什麼\n' +
      '・GSC（Google Search Console）：看你的網站在 Google 搜尋的表現，提交 sitemap、要求建立索引\n' +
      '・GTM（Google 代碼管理工具）：統一管理網站上的追蹤碼。裝一次 GTM，之後新增追蹤（例如捲動事件）只要在 GTM 設定，不用一直改網站程式碼',
  },
  {
    q: 'GA 的網址要怎麼填',
    keywords: ['ga 網址', '資料串流', 'data stream', '串流網址', 'ga 填網址'],
    a:
      '建立網站資料串流時：\n' +
      '・填實際的網站網址，例如 帳號.github.io/repo名稱\n' +
      '・前面的 https:// 要刪掉（欄位前面已經有 https:// 選單）\n' +
      '・不要填後台網址（github.com/… 或 dashboard.render.com）',
  },
  {
    q: 'GA 追蹤碼要貼在哪',
    keywords: ['追蹤碼', 'gtag', '貼在哪', 'google 代碼', 'ga 程式碼', 'ga 代碼'],
    a:
      '1. GA 管理 → 資料串流 → 點你的串流 → 查看代碼操作說明 → 手動安裝，複製整段\n' +
      '2. 貼到每一個 .html 檔的 <head> 裡面（緊接在 <head> 後面）\n' +
      '3. 上傳到 GitHub，等部署完成\n' +
      '4. 打開網站，看擴充功能的「網站檢查」或 Tag Assistant 確認',
  },
  {
    q: 'GA 沒有資料',
    keywords: ['ga 沒有資料', 'ga 沒資料', '沒有數據', '沒資料', '即時報表', '即時總覽', 'realtime'],
    a:
      '1. 先用擴充功能的「網站檢查」確認網站上找得到 GA 追蹤碼，而且 ID 是對的\n' +
      '2. 看 報表 → 即時總覽：要有人在打開網站時才會有資料\n' +
      '3. 擋廣告的擴充功能（AdBlock 等）會擋掉 GA，測試時先關掉\n' +
      '4. 一般報表要等 24～48 小時才會有資料，即時總覽才是馬上看得到的',
  },
  {
    q: 'Tag Assistant 怎麼用',
    keywords: ['tag assistant', '檢查有沒有成功', '確認安裝', '安裝成功'],
    a:
      '1. 安裝 Chrome 擴充功能 Tag Assistant\n' +
      '2. 打開你的網站，點右上角拼圖圖示 → Tag Assistant\n' +
      '3. 右下角出現你的評估 ID（G-…）或 GTM ID 就是安裝成功\n' +
      '這個教學擴充功能在你的網站上也會顯示「網站檢查」，可以一起看。',
  },
  {
    q: 'GSC 驗證失敗',
    keywords: ['驗證失敗', '無法驗證', '驗證', 'verification', '擁有權'],
    a:
      '1. 新增資源要選「網址前置字元」，填完整網址（https:// 開頭、結尾有 /）\n' +
      '2. 自動驗證是靠網站上的 GA 追蹤碼，所以要先完成「安裝 GA 追蹤碼」，而且已經部署好\n' +
      '3. GSC 和 GA 要用同一個 Google 帳號\n' +
      '4. 不要選「網域」：github.io 不是你的網域，沒辦法用 DNS 驗證',
  },
  {
    q: 'GSC 沒有資料',
    keywords: ['gsc 沒有資料', 'gsc 沒資料', 'search console 沒有', '成效沒有'],
    a: 'GSC 新增資源後大約要 1～2 天才會開始有資料，網站剛上線可能更久。可以先做「要求建立索引」。',
  },
  {
    q: 'GA 怎麼連結 GSC',
    keywords: ['連結 gsc', '連結 ga', 'search console 連結', '產品連結', 'link'],
    a:
      'GA 左下 管理 → 產品連結 → Search Console 連結 → 右上「連結」→ 選擇帳戶 → 勾你網站的 GSC 資源 → 確認 → 下一步 → 選取資料串流 → 下一步 → 提交。\n' +
      '要先在 GSC 新增好網站資源，清單裡才選得到。',
  },
  {
    q: 'GTM 程式碼要貼在哪',
    keywords: ['gtm 程式碼', 'gtm 代碼', 'gtm 貼', 'noscript', '兩段'],
    a:
      'GTM 有兩段程式碼，每個網頁都要貼：\n' +
      '・第一段（<!-- Google Tag Manager --> 開頭）→ <head> 標籤下方\n' +
      '・第二段（<noscript> 那段）→ <body> 標籤下方\n' +
      '視窗關掉了：點 GTM 右上角的 GTM-XXXX 就能再叫出來。',
  },
  {
    q: 'GTM 設定了但沒有效果',
    keywords: ['gtm 沒效果', 'gtm 沒有效果', '沒有觸發', '沒觸發', 'gtm 發布', '發布 gtm', 'gtm 提交'],
    a:
      '1. GTM 改完一定要按右上角「提交」→「發布」才會生效\n' +
      '2. 用「預覽」打開網站，看代碼有沒有被觸發（Tags Fired）\n' +
      '3. 確認網站上有 GTM 的兩段程式碼（看擴充功能的「網站檢查」）\n' +
      '4. 擋廣告的擴充功能會擋掉 GTM，測試時先關掉',
  },
  {
    q: 'GTM 顯示找不到 Google 代碼',
    keywords: ['找不到 google 代碼', '找不到代碼', 'google tag not found', '建立代碼'],
    a: '在 GA4 事件代碼設定裡，點右邊的「建立代碼」，命名「GA 評估 ID」後儲存就可以了。',
  },
  {
    q: '評估 ID 在哪裡',
    keywords: ['評估 id', 'measurement id', 'ga id', '評估編號'],
    a:
      'GA 左下 管理 → 資料串流 → 點串流右邊的箭頭，右上角的「評估 ID」（G- 開頭）就是。\n' +
      '打開那個頁面時，這個擴充功能會自動記下來，之後產生程式碼時會用到。',
  },
  {
    q: '捲動事件沒出現',
    keywords: ['捲動', 'scroll', '50%', '捲動深度'],
    a:
      '1. 觸發條件要選「捲動深度」，勾「垂直捲動深度」，百分比 50\n' +
      '2. 改完要「提交」→「發布」\n' +
      '3. 網頁太短的話捲不到 50%，可以把百分比調低，或把網頁內容加長\n' +
      '4. 要真的在網站上往下捲，GA 即時總覽才會出現',
  },
  {
    q: 'Sitemap 怎麼產生、放哪裡',
    keywords: ['sitemap', '網站地圖', 'xml-sitemaps', 'sitemap.xml'],
    a:
      '1. 到 xml-sitemaps.com 輸入網站網址，按 Generate XML Sitemap（START）\n' +
      '2. View Sitemap Details → 下載 sitemap.xml\n' +
      '3. 放到網站資料夾最外層（跟 index.html 同一層），上傳到 GitHub\n' +
      '4. GSC 左邊 Sitemap → 輸入 sitemap.xml → 提交',
  },
  {
    q: 'GSC 讀不到 Sitemap',
    keywords: ['sitemap 無法', 'sitemap 讀不到', '無法讀取', '讀不到', 'couldn\'t fetch', '擷取失敗', 'sitemap 失敗'],
    a:
      '1. 先在瀏覽器打開「你的網站網址/sitemap.xml」，看得到內容才對\n' +
      '2. sitemap 裡的網址要是你真正的網站網址（產生時網址有沒有打錯）\n' +
      '3. 確認 robots.txt 設定正確\n' +
      '4. 剛提交常常會顯示讀不到，過幾天通常就會變成「成功」',
  },
  {
    q: 'robots.txt 怎麼寫',
    keywords: ['robots', 'robots.txt', '爬蟲'],
    a:
      '新增一個 robots.txt，內容：\n' +
      '  User-agent: *\n  Allow: /\n  Sitemap: https://你的網站網址/sitemap.xml\n' +
      '要放在網域的最外層。GitHub 專案網站（帳號.github.io/repo名稱）的話，要放在「帳號.github.io」那個 repo 裡；Render 放在 repo 最外層就好。',
  },
  {
    q: '要求建立索引按了沒反應',
    keywords: ['建立索引', '索引', 'request indexing', '網址審查', '收錄', '搜尋不到'],
    a:
      '1. GSC 上方「網址審查」輸入網址 → 測試線上網址 → 成功後按「要求建立索引」\n' +
      '2. 這只是告訴 Google 你想被收錄，什麼時候收錄還是看 Google\n' +
      '3. 按很多次不會比較快，還可能被限制提交次數，按一次就好\n' +
      '4. 新網站通常要幾天到幾週才搜尋得到',
  },
  {
    q: '怎麼新增管理員權限',
    keywords: ['管理員', '權限', '新增使用者', '存取管理', '使用者管理', '加助教', '加老師'],
    a:
      '・GA：左下 管理 → 帳戶存取管理 → 右上 + → 新增使用者 → 輸入 Email，角色選管理員\n' +
      '・GSC：左邊 設定 → 使用者和權限 → 新增使用者\n' +
      '・GTM：上方 管理 → 容器的 使用者管理 → 右上 +\n' +
      '要加誰的 Email、給什麼權限，請看課堂公告。',
  },
  {
    q: 'AI 回答功能連不上',
    keywords: ['ollama', 'ai 連不上', 'ai 不能用', 'ai 沒反應'],
    a:
      '1. 確認已安裝 Ollama 並開著（右下角工作列有 Ollama 圖示）\n' +
      '2. 在 cmd 執行 ollama pull qwen2.5:3b 下載模型\n' +
      '3. 出現 403 錯誤：在 cmd 執行 setx OLLAMA_ORIGINS "chrome-extension://*"，然後從工作列結束 Ollama 再重新開啟',
  },
];
