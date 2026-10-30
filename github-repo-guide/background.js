// 背景程式：把問題交給 AI。設定頁可以選：電腦上的 Ollama（不會連到網路），或 Google 的 Gemini API（要填 key）
//   ask        「問問題」答不出來的問題
//   capture    找不到按鈕時截圖，並在每個可以點的元素上畫框和編號
//   findTarget 請 AI 看截圖（或元素清單）選出這一步要按的按鈕
//   makeSteps  「用截圖做教學」頁面上傳的截圖，請 AI 寫成教學步驟
//   testAi     設定頁的「測試連線」
importScripts('faq.js');

const OLLAMA = 'http://127.0.0.1:11434';
const MODEL = 'qwen2.5:3b'; // 文字模型：想換就改這裡；沒裝這個模型時會自動用已安裝的第一個
const VISION_MODEL = 'qwen2.5vl:3b'; // 看圖模型：建議安裝的版本（裝了別的看圖模型也會自動用）
const VISION_NAME = /(vl\b|llava|vision|gemma3|minicpm-v|moondream)/i; // 從名稱判斷是不是看圖模型

const GEMINI = 'https://generativelanguage.googleapis.com/v1beta';
const GEMINI_MODEL = 'gemini-3.5-flash-lite'; // 設定頁沒填模型時用這個（免費方案可用、能看圖、回得快）

const ORIGIN_HELP =
  'Ollama 拒絕了連線（403）。請在 cmd 執行：\nsetx OLLAMA_ORIGINS "chrome-extension://*"\n' +
  '然後從工作列右下角結束 Ollama，再重新開啟。';

const SYSTEM_PROMPT =
  '你是「GitHub 建網站教學」瀏覽器擴充功能裡的小幫手，幫初學者在 GitHub 建立 repo，' +
  '並用 GitHub Pages 發布網站。\n' +
  '規則：一律用繁體中文；回答簡短，步驟用 1. 2. 3. 條列；不要用 Markdown 粗體；' +
  'GitHub 的按鈕名稱用英文原文；不確定的事情直接說不確定，不要編造。\n\n' +
  '參考資料（常見問題）：\n' +
  GUIDE_FAQ.map((f) => `Q：${f.q}\nA：${f.a}`).join('\n\n');

const FIND_PROMPT =
  '你在幫一個網頁教學擴充功能找按鈕。網站可能改版了，原本記錄的按鈕找不到。\n' +
  '根據「教學步驟」「原本的按鈕線索」和「畫面上的元素清單」，選出使用者這一步最應該點或填的那一個元素。\n' +
  '如果有附截圖：截圖上粉紅色的框和數字，就是元素清單的編號。\n' +
  '只回答 JSON，格式：{"index": 編號, "reason": "一句繁體中文理由"}。\n' +
  '如果沒有一個像的，index 回 -1。只能選清單裡有的編號，不要猜。';

const MAKE_PROMPT =
  '你在幫老師把「操作畫面的截圖」寫成給初學者看的網頁教學步驟。\n' +
  '看這張截圖，寫出使用者在這個畫面上要做的事。\n' +
  '規則：\n' +
  '- 一律用繁體中文；說明一兩句話就好，講清楚要點哪裡、要填什麼。\n' +
  '- 一張截圖通常寫 1 步；截圖上有編號、箭頭或紅框標了好幾個動作，才照順序拆成多步。\n' +
  '- buttons 填這一步要點的按鈕、分頁或連結上的文字，照畫面上的原文寫（英文就寫英文），不要翻譯、不要加引號。\n' +
  '- url 只有截圖上看得到網址列時才填完整網址，不然填空字串。\n' +
  '- 看不清楚的不要猜，寧可少寫。\n' +
  '只回答 JSON，格式：{"steps":[{"title":"短標題","body":"說明","buttons":["按鈕文字"],"url":""}]}';

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  const handlers = {
    ask: () => ask(msg),
    capture: () => capture(msg, sender),
    findTarget: () => findTarget(msg),
    makeSteps: () => makeSteps(msg),
    testAi: () => testAi(),
    openOptions: () => chrome.runtime.openOptionsPage(),
    openMaker: () => chrome.tabs.create({ url: chrome.runtime.getURL('maker.html') }).then(() => ({})),
  };
  const handler = handlers[msg?.type];
  if (!handler) return;
  Promise.resolve()
    .then(handler)
    .then(
      (result) => sendResponse({ ok: true, ...(typeof result === 'string' ? { answer: result } : result) }),
      (err) => sendResponse({ ok: false, error: err.message })
    );
  return true; // 非同步回覆
});

async function ollamaFetch(url, options) {
  let res;
  try {
    res = await fetch(`${OLLAMA}${url}`, options);
  } catch (err) {
    if (err.name === 'TimeoutError') throw new Error('AI 想太久了，請再問一次，或換短一點的問題。');
    throw new Error('連不到 Ollama。請確認 Ollama 已經安裝並開啟（工作列右下角有 Ollama 圖示）。');
  }
  if (res.status === 403) throw new Error(ORIGIN_HELP);
  if (!res.ok) throw new Error(`Ollama 回應錯誤（${res.status}）：${(await res.text()).slice(0, 200)}`);
  return res.json();
}

