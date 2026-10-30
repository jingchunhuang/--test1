// 用截圖做教學：上傳截圖 → background.js 交給 AI（Ollama 或 Gemini）看圖寫步驟 → 修改 → 存進 chrome.storage 的 customCourses
// 存好的教學由 courses.js 的 Guide.setCustomCourses 換成一般步驟，出現在面板的下拉選單「我的教學」
const $ = (id) => document.getElementById(id);

const MAX_W = 1280; // 截圖縮小到最寬 1280、最高 2000，AI 比較快
const MAX_H = 2000;

let shots = []; // { id, name, dataUrl, note, status: ''|'busy'|'done'|'fail' }
let steps = []; // { title, body, buttons: [], url, img }
let editingId = null; // 正在修改哪一套已存的教學
let dirty = false; // 有沒有還沒存的修改
let nextId = 1;

function el(tag, props = {}, ...children) {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children);
  return node;
}

// ---------- 截圖 ----------
async function toJpeg(file) {
  const bitmap = await createImageBitmap(file);
  const k = Math.min(1, MAX_W / bitmap.width, MAX_H / bitmap.height);
  const canvas = el('canvas', { width: Math.round(bitmap.width * k), height: Math.round(bitmap.height * k) });
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff'; // 透明的 PNG 轉 JPEG 會變黑底
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.85);
}

async function addFiles(files) {
  const images = [...files].filter((f) => f.type.startsWith('image/'));
  images.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  for (const file of images) {
    try {
      shots.push({ id: nextId++, name: file.name || '貼上的截圖', dataUrl: await toJpeg(file), note: '', status: '' });
    } catch {
      setStatus(`「${file.name}」讀不出來，請換成 PNG 或 JPG。`, 'no');
    }
  }
  renderShots();
}

function renderShots() {
  const box = $('shots');
  box.replaceChildren(
    ...shots.map((shot, i) => {
      const note = el('input', { type: 'text', placeholder: '補充說明（選填）', value: shot.note });
      note.oninput = () => (shot.note = note.value);
      const img = el('img', { src: shot.dataUrl, alt: shot.name, title: '點一下放大' });
      img.onclick = () => zoom(shot.dataUrl);
      const icon = { busy: '⏳ ', done: '✅ ', fail: '❌ ' }[shot.status] || '';
      return el(
        'div',
        { className: `shot ${shot.status}` },
        img,
        el(
          'div',
          { className: 'row' },
          el('b', { textContent: `${icon}${i + 1}. ${shot.name}`.slice(0, 40) }),
          smallBtn('←', '往前', () => move(shots, i, -1, renderShots), i === 0),
          smallBtn('→', '往後', () => move(shots, i, 1, renderShots), i === shots.length - 1),
          smallBtn('✕', '拿掉這張', () => {
            shots.splice(i, 1);
            renderShots();
          })
        ),
        note
      );
    })
  );
  const todo = shots.filter((s) => s.status !== 'done').length;
  $('generate').disabled = !todo || generating;
  $('generate').textContent = todo ? `🤖 產生步驟（${todo} 張）` : '🤖 產生步驟';
  $('clearShots').disabled = !shots.length || generating;
}

function smallBtn(text, title, onclick, disabled = false) {
  return el('button', { className: 'small secondary', textContent: text, title, onclick, disabled });
}

function move(list, i, d, rerender) {
  const j = i + d;
  if (j < 0 || j >= list.length) return;
  [list[i], list[j]] = [list[j], list[i]];
  dirty = true;
  rerender();
}

function zoom(src) {
  $('zoom').querySelector('img').src = src;
  $('zoom').showModal();
}
$('zoom').onclick = () => $('zoom').close();

const drop = $('drop');
drop.onclick = () => $('file').click();
$('file').onchange = () => {
  addFiles($('file').files);
  $('file').value = '';
};
drop.ondragover = (e) => {
  e.preventDefault();
  drop.classList.add('over');
};
drop.ondragleave = () => drop.classList.remove('over');
drop.ondrop = (e) => {
  e.preventDefault();
  drop.classList.remove('over');
  addFiles(e.dataTransfer.files);
};
document.addEventListener('paste', (e) => {
  const files = [...e.clipboardData.items].filter((it) => it.kind === 'file').map((it) => it.getAsFile());
  if (files.length) {
    e.preventDefault();
    addFiles(files);
  }
});
$('clearShots').onclick = () => {
  shots = [];
  renderShots();
};

// ---------- 請 AI 寫步驟 ----------
let generating = false;

function setStatus(text, kind = '') {
  $('status').textContent = text;
  $('status').className = kind;
}

