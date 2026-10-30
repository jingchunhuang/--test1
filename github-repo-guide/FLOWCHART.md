# 程式流程圖

2026-10-30（對應 manifest 版本 6.1）

這份文件用流程圖說明每個檔案、每個函數之間怎麼互相呼叫。整體架構和每個檔案的用途請看 [ARCHITECTURE.md](ARCHITECTURE.md)。

圖裡的寫法：`檔案.js：函數()`。虛線箭頭（`-.->`）是跨程式傳訊息（`chrome.runtime.sendMessage`）或讀寫 `chrome.storage`。

## 1. 總覽：誰呼叫誰

```mermaid
flowchart LR
  subgraph CS["content scripts（網頁裡）"]
    common["common.js<br/>setState() · course() · currentStep()<br/>onGitHub() 等網址判斷"]
    courses["courses.js<br/>COURSES · setCustomCourses()"]
    faq["faq.js<br/>GUIDE_FAQ"]
    highlight["highlight.js<br/>highlight() · countFound()<br/>clickedTarget() · nextNodes() · nextOffscreen()"]
    checks["checks.js<br/>checkProblems() · siteBase()<br/>siteCheckRows() · captureIds()"]
    chat["chat.js<br/>mountChat() · matchFaq() · askAI()"]
    aifind["aifind.js<br/>aiFind() · sendToBackground()"]
    panel["panel.js<br/>render() · scan() · checkAutoNext()<br/>maybeAskAI()"]
  end
  subgraph BG["background.js（背景程式）"]
    router["onMessage 分派"]
    ai["chat() → ollamaChat() / geminiChat()"]
  end
  subgraph PAGES["擴充功能頁面"]
    options["options.js"]
    maker["maker.js"]
  end
  storage[("chrome.storage.local")]

  panel --> highlight
  panel --> checks
  panel --> chat
  panel --> aifind
  panel --> courses
  panel --> common
  chat --> faq
  common -- "setState() 結束時呼叫 Guide.render()" --> panel
  common -.->|guideState| storage
  chat -.->|ask| router
  aifind -.->|capture · findTarget| router
  panel -.->|openMaker · openOptions| router
  maker -.->|makeSteps| router
  options -.->|testAi| router
  router --> ai
  ai -.->|讀 aiSettings| storage
  options -.->|aiSettings| storage
  maker -.->|customCourses| storage
```

## 2. 載入和啟動

Chrome 依 `manifest.json` 的順序載入 8 個檔案。前 7 個只是把函數掛到全域物件 `Guide` 上，最後的 `panel.js` 才真正開始動作。

```mermaid
flowchart TD
  A["打開 GitHub／Render／GA／GSC／GTM／你的網站"] --> B["common.js<br/>建立 Guide、state、setState()"]
  B --> C["courses.js<br/>Guide.COURSES、Guide.setCustomCourses"]
  C --> D["faq.js<br/>GUIDE_FAQ"]
  D --> E["highlight.js<br/>Guide.highlight、countFound…"]
  E --> F["checks.js<br/>Guide.checkProblems、siteBase、siteCheckRows<br/>在 GA／GTM 頁面開始 setInterval(captureIds, 3000)"]
  F --> G["chat.js<br/>Guide.mountChat"]
  G --> H["aifind.js<br/>Guide.aiFind、Guide.sendToBackground"]
  H --> I["panel.js<br/>建立面板 HTML"]
  I --> J["Guide.mountChat(panel)<br/>放進「❓ 問問題」"]
  J --> K["chrome.storage.local.get<br/>guideState、customCourses"]
  K --> L["Guide.setCustomCourses(customCourses)"]
  L --> M["buildCourseSelect()<br/>依 COURSE_GROUPS 建下拉選單"]
  M --> N["Object.assign(state, guideState)"]
  N --> O["render()"]
  N --> P["renderSiteCheck()<br/>→ Guide.siteCheckRows()"]
  I --> Q["new MutationObserver(scheduleScan)<br/>監聽 scroll、resize、input"]
  I --> R["chrome.storage.onChanged<br/>別的分頁存了新教學 → setCustomCourses() → render()"]
```

## 3. 畫面和掃描：render() → scan()

這是最核心的循環。任何狀態改變都會走 `setState()` → `render()` → `scan()`；網頁畫面一變，`MutationObserver` 也會叫 `scan()`。