async function modelNames() {
  const { models = [] } = await ollamaFetch('/api/tags');
  if (!models.length) throw new Error(`Ollama 裡還沒有模型。請在 cmd 執行：\nollama pull ${MODEL}`);
  return models.map((m) => m.name);
}

async function pickModel() {
  const names = await modelNames();
  return names.includes(MODEL) ? MODEL : names[0];
}

async function pickVisionModel() {
  const names = await modelNames();
  return names.includes(VISION_MODEL) ? VISION_MODEL : names.find((n) => VISION_NAME.test(n)) || null;
}

// ---------- 選用哪個 AI（設定頁存在 chrome.storage.local 的 aiSettings） ----------
async function settings() {
  const { aiSettings } = await chrome.storage.local.get('aiSettings');
  return { provider: 'ollama', geminiKey: '', geminiModel: '', ...aiSettings };
}

// 送一段對話給 AI，回傳 { text, model }
// messages：[{ role: 'user' | 'assistant', content, images?: [base64 JPEG] }]　json：要 AI 只回 JSON
async function chat(opts) {
  const s = await settings();
  return s.provider === 'gemini' ? geminiChat(s, opts) : ollamaChat(opts);
}

// 現在選的 AI 能不能看圖（Ollama 要裝看圖模型；Gemini 都可以）
async function canSeeImages() {
  if ((await settings()).provider === 'gemini') return true;
  return !!(await pickVisionModel());
}

async function ollamaChat({ system, messages, json = false, temperature, numCtx = 8192, timeout = 180000 }) {
  const model = messages.some((m) => m.images) ? await pickVisionModel() : await pickModel();
  if (!model) throw new Error(`還沒安裝看圖模型。請在 cmd 執行：\nollama pull ${VISION_MODEL}`);
  const data = await ollamaFetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(timeout),
    body: JSON.stringify({
      model,
      stream: false,
      ...(json ? { format: 'json' } : {}),
      options: { num_ctx: numCtx, ...(temperature != null ? { temperature } : {}) },
      messages: [{ role: 'system', content: system }, ...messages],
    }),
  });
  return { text: data.message?.content?.trim() || '', model };
}

