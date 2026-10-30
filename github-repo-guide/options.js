// 設定頁：用哪個 AI、截圖權限、AI 找到的按鈕紀錄
const ALL_SITES = { origins: ['<all_urls>'] };
const $ = (id) => document.getElementById(id);

// ---------- 用哪個 AI（background.js 從 aiSettings 讀） ----------
const providerBoxes = [...document.querySelectorAll('input[name="provider"]')];
const showGeminiBox = () => ($('gemini-box').hidden = !providerBoxes.find((b) => b.value === 'gemini').checked);
const setAiStatus = (text, ok) => {
  $('ai-status').textContent = text;
  $('ai-status').className = `status ${ok ? 'ok' : 'no'}`;
};

async function loadAi() {
  const { aiSettings = {} } = await chrome.storage.local.get('aiSettings');
  const provider = aiSettings.provider || 'ollama';
  for (const b of providerBoxes) b.checked = b.value === provider;
  $('gemini-key').value = aiSettings.geminiKey || '';
  $('gemini-model').value = aiSettings.geminiModel || '';
  showGeminiBox();
}

async function saveAi() {
  const aiSettings = {
    provider: providerBoxes.find((b) => b.checked)?.value || 'ollama',
    geminiKey: $('gemini-key').value.trim(),
    geminiModel: $('gemini-model').value.trim(),
  };
  await chrome.storage.local.set({ aiSettings });
  return aiSettings;
}

for (const b of providerBoxes) b.onchange = showGeminiBox;
$('toggle-key').onclick = () => {
  const show = $('gemini-key').type === 'password';
  $('gemini-key').type = show ? 'text' : 'password';
  $('toggle-key').textContent = show ? '隱藏' : '顯示';
};
$('save-ai').onclick = async () => {
  await saveAi();
  setAiStatus('已儲存', true);
};
$('test-ai').onclick = async () => {
  const s = await saveAi(); // 先存，測的就是畫面上填的設定
  if (s.provider === 'gemini' && !s.geminiKey) return setAiStatus('請先貼上 API key', false);
  setAiStatus('測試中…', true);
  chrome.runtime.sendMessage({ type: 'testAi' }, (resp) => {
    if (chrome.runtime.lastError || !resp) return setAiStatus(`沒有回應：${chrome.runtime.lastError?.message || ''}`, false);
    if (!resp.ok) return setAiStatus(`失敗：${resp.error}`, false);
    setAiStatus(`成功（${resp.model}）：${resp.answer}`, true);
  });
};

async function showPermission() {
  const granted = await chrome.permissions.contains(ALL_SITES);
  $('perm').textContent = granted ? '已允許' : '還沒允許';
  $('perm').className = `status ${granted ? 'ok' : 'no'}`;
}

$('grant').onclick = async () => {
  await chrome.permissions.request(ALL_SITES); // 要在按鈕點擊裡呼叫，Chrome 才會跳出詢問
  showPermission();
};
$('revoke').onclick = async () => {
  await chrome.permissions.remove(ALL_SITES);
  showPermission();
};

async function loadFound() {
  const { guideState } = await chrome.storage.local.get('guideState');
  return guideState?.aiFound || {};
}

async function showFound() {
  const found = await loadFound();
  const rows = Object.values(found);
  const box = $('found');
  box.replaceChildren();
  if (!rows.length) {
    box.textContent = '目前沒有紀錄。';
    return;
  }
  const table = document.createElement('table');
  table.innerHTML = '<tr><th>教學／步驟</th><th>原本的線索</th><th>AI 找到的</th><th>理由</th><th>網址</th></tr>';
  for (const r of rows) {
    const tr = document.createElement('tr');
    const t = r.target || {};
    const cells = [
      `${r.course}／${r.step}`,
      (r.original || []).join('、'),
      t.text ? `文字「${t.text}」` : t.selector || '',
      `${r.reason || ''}（${r.mode === 'vision' ? '看截圖' : '看按鈕清單'}，${r.model || ''}）`,
      r.url || '',
    ];
    for (const c of cells) {
      const td = document.createElement('td');
      td.textContent = c;
      tr.append(td);
    }
    table.append(tr);
  }
  box.append(table);
}

$('copy').onclick = async () => {
  const text = JSON.stringify(Object.values(await loadFound()), null, 2);
  $('json').hidden = false;
  $('json').value = text;
  $('json').select();
  try {
    await navigator.clipboard.writeText(text);
    $('copy').textContent = '已複製！';
  } catch {
    $('copy').textContent = '請按 Ctrl+C 複製下面的文字';
  }
};

$('clear').onclick = async () => {
  const { guideState } = await chrome.storage.local.get('guideState');
  if (guideState) await chrome.storage.local.set({ guideState: { ...guideState, aiFound: {} } });
  showFound();
};

loadAi();
showPermission();
showFound();