$('generate').onclick = async () => {
  const todo = shots.filter((s) => s.status !== 'done');
  if (!todo.length) return;
  generating = true;
  let added = 0;
  let model = '';
  for (const [n, shot] of todo.entries()) {
    shot.status = 'busy';
    renderShots();
    setStatus(`🤖 AI 正在看第 ${n + 1} / ${todo.length} 張截圖…（一張可能要等幾秒到一分鐘）`);
    let res;
    try {
      res = await chrome.runtime.sendMessage({
        type: 'makeSteps',
        image: shot.dataUrl.split(',')[1],
        goal: [$('title').value.trim(), $('goal').value.trim()].filter(Boolean).join('：'),
        note: shot.note.trim(),
        previous: steps.map((s) => s.title).filter(Boolean),
      });
    } catch (err) {
      res = { ok: false, error: err.message };
    }
    if (!res?.ok) {
      shot.status = 'fail';
      generating = false;
      renderShots();
      setStatus(`❌ 第 ${n + 1} 張沒有成功：${res?.error || '沒有回應'}`, 'no');
      return;
    }
    shot.status = 'done';
    if (!res.steps.length) {
      // AI 看不懂這張，留一個空白步驟讓人自己寫
      steps.push({ title: '', body: '', buttons: [], url: '', img: shot.dataUrl, empty: true });
    } else {
      for (const s of res.steps) steps.push({ ...s, img: shot.dataUrl });
    }
    added += res.steps.length;
    model = res.model;
    dirty = true;
    renderSteps();
  }
  generating = false;
  renderShots();
  const empty = steps.filter((s) => s.empty).length;
  setStatus(
    `✅ 完成，新增了 ${added} 步（AI 模型：${model}）。請到下面檢查每一步，改好再按「儲存教學」。` +
      (empty ? `\n有 ${empty} 張截圖 AI 看不懂，留了空白步驟，請自己填。` : ''),
    'ok'
  );
  $('steps').scrollIntoView({ behavior: 'smooth' });
};

// ---------- 修改步驟 ----------
function field(labelText, input) {
  return [el('label', { textContent: labelText }), input];
}

function renderSteps() {
  const box = $('steps');
  if (!steps.length) {
    box.replaceChildren(el('p', { className: 'hint', textContent: '還沒有步驟。上傳截圖按「產生步驟」，或按「自己新增一步」。' }));
    return;
  }
  box.replaceChildren(
    ...steps.map((s, i) => {
      const title = el('input', { type: 'text', value: s.title, placeholder: '例如：打開 Settings' });
      const body = el('textarea', { value: s.body, placeholder: '告訴使用者要點哪裡、要填什麼' });
      const buttons = el('textarea', { value: s.buttons.join('\n'), placeholder: '一行一個，例如：\nSettings\nSave' });
      const url = el('input', { type: 'text', value: s.url, placeholder: 'https://github.com/...（選填）' });
      buttons.style.minHeight = '44px';
      title.oninput = () => edit(() => (s.title = title.value));
      body.oninput = () => edit(() => (s.body = body.value));
      buttons.oninput = () => edit(() => (s.buttons = buttons.value.split('\n').map((b) => b.trim()).filter(Boolean)));
      url.oninput = () => edit(() => (s.url = url.value.trim()));

      let pic;
      if (s.img) {
        pic = el('img', { src: s.img, alt: `第 ${i + 1} 步的截圖`, title: '點一下放大' });
        pic.onclick = () => zoom(s.img);
      } else {
        pic = el('div', { className: 'noimg', textContent: '沒有截圖' });
      }
      return el(
        'div',
        { className: 'step' },
        pic,
        el(
          'div',
          {},
          el(
            'div',
            { className: 'tools' },
            el('span', { className: 'num', textContent: `第 ${i + 1} 步${s.empty ? '（AI 看不懂，請自己寫）' : ''}` }),
            smallBtn('↑', '往上', () => move(steps, i, -1, renderSteps), i === 0),
            smallBtn('↓', '往下', () => move(steps, i, 1, renderSteps), i === steps.length - 1),
            smallBtn('刪除', '刪除這一步', () => {
              steps.splice(i, 1);
              dirty = true;
              renderSteps();
            })
          ),
          ...field('標題', title),
          ...field('說明', body),
          ...field('要框的按鈕（網頁上按鈕的文字）', buttons),
          ...field('網址（這一步在哪個頁面做）', url)
        )
      );
    })
  );
}

function edit(fn) {
  fn();
  dirty = true;
}

$('addStep').onclick = () => {
  steps.push({ title: '', body: '', buttons: [], url: '', img: '' });
  dirty = true;
  renderSteps();
  $('steps').lastElementChild.querySelector('input').focus();
};

$('reset').onclick = () => {
  if (dirty && !confirm('還沒儲存的修改會不見，確定要重新開始嗎？')) return;
  shots = [];
  steps = [];
  editingId = null;
  dirty = false;
  $('title').value = '';
  $('goal').value = '';
  setStatus('');
  $('saveStatus').textContent = '';
  renderShots();
  renderSteps();
};

window.addEventListener('beforeunload', (e) => {
  if (dirty) e.preventDefault();
});

// ---------- 儲存 ----------
const loadCourses = async () => (await chrome.storage.local.get('customCourses')).customCourses || [];