```mermaid
flowchart TD
  start1["使用者按 上一步／下一步／選教學"] --> setState
  start2["MutationObserver 偵測畫面變化<br/>或使用者在網頁上打字"] --> schedule["scheduleScan()<br/>requestAnimationFrame 合併成一次"]
  schedule --> scan

  setState["common.js：setState(patch)<br/>換步驟時重設 stepShownAt、armed"] --> save[("chrome.storage.local.set<br/>guideState")]
  setState --> render["panel.js：render()<br/>更新標題、說明、按鈕、第幾步"]
  render --> scan
  render -- "4.1 秒後再一次" --> scan

  scan["panel.js：scan()"] --> r1{"這一步要記 repo，<br/>而且 currentRepo() 變了？"}
  r1 -- 是 --> setRepo["setState({ repo })"] --> setState
  r1 -- 否 --> r2{"onMySite() 而且<br/>Guide.siteBase() 變了？"}
  r2 -- 是 --> setSite["setState({ site })"] --> setState
  r2 -- 否 --> auto{"checkAutoNext(step)<br/>見第 4 節"}
  auto -- 狀態變了 --> setState
  auto -- 沒變 --> count["highlight.js：Guide.countFound(targets)<br/>原本的線索找到幾個"]
  count --> extra["沒找到時加上 aiTargetsFor()<br/>（之前 AI 找到的紫色框）"]
  extra --> hl["highlight.js：Guide.highlight(targets)<br/>find() → findByText() / querySelectorAll<br/>畫橘色框和提示 → position()"]
  hl --> chk["checks.js：Guide.checkProblems(found)<br/>domainProblem()、missingRootIndex()…"]
  chk --> cover["avoidCover()<br/>→ Guide.nextNodes()<br/>面板蓋到按鈕就換邊"]
  cover --> warn["renderWarnings(problems + offscreenHint())<br/>offscreenHint() → Guide.nextOffscreen()"]
  warn --> ai{"面板打開、這一步有 targets，<br/>但一個都沒找到？"}
  ai -- 是 --> maybe["maybeAskAI(step)<br/>見第 5 節"]
  ai -- 否 --> done["等下一次畫面變化"]
```

## 4. 自動跳下一步

有兩種方式：點了框起來的按鈕（target 有 `done: true`），或網址變了（步驟的 `doneWhen()` 從不成立變成成立）。

```mermaid
flowchart TD
  subgraph click["方式 1：點了按鈕"]
    c1["document click（capture 階段）"] --> c2["highlight.js：Guide.clickedTarget(e.target)<br/>從 targetOf 找到對應的 target"]
    c2 --> c3{"target.done？"}
    c3 -- 是 --> go
    c3 -- 否 --> c4["不跳"]
  end
  subgraph url["方式 2：網址變了"]
    u1["scan() → checkAutoNext(step)"] --> u2{"autoNext 開著、面板打開、<br/>有 doneWhen、不是最後一步？"}
    u2 -- 否 --> u9["不跳"]
    u2 -- 是 --> u3{"doneWhen() 成立？"}
    u3 -- 不成立 --> u4["setState({ armed: stepKey() })<br/>先記住「看過不成立」"]
    u3 -- 成立 --> u5{"armed === stepKey()？"}
    u5 -- 是 --> go
    u5 -- 否 --> u6["不跳（一進來就成立，<br/>例如按了上一步）"]
  end
  go["goNextAutomatically()<br/>顯示「✅ 已完成」4 秒"] --> next["setState({ step: step + 1 })"] --> rerender["render() → scan()"]
```

## 5. AI 找按鈕

```mermaid
sequenceDiagram
  participant P as panel.js
  participant A as aifind.js
  participant H as highlight.js
  participant B as background.js
  participant S as chrome.storage
  participant AI as Ollama / Gemini

  P->>P: maybeAskAI(step)<br/>檢查 aiFind 開關、這頁沒問過、在正確頁面、已過 4 秒
  P->>A: Guide.aiFind(step)
  A->>A: collectCandidates()<br/>最多 50 個可點元素，編號
  A->>A: hideOverlay(true) 先藏起面板
  A->>B: sendMessage capture（元素位置、視窗大小）
  B->>B: capture()<br/>有 &lt;all_urls&gt; 權限？canSeeImages()？
  B->>B: captureVisibleTab → OffscreenCanvas 畫粉紅框和編號
  B-->>A: { image } 或 { image: null, why }
  A->>A: hideOverlay(false)
  A->>B: sendMessage findTarget（步驟、原本的線索、元素清單、截圖）
  B->>B: findTarget() → chat()
  B->>S: settings() 讀 aiSettings
  B->>AI: ollamaChat() 或 geminiChat()
  AI-->>B: {"index": 編號, "reason": "…"}
  B->>B: parseJson()
  B-->>A: { index, reason, model, mode }
  A->>A: targetFor(node)<br/>轉成之後還找得到的 selector / text
  A-->>P: { target, reason }
  P->>S: setState({ aiFound }) 依 aiKey() 存起來
  P->>P: render() → scan()
  P->>H: Guide.highlight([...targets, ...aiTargetsFor()])<br/>畫紫色虛線框
```

## 6. 問問題

