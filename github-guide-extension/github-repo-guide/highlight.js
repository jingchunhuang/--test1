// 找按鈕、畫橘色框，並在按鈕下面放提示文字
(() => {
  const { el, onGitHub, path } = Guide;

  const labels = new Map(); // 被標示的元素 -> 提示框
  const targetOf = new WeakMap(); // 被標示的元素 -> 它對應的 target（判斷「點了就完成」用）
  const CLICKABLE =
    'button, a, summary, label, [role="button"], [role="link"], [role="tab"], [role="treeitem"], [role="menuitem"], [role="menuitemradio"], [role="option"]';

  // 用按鈕上的文字找（不分大小寫，開頭符合就算）
  function findByText(text) {
    const want = text.toLowerCase();
    const matches = [...document.querySelectorAll(CLICKABLE)].filter(
      (node) => !node.closest('.gh-guide-panel') && node.textContent.trim().toLowerCase().startsWith(want)
    );
    // 外層和內層都符合時，只留最內層
    return matches.filter((node) => !matches.some((o) => o !== node && node.contains(o)));
  }

  function find(target) {
    if (target.path && !(onGitHub() && target.path.test(path()))) return [];
    if (target.selector) return [...document.querySelectorAll(target.selector)];
    return findByText(target.text);
  }

  // 標示這些按鈕，其他之前標示的拿掉；回傳找到幾個
  function highlight(targets) {
    const wanted = new Set();
    for (const target of targets) {
      for (const node of find(target)) {
        wanted.add(node);
        targetOf.set(node, target);
        node.classList.add('gh-guide-target');
        let label = labels.get(node);
        if (!label) {
          label = el('div', 'gh-guide-label');
          document.body.appendChild(label);
          labels.set(node, label);
        }
        if (label.textContent !== target.tip) label.textContent = target.tip;
      }
    }
    for (const [node, label] of labels) {
      if (!wanted.has(node) || !node.isConnected) {
        node.classList.remove('gh-guide-target');
        label.remove();
        labels.delete(node);
      }
    }
    position();
    return wanted.size;
  }

  // 把提示框放在按鈕正下方；按鈕看不到時就隱藏
  function position() {
    for (const [node, label] of labels) {
      const r = node.getBoundingClientRect();
      const visible = r.width > 0 && r.height > 0;
      label.style.display = visible ? 'block' : 'none';
      if (!visible) continue;
      const maxLeft = window.innerWidth - label.offsetWidth - 8;
      label.style.top = `${r.bottom + 8}px`;
      label.style.left = `${Math.max(8, Math.min(r.left, maxLeft))}px`;
    }
  }

  window.addEventListener('scroll', position, true);
  window.addEventListener('resize', position);

  Guide.highlight = highlight;
  // 點到的東西如果在某個被標示的按鈕裡，回傳那個按鈕的 target
  Guide.clickedTarget = (node) => {
    const hit = node?.closest?.('.gh-guide-target');
    return hit && labels.has(hit) ? targetOf.get(hit) : null;
  };
})();
