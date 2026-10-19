// 背景程式：把問題交給電腦上的 Ollama（不會連到網路上的 AI）
//   ask        「問問題」答不出來的問題
//   capture    找不到按鈕時截圖，並在每個可以點的元素上畫框和編號
//   findTarget 請 AI 看截圖（或元素清單）選出這一步要按的按鈕
//   makeSteps  「用截圖做教學」頁面上傳的截圖，請 AI 寫成教學步驟
importScripts('faq.js');

const OLLAMA = 'http://127.0.0.1:11434';
const MODEL = 'qwen2.5:3b'; // 文字模型：想換就改這裡；沒裝這個模型時會自動用已安裝的第一個
const VISION_MODEL = 'qwen2.5vl:3b'; // 看圖模型：建議安裝的版本（裝了別的看圖模型也會自動用）
const VISION_NAME = /(vl\b|llava|vision|gemma3|minicpm-v|moondream)/i; // 從名稱判斷是不是看圖模型

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

async function ask({ question, step, history = [] }) {
  const model = await pickModel();
  const data = await ollamaFetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(180000),
    body: JSON.stringify({
      model,
      stream: false,
      options: { num_ctx: 16384 },
      messages: [
        { role: 'system', content: `${SYSTEM_PROMPT}\n\n使用者目前在教學的${step}。` },
        ...history,
        { role: 'user', content: question },
      ],
    }),
  });
  return data.message?.content?.trim() || '（AI 沒有回答，請換個說法再問一次）';
}

// ---------- 找不到按鈕時：截圖並畫上編號 ----------
// 回傳 { image }（base64 JPEG），或 { image: null, why } 說明為什麼沒截圖
async function capture({ candidates, viewport }, sender) {
  if (!(await chrome.permissions.contains({ origins: ['<all_urls>'] }))) return { image: null, why: 'no-permission' };
  let vision;
  try {
    vision = await pickVisionModel();
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
  const model = image ? await pickVisionModel() : await pickModel();
  const describe = (c) =>
    `[${c.i}] ${c.tag}` +
    (c.text ? `「${c.text}」` : '（沒有文字）') +
    (c.aria ? ` aria-label=「${c.aria}」` : '') +
    (c.ph ? ` placeholder=「${c.ph}」` : '') +
    (c.title ? ` title=「${c.title}」` : '');
  const text =
    `教學步驟：${step.title}\n說明：${step.text}\n\n` +
    `原本的按鈕線索（現在找不到）：\n${hints.map((h) => `- ${h}`).join('\n')}\n\n` +
    `畫面上的元素清單：\n${candidates.map(describe).join('\n')}`;

  const data = await ollamaFetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(180000),
    body: JSON.stringify({
      model,
      stream: false,
      format: 'json',
      options: { num_ctx: 8192, temperature: 0 },
      messages: [
        { role: 'system', content: FIND_PROMPT },
        { role: 'user', content: text, ...(image ? { images: [image] } : {}) },
      ],
    }),
  });

  const parsed = parseJson(data.message?.content);
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
  const model = await pickVisionModel();
  if (!model) throw new Error(`還沒安裝看圖模型。請在 cmd 執行：\nollama pull ${VISION_MODEL}`);
  const text =
    (goal ? `這套教學要做的事：${goal}\n` : '') +
    (previous.length ? `前面已經寫好的步驟：\n${previous.map((t, i) => `${i + 1}. ${t}`).join('\n')}\n` : '') +
    (note ? `老師對這張截圖的補充：${note}\n` : '') +
    '請寫出這張截圖的步驟。';

  const data = await ollamaFetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(300000),
    body: JSON.stringify({
      model,
      stream: false,
      format: 'json',
      options: { num_ctx: 8192, temperature: 0.2 },
      messages: [
        { role: 'system', content: MAKE_PROMPT },
        { role: 'user', content: text, images: [image] },
      ],
    }),
  });

  const parsed = parseJson(data.message?.content);
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