async function geminiChat({ geminiKey, geminiModel }, { system, messages, json = false, temperature, timeout = 180000 }) {
  if (!geminiKey) throw new Error('還沒填 Gemini API key。請到擴充功能的設定頁填寫。');
  const model = (geminiModel || GEMINI_MODEL).replace(/^models\//, '');
  const contents = messages.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }, ...(m.images || []).map((data) => ({ inlineData: { mimeType: 'image/jpeg', data } }))],
  }));
  while (contents[0]?.role === 'model') contents.shift(); // Gemini 的對話要從使用者開始

  let res;
  try {
    res = await fetch(`${GEMINI}/models/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': geminiKey }, // key 放 header，不放網址
      signal: AbortSignal.timeout(timeout),
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents,
        generationConfig: {
          ...(json ? { responseMimeType: 'application/json' } : {}),
          ...(temperature != null ? { temperature } : {}),
        },
      }),
    });
  } catch (err) {
    if (err.name === 'TimeoutError') throw new Error('AI 想太久了，請再試一次。');
    throw new Error('連不到 Gemini，請確認網路有沒有通。');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(geminiError(res.status, data, model));
  if (data.promptFeedback?.blockReason) throw new Error(`Gemini 拒絕回答（${data.promptFeedback.blockReason}）`);
  const parts = data.candidates?.[0]?.content?.parts || [];
  return { text: parts.filter((p) => !p.thought).map((p) => p.text || '').join('').trim(), model };
}

function geminiError(status, data, model) {
  const detail = String(data.error?.message || '').slice(0, 200);
  if (status === 400 && /api key/i.test(detail)) return 'Gemini API key 不對，請到設定頁重新貼上。';
  if (status === 403) return `Gemini 拒絕這組 key（403）：${detail}`;
  if (status === 404) return `Gemini 找不到模型「${model}」，請到設定頁改模型名稱。`;
  if (status === 429) return 'Gemini 免費額度用完了（每分鐘或每天有上限），請等一下再試。';
  return `Gemini 回應錯誤（${status}）：${detail}`;
}

async function testAi() {
  const { text, model } = await chat({
    system: '你是連線測試。',
    messages: [{ role: 'user', content: '請只回答「連線成功」四個字。' }],
    timeout: 60000,
  });
  return { answer: text, model };
}

async function ask({ question, step, history = [] }) {
  const { text } = await chat({
    system: `${SYSTEM_PROMPT}\n\n使用者目前在教學的${step}。`,
    messages: [...history, { role: 'user', content: question }],
    numCtx: 16384,
  });
  return text || '（AI 沒有回答，請換個說法再問一次）';
}

// ---------- 找不到按鈕時：截圖並畫上編號 ----------
// 回傳 { image }（base64 JPEG），或 { image: null, why } 說明為什麼沒截圖
async function capture({ candidates, viewport }, sender) {
  if (!(await chrome.permissions.contains({ origins: ['<all_urls>'] }))) return { image: null, why: 'no-permission' };
  let vision;
  try {
    vision = await canSeeImages();
  } catch {
    return { image: null, why: 'no-ollama' };
  }
  if (!vision) return { image: null, why: 'no-vision-model' };

  const dataUrl = await chrome.tabs.captureVisibleTab(sender.tab.windowId, { format: 'png' });
  const bitmap = await createImageBitmap(await (await fetch(dataUrl)).blob());

  // 截圖是實際像素，元素位置是網頁的 CSS 像素，要換算；再縮小到最寬 1280，AI 比較快
  const shrink = Math.min(1, 1280 / bitmap.width);
  const canvas = new OffscreenCanvas(Math.round(bitmap.width * shrink), Math.round(bitmap.height * shrink));
  const ctx = canvas.getContext('2d');
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const k = (bitmap.width / viewport.width) * shrink;

  ctx.lineWidth = 2;
  ctx.font = 'bold 13px sans-serif';
  for (const c of candidates) {
    const [x, y, w, h] = c.rect.map((v) => v * k);
    ctx.strokeStyle = '#e5007a';
    ctx.strokeRect(x, y, w, h);
    const label = String(c.i);
    const tagW = ctx.measureText(label).width + 6;
    const tagY = y >= 15 ? y - 15 : y;
    ctx.fillStyle = '#e5007a';
    ctx.fillRect(x, tagY, tagW, 15);
    ctx.fillStyle = '#fff';
    ctx.fillText(label, x + 3, tagY + 12);
  }

  const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.8 });
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return { image: btoa(binary) };
}

// ---------- 請 AI 選出這一步要按的元素 ----------
async function findTarget({ step, hints, candidates, image }) {
  const describe = (c) =>
    `[${c.i}] ${c.tag}` +
    (c.text ? `「${c.text}」` : '（沒有文字）') +
    (c.aria ? ` aria-label=「${c.aria}」` : '') +
    (c.lb ? ` 名稱（aria-labelledby）=「${c.lb}」` : '') +
    (c.ph ? ` placeholder=「${c.ph}」` : '') +
    (c.title ? ` title=「${c.title}」` : '');
  const text =
    `教學步驟：${step.title}\n說明：${step.text}\n\n` +
    `原本的按鈕線索（現在找不到）：\n${hints.map((h) => `- ${h}`).join('\n')}\n\n` +
    `畫面上的元素清單：\n${candidates.map(describe).join('\n')}`;

  const reply = await chat({
    system: FIND_PROMPT,
    messages: [{ role: 'user', content: text, ...(image ? { images: [image] } : {}) }],
    json: true,
    temperature: 0,
  });
  const { model } = reply;

  const parsed = parseJson(reply.text);
  const index = Number(parsed.index);
  const valid = Number.isInteger(index) && candidates.some((c) => c.i === index);
  return { index: valid ? index : -1, reason: String(parsed.reason || '').slice(0, 200), model, mode: image ? 'vision' : 'text' };
}

// AI 回的 JSON 有時候前後會多一些字，盡量把 {...} 挖出來；解析不了回傳 {}
function parseJson(raw = '') {
  try {
    return JSON.parse(raw);
  } catch {
    const m = raw.match(/\{[\s\S]*\}/);
    if (m) try { return JSON.parse(m[0]); } catch { /* 當成沒有內容 */ }
  }
  return {};
}

// ---------- 用截圖做教學：一張截圖 → 一或多個步驟 ----------
// goal：這套教學要做什麼　note：老師對這張截圖的補充　previous：前面已經寫好的步驟標題
async function makeSteps({ image, goal, note, previous = [] }) {
  const text =
    (goal ? `這套教學要做的事：${goal}\n` : '') +
    (previous.length ? `前面已經寫好的步驟：\n${previous.map((t, i) => `${i + 1}. ${t}`).join('\n')}\n` : '') +
    (note ? `老師對這張截圖的補充：${note}\n` : '') +
    '請寫出這張截圖的步驟。';

  const reply = await chat({
    system: MAKE_PROMPT,
    messages: [{ role: 'user', content: text, images: [image] }],
    json: true,
    temperature: 0.2,
    timeout: 300000,
  });
  const { model } = reply;

  const parsed = parseJson(reply.text);
  const list = Array.isArray(parsed.steps) ? parsed.steps : parsed.title ? [parsed] : [];
  const str = (v, max) => String(v ?? '').trim().slice(0, max);
  const steps = list
    .map((s) => ({
      title: str(s.title, 60),
      body: str(s.body, 500),
      buttons: (Array.isArray(s.buttons) ? s.buttons : [s.buttons]).map((b) => str(b, 60)).filter(Boolean).slice(0, 5),
      url: /^https?:\/\//.test(str(s.url, 500)) ? str(s.url, 500) : '',
    }))
    .filter((s) => s.title || s.body);
  return { steps, model };
}