```mermaid
flowchart TD
  q1["使用者在「❓ 問問題」輸入問題"] --> q2["chat.js：sendQuestion(question)"]
  q2 --> q3["matchFaq(question)<br/>拿 GUIDE_FAQ（faq.js）的關鍵字比對"]
  q3 --> q4{"有符合的題目？"}
  q4 -- 有 --> q5["addMessage() 顯示答案<br/>附「不是我要的答案，問 AI」按鈕"]
  q5 -. 按了 .-> q6
  q4 -- 沒有 --> q6["askAI(question)"]
  q6 --> q7{"extensionAlive()？"}
  q7 -- 否 --> q8["提示按 F5 重新整理"]
  q7 -- 是 --> q9["chrome.runtime.sendMessage<br/>{ type: 'ask', question, step, history }"]
  q9 -.-> b1["background.js：onMessage → ask()"]
  b1 --> b2["chat({ system: SYSTEM_PROMPT + 目前步驟 })"]
  b2 --> b3["settings() 讀 aiSettings"]
  b3 --> b4{"provider"}
  b4 -- ollama --> b5["ollamaChat()<br/>pickModel() → POST 127.0.0.1:11434/api/chat"]
  b4 -- gemini --> b6["geminiChat()<br/>POST generativelanguage.googleapis.com<br/>錯誤由 geminiError() 翻成中文"]
  b5 --> b7["sendResponse({ ok, answer })"]
  b6 --> b7
  b7 -.-> q10["chat.js：addMessage() 顯示 AI 回答"]
```

## 7. 用截圖做教學（maker.html）

```mermaid
flowchart TD
  m0["面板按「📷 用截圖做新教學」"] --> m1["Guide.sendToBackground({ type: 'openMaker' })"]
  m1 -.-> m2["background.js：chrome.tabs.create(maker.html)"]
  m2 --> m3["maker.js：拖曳、選檔或 Ctrl+V 貼上"]
  m3 --> m4["addFiles() → toJpeg()<br/>縮到最寬 1280、最高 2000"]
  m4 --> m5["renderShots()"]
  m5 --> m6["按「🤖 產生步驟」<br/>$('generate').onclick"]
  m6 --> m7["每張截圖：sendMessage<br/>{ type: 'makeSteps', image, goal, note, previous }"]
  m7 -.-> m8["background.js：makeSteps()<br/>→ chat({ system: MAKE_PROMPT, images })<br/>→ parseJson() → 整理 title/body/buttons/url"]
  m8 -.-> m9["maker.js：steps.push(...) → renderSteps()"]
  m9 --> m10["使用者修改：edit()、move()、addStep"]
  m10 --> m11["save()<br/>檢查標題和步驟"]
  m11 --> m12[("chrome.storage.local.set<br/>customCourses")]
  m12 -.-> m13["所有分頁的 panel.js：<br/>storage.onChanged → Guide.setCustomCourses()<br/>→ customStep() 換成一般步驟 → buildCourseSelect()"]
```

## 8. 設定頁（options.html）

```mermaid
flowchart TD
  o0["打開設定頁"] --> o1["loadAi()<br/>讀 aiSettings，顯示 Ollama／Gemini"]
  o0 --> o2["showPermission()<br/>chrome.permissions.contains(&lt;all_urls&gt;)"]
  o0 --> o3["loadFound() → showFound()<br/>列出 guideState.aiFound（改版紀錄）"]
  o1 --> o4["按「儲存」→ saveAi()"] --> o5[("aiSettings")]
  o1 --> o6["按「測試連線」"] -.-> o7["background.js：testAi() → chat()"]
  o2 --> o8["按「允許截圖」→ chrome.permissions.request"]
  o2 --> o9["按「取消」→ chrome.permissions.remove"]
  o3 --> o10["複製成 JSON（寫回 courses.js 用）"]
  o3 --> o11["清除紀錄"]
```

## 9. 網站檢查（在你自己的網站上）

```mermaid
flowchart TD
  w0["打開 *.github.io 或 *.onrender.com"] --> w1["panel.js：renderSiteCheck()<br/>onMySite() 成立才顯示"]
  w1 --> w2["checks.js：siteCheckRows()"]
  w2 --> w3["看目前頁面的 HTML：<br/>有沒有 GA（gtag）、GTM 兩段程式碼、ID 對不對"]
  w2 --> w4["siteBase() + fetchText()<br/>抓 sitemap.xml、robots.txt"]
  w3 --> w5["回傳 [ok/warn/no, 說明] 清單"]
  w4 --> w5
  w5 --> w6["panel.js 畫成 ✅ ⚠️ ❌"]
  x0["在 GA／GTM 後台"] --> x1["checks.js：setInterval(captureIds, 3000)<br/>從頁面文字抓 G-XXXX、GTM-XXXX"]
  x1 --> x2["setState({ gaId / gtmId })<br/>網站檢查時拿來比對"]
```
