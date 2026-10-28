# 專題擴充功能：下載與安裝步驟



##  下載專案（選一種）

**方法 A：GitHub Desktop（推薦，不用打指令）**
1. 下載安裝 GitHub Desktop：https://desktop.github.com
2. 用 GitHub 帳號登入
3. File → Clone repository → 選「你的帳號/repo名稱」→ Clone

**方法 B：VS Code**
1. 按 Ctrl+Shift+P（Mac：Cmd+Shift+P）
2. 輸入「Git: Clone」→ 貼上 https://github.com/你的帳號/repo名稱.git
3. 選一個資料夾存放

**只想先看看：** repo 頁面綠色「Code」按鈕 → Download ZIP（這樣改完不能推回去）

## 3. 在 Chrome 裝起來
1. 網址列輸入 chrome://extensions
2. 右上角打開「開發人員模式」
3. 按「載入未封裝項目」→ 選 github-repo-guide 資料夾
4. 打開任一個 GitHub 頁面，右下角出現教學面板就成功了

## 4. 改程式之後
- 改完檔案要回 chrome://extensions 按擴充功能上的「重新載入」才會生效
- 要改東西請先開自己的 branch（例如 rq3-xxx），不要直接改 main
- 改好用 Pull Request 合併，大家不會互相覆蓋

