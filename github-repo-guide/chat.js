// 問問題：先找常見問題（faq.js），找不到再交給 AI（設定頁選的 Ollama 或 Gemini，經過 background.js）
(() => {
  const { el, extensionAlive, state, course, currentStep } = Guide;

  const messages = [];
  let msgsBox;

  // 把「問問題」按鈕和對話區放進面板裡
  function mountChat(container) {
    container.insertAdjacentHTML(
      'beforeend',
      `<button class="gh-guide-ask-toggle">❓ 問問題</button>
      <div class="gh-guide-chat" hidden>
        <div class="gh-guide-msgs"></div>
        <form class="gh-guide-form">
          <input class="gh-guide-input" placeholder="例如：網站顯示 404 怎麼辦？">
          <button type="submit">送出</button>
        </form>
      </div>`
    );
    const chatBox = container.querySelector('.gh-guide-chat');
    const input = container.querySelector('.gh-guide-input');
    msgsBox = container.querySelector('.gh-guide-msgs');

    container.querySelector('.gh-guide-ask-toggle').onclick = () => {
      chatBox.hidden = !chatBox.hidden;
      if (!chatBox.hidden) {
        if (!messages.length) {
          addMessage({ role: 'bot', text: '有什麼問題都可以問我！例如「網站顯示 404」「Render 網站沒更新」。', intro: true });
        }
        input.focus();
      }
    };
    container.querySelector('.gh-guide-form').onsubmit = (e) => {
      e.preventDefault();
      const q = input.value.trim();
      if (!q) return;
      input.value = '';
      sendQuestion(q);
    };
  }

  function addMessage(m) {
    messages.push(m);
    renderMessages();
    return m;
  }

  function renderMessages() {
    msgsBox.replaceChildren(
      ...messages.map((m) => {
        const box = el('div', `gh-guide-msg gh-guide-msg-${m.role}${m.source === 'error' ? ' gh-guide-msg-error' : ''}`);
        if (m.title) box.append(el('div', 'gh-guide-msg-title', `常見問題：${m.title}`));
        if (m.source === 'ai') box.append(el('div', 'gh-guide-msg-title', 'AI 回答（可能有錯，請自己確認）'));
        box.append(el('div', 'gh-guide-msg-text', m.text));
        if (m.source === 'faq') {
          const btn = el('button', 'gh-guide-ask-ai', '不是我要的答案，問 AI');
          btn.onclick = () => askAI(m.question);
          box.append(btn);
        }
        return box;
      })
    );
    msgsBox.scrollTop = msgsBox.scrollHeight;
  }

  function matchFaq(question) {
    if (typeof GUIDE_FAQ === 'undefined') return null;
    const q = question.toLowerCase();
    let best = null;
    let bestScore = 0;
    for (const item of GUIDE_FAQ) {
      let hits = 0;
      let len = 0;
      for (const k of item.keywords) {
        if (q.includes(k.toLowerCase())) {
          hits++;
          len += k.length;
        }
      }
      const score = hits * 100 + len; // 符合的關鍵字越多越優先，一樣多就看關鍵字越長越精準
      if (hits && score > bestScore) {
        best = item;
        bestScore = score;
      }
    }
    return best;
  }

  function sendQuestion(question) {
    addMessage({ role: 'user', text: question });
    const hit = matchFaq(question);
    if (hit) addMessage({ role: 'bot', text: hit.a, title: hit.q, source: 'faq', question });
    else askAI(question);
  }

  function askAI(question) {
    if (!extensionAlive()) {
      addMessage({ role: 'bot', text: '擴充功能剛更新過，請按 F5 重新整理頁面再問。', source: 'error' });
      return;
    }
    // 之前的對話（不含錯誤訊息和常見問題的回答），讓 AI 知道前後文
    const prior = messages.filter((m) => m.source !== 'error' && m.source !== 'faq' && !m.pending && !m.intro);
    if (prior.at(-1)?.role === 'user' && prior.at(-1).text === question) prior.pop();
    const history = prior.slice(-6).map((m) => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.text }));

    const pending = addMessage({ role: 'bot', text: 'AI 思考中…（第一次可能要等比較久）', pending: true });
    const step = `「${course().title}」教學的第 ${state.step + 1} 步「${currentStep().title}」`;
    try {
      chrome.runtime.sendMessage({ type: 'ask', question, step, history }, (resp) => {
        pending.pending = false;
        if (chrome.runtime.lastError || !resp) {
          pending.text = `沒辦法連到 AI：${chrome.runtime.lastError?.message || '沒有回應'}`;
          pending.source = 'error';
        } else if (resp.ok) {
          pending.text = resp.answer.replace(/\*\*/g, '');
          pending.source = 'ai';
        } else {
          pending.text = resp.error;
          pending.source = 'error';
        }
        renderMessages();
      });
    } catch {
      pending.pending = false;
      pending.text = '擴充功能剛更新過，請按 F5 重新整理頁面再問。';
      pending.source = 'error';
      renderMessages();
    }
  }

  Guide.mountChat = mountChat;
})();