async function save() {
  const title = $('title').value.trim();
  const clean = steps
    .map((s) => ({ title: s.title.trim(), body: s.body.trim(), buttons: s.buttons, url: s.url }))
    .filter((s) => s.title || s.body);
  const say = (text, kind) => {
    $('saveStatus').textContent = text;
    $('saveStatus').className = kind;
  };
  if (!title) {
    say('請先在最上面填「教學名稱」。', 'no');
    $('title').focus();
    return null;
  }
  if (!clean.length) {
    say('還沒有步驟（標題和說明都空白的步驟不會存）。', 'no');
    return null;
  }
  const bad = clean.findIndex((s) => s.url && !/^https?:\/\//.test(s.url));
  if (bad >= 0) {
    say(`第 ${bad + 1} 步的網址要用 https:// 開頭。`, 'no');
    return null;
  }
  const list = await loadCourses();
  const id = editingId || Date.now().toString(36);
  const course = { id, title, goal: $('goal').value.trim(), steps: clean, updatedAt: new Date().toISOString() };
  const i = list.findIndex((c) => c.id === id);
  if (i >= 0) list[i] = course;
  else list.push(course);
  await chrome.storage.local.set({ customCourses: list });
  editingId = id;
  dirty = false;
  say(`✅ 已儲存「${title}」（${clean.length} 步）。教學面板的下拉選單「我的教學」裡就找得到。`, 'ok');
  showSaved();
  return course;
}

$('save').onclick = save;
$('saveStart').onclick = async () => {
  const course = await save();
  if (!course) return;
  const { guideState = {} } = await chrome.storage.local.get('guideState');
  await chrome.storage.local.set({ guideState: { ...guideState, course: `custom:${course.id}`, step: 0, open: true, armed: '' } });
  const first = course.steps[0].url;
  if (first) chrome.tabs.create({ url: first });
  else $('saveStatus').textContent += ' 已切換到這套教學，打開 GitHub 等網站就會看到。';
};

// ---------- 已經做好的教學 ----------
async function showSaved() {
  const list = await loadCourses();
  const box = $('saved');
  if (!list.length) {
    box.replaceChildren(el('p', { className: 'hint', textContent: '目前沒有。' }));
    return;
  }
  const table = el('table');
  table.innerHTML = '<tr><th>教學名稱</th><th>步驟</th><th></th></tr>';
  for (const c of list) {
    const ops = el(
      'td',
      { className: 'ops' },
      smallBtn('修改', '載入到上面修改', () => {
        if (dirty && !confirm('還沒儲存的修改會不見，確定要換成這套教學嗎？')) return;
        editingId = c.id;
        $('title').value = c.title;
        $('goal').value = c.goal || '';
        steps = c.steps.map((s) => ({ title: s.title, body: s.body, buttons: [...(s.buttons || [])], url: s.url || '', img: '' }));
        shots = [];
        dirty = false;
        renderShots();
        renderSteps();
        $('saveStatus').textContent = `正在修改「${c.title}」，改好按「儲存教學」會覆蓋原本的。`;
        $('title').scrollIntoView({ behavior: 'smooth' });
      }),
      ' ',
      smallBtn('匯出', '複製 JSON，可以傳給同學匯入', async (e) => {
        const text = JSON.stringify({ title: c.title, goal: c.goal, steps: c.steps }, null, 2);
        try {
          await navigator.clipboard.writeText(text);
          e.target.textContent = '已複製！';
        } catch {
          $('json').hidden = false;
          $('json').value = text;
          $('json').select();
        }
      }),
      ' ',
      smallBtn('刪除', '刪除這套教學', async () => {
        if (!confirm(`確定要刪除「${c.title}」嗎？`)) return;
        await chrome.storage.local.set({ customCourses: (await loadCourses()).filter((x) => x.id !== c.id) });
        if (editingId === c.id) editingId = null;
        showSaved();
      })
    );
    table.append(el('tr', {}, el('td', { textContent: c.title }), el('td', { textContent: `${c.steps.length} 步` }), ops));
  }
  box.replaceChildren(table);
}

$('import').onclick = async () => {
  const box = $('json');
  if (box.hidden || !box.value.trim()) {
    box.hidden = false;
    box.value = '';
    box.focus();
    return;
  }
  let data;
  try {
    data = JSON.parse(box.value);
  } catch {
    alert('JSON 格式不對，請確認有整段複製。');
    return;
  }
  const str = (v) => String(v ?? '').trim();
  const course = {
    id: Date.now().toString(36),
    title: str(data.title) || '匯入的教學',
    goal: str(data.goal),
    steps: (Array.isArray(data.steps) ? data.steps : [])
      .map((s) => ({
        title: str(s.title),
        body: str(s.body),
        buttons: (Array.isArray(s.buttons) ? s.buttons : []).map(str).filter(Boolean),
        url: /^https?:\/\//.test(str(s.url)) ? str(s.url) : '',
      }))
      .filter((s) => s.title || s.body),
    updatedAt: new Date().toISOString(),
  };
  if (!course.steps.length) {
    alert('這段 JSON 裡沒有步驟。');
    return;
  }
  await chrome.storage.local.set({ customCourses: [...(await loadCourses()), course] });
  box.value = '';
  box.hidden = true;
  showSaved();
};

renderShots();
renderSteps();
showSaved();
