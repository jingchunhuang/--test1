# GitHub 建網站教學（Chrome 擴充功能）

一步一步教你用 GitHub Pages 或 Render 發布網站（內容依照課堂簡報「Github Pages & Render 介紹」）。會自動提醒常見錯誤，也可以問問題。

面板上方可以選教學：

- GitHub Pages 方法 1：網頁上傳（推薦）
- GitHub Pages 方法 2：VS Code + Git
- Render：上傳後部署靜態網站
- 更新或刪除 repo 裡的檔案
- 直接在 GitHub 上寫 index.html
- 準備：安裝和設定 VS Code
- SEO（課堂簡報「連結 GA、GSC、GTM、sitemap」）：
  1. GA 申請與設定
  2. 在網站安裝 GA 追蹤碼
  3. GSC 新增網站並連結 GA
  4. 在網站安裝 GTM
  5. GTM 連接 GA（網頁瀏覽、捲動事件）
  6. 建立並提交 Sitemap
  7. 要求 Google 建立索引
  8. 新增 GA、GSC、GTM 管理員

面板會出現在 GitHub、Render、GA、GSC、GTM、xml-sitemaps.com，以及你自己的網站（`*.github.io`、`*.onrender.com`）。在 VS Code 裡做的步驟只有文字說明，不會有標示。

在你自己的網站上，面板會顯示「🔍 網站檢查」：檢查這一頁有沒有 GA 追蹤碼、GTM 的兩段程式碼（以及 ID 對不對），還有 sitemap.xml 和 robots.txt。

## 安裝

1. Chrome 網址列輸入 `chrome://extensions`，打開右上角「開發人員模式」
2. 按「載入未封裝項目」，選這個資料夾（`github-repo-guide`）
3. 打開 GitHub 並登入，右下角會出現教學面板

改過檔案後：在 `chrome://extensions` 按這個擴充功能的「重新載入 🔄」，再重新整理 GitHub 頁面。

## 檔案

| 檔案 | 用途 |
|---|---|
| `manifest.json` | 擴充功能設定 |
| `courses.js` | **教學內容**：每套教學的每一步。要改步驟說明、加新教學就改這個 |
| `faq.js` | **常見問題清單**，想讓它會回答更多問題就在這裡加題目 |
| `common.js` | 共用工具和狀態（第幾步、repo、網站網址、GA／GTM ID） |
| `highlight.js` | 找按鈕、畫橘色框和提示文字 |
| `checks.js` | 例外狀況提醒（黃色警告）、在你的網站上做「網站檢查」 |
| `chat.js` | 「問問題」介面 |
| `panel.js` | 教學面板，負責把上面的功能接起來 |
| `background.js` | 把常見問題答不出來的問題交給電腦上的 Ollama |
| `guide.css` | 外觀 |
| `TODO.md` | 之後想做的功能 |

## 問問題怎麼運作

1. 先用關鍵字比對 `faq.js` 裡的常見問題，有符合就直接回答（不用網路、不用安裝其他東西）
2. 找不到，或按「不是我要的答案，問 AI」，就交給**你電腦上的 Ollama** 回答（不會連到網路上的 AI）

## 設定 Ollama（想用 AI 回答才需要）

1. 到 https://ollama.com 下載並安裝 Ollama
2. 在 cmd 下載模型（約 2 GB，中文不錯）：

   ```
   ollama pull qwen2.5:3b
   ```

3. 允許擴充功能連線，在 cmd 執行：

   ```
   setx OLLAMA_ORIGINS "chrome-extension://*"
   ```

   然後從工作列右下角結束 Ollama，再重新開啟。

想換模型，改 `background.js` 最上面的 `MODEL`。電腦比較慢可以用 `qwen2.5:1.5b`，比較快但回答品質較差。
