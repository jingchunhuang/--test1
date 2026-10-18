// 把常見問題找不到答案的問題，交給電腦上的 Ollama 回答（不會連到網路上的 AI）
importScripts('faq.js');

const OLLAMA = 'http://127.0.0.1:11434';
const MODEL = 'qwen2.5:3b'; // 想換模型就改這裡；沒裝這個模型時會自動用已安裝的第一個

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

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type !== 'ask') return;
  ask(msg).then(
    (answer) => sendResponse({ ok: true, answer }),
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

async function pickModel() {
  const { models = [] } = await ollamaFetch('/api/tags');
  if (!models.length) throw new Error(`Ollama 裡還沒有模型。請在 cmd 執行：\nollama pull ${MODEL}`);
  const names = models.map((m) => m.name);
  return names.includes(MODEL) ? MODEL : names[0];
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
