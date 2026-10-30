// 找按鈕、畫橘色框，並在按鈕下面放提示文字
(() => {
  const { el, onGitHub, path } = Guide;

  const labels = new Map(); // 被標示的元素 -> 提示框
  const targetOf = new WeakMap(); // 被標示的元素 -> 它對應的 target（判斷「點了就完成」用）
  const CLICKABLE =
    'button, a, summary, label, [role="button"], [role="link"], [role="tab"], [role="treeitem"], [role="menuitem"], [role="menuitemradio"], [role="option"]';

  // 按鈕上的文字符不符合（不分大小寫，開頭符合就算；exact 的話要完全一樣，例如只找「建立」不找「建立資源」）
  function textMatches(node, text, exact) {
    const want = text.toLowerCase();
    const label = node.textContent.trim().replace(/\s+/g, ' ').toLowerCase();
    return exact ? label === want : label.startsWith(want);
  }

  // 用按鈕上的文字找
  function findByText(text, exact) {
    const matches = [...document.querySelectorAll(CLICKABLE)].filter(
      (node) => !node.closest('.gh-guide-panel') && textMatches(node, text, exact)
    );
    // 外層和內層都符合時，只留最內層
    return matches.filter((node) => !matches.some((o) => o !== node && node.contains(o)));
  }

  function find(target) {
    if (target.node) return target.node.isConnected ? [target.node] : []; // AI 選的元素（沒有其他線索時）
    if (target.path && !(onGitHub() && target.path.test(path()))) return [];
    if (target.selector) {
      const nodes = [...document.querySelectorAll(target.selector)];
      // selector 和 text 都有：選擇器找到的裡面，再挑文字符合的（例如選單項目裡的「帳戶」，不要框到左邊選單的「帳戶」）
      return target.text ? nodes.filter((node) => textMatches(node, target.text, target.exact)) : nodes;
    }
    return findByText(target.text, target.exact);
  }

  let groups = []; // 上次標示時，每個 target 找到的元素（照 targets 的順序）：[{ target, nodes }]

  // 標示這些按鈕，其他之前標示的拿掉；回傳找到幾個
  function highlight(targets) {
    const wanted = new Set();
    groups = [];
    for (const target of targets) {
      const nodes = find(target);
      groups.push({ target, nodes });
      for (const node of nodes) {
        wanted.add(node);
        targetOf.set(node, target);
        node.classList.add('gh-guide-target');
        node.classList.toggle('gh-guide-target-ai', !!target.ai);
        let label = labels.get(node);
        if (!label) {
          label = el('div', 'gh-guide-label');
          document.body.appendChild(label);
          labels.set(node, label);
        }
        label.classList.toggle('gh-guide-label-ai', !!target.ai);
        if (label.textContent !== target.tip) label.textContent = target.tip;
      }
    }
    for (const [node, label] of labels) {
      if (!wanted.has(node) || !node.isConnected) {
        node.classList.remove('gh-guide-target', 'gh-guide-target-ai', 'gh-guide-target-covered');
        label.remove();
        labels.delete(node);
      }
    }
    position();
    return wanted.size;
  }

  // 被網頁上別的東西蓋住了嗎（例如跳出的對話框、灰色遮罩、側邊編輯頁）；我們自己的面板和提示不算
  function coveredByPage(node) {
    const r = node.getBoundingClientRect();
    const x = r.left + r.width / 2;
    const y = r.top + r.height / 2;
    if (x < 0 || y < 0 || x >= window.innerWidth || y >= window.innerHeight) return false; // 在畫面外的交給 nextOffscreen
    const top = document.elementFromPoint(x, y);
    if (!top || node.contains(top) || top.contains(node)) return false;
    return !top.closest('.gh-guide-panel, .gh-guide-label, .gh-guide-launcher');
  }

  // 把提示框放在按鈕正下方；按鈕看不到或被蓋住時就隱藏
  function position() {
    for (const [node, label] of labels) {
      const r = node.getBoundingClientRect();
      const covered = coveredByPage(node);
      const visible = r.width > 0 && r.height > 0 && !covered;
      // 被蓋住的連外框也收起來，不然會從遮罩底下露出來（只在有變化時改，免得一直觸發畫面變化）
      if (node.classList.contains('gh-guide-target-covered') !== covered) node.classList.toggle('gh-guide-target-covered', covered);
      label.style.display = visible ? 'block' : 'none';
      if (!visible) continue;
      const maxLeft = window.innerWidth - label.offsetWidth - 8;
      label.style.top = `${r.bottom + 8}px`;
      label.style.left = `${Math.max(8, Math.min(r.left, maxLeft))}px`;
    }
  }

  window.addEventListener('scroll', position, true);
  window.addEventListener('resize', position);

  // 現在點得到的框：有大小、沒有被對話框之類的蓋住
  const hasSize = (node) => {
    const r = node.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && !coveredByPage(node);
  };

  // 照順序「最後一個找得到的 target」就是接下來要點的（例如 ① 齒輪 → ② 資料串流，到了 ② 就看 ②）
  const nextGroup = () => groups.filter((g) => g.nodes.some(hasSize)).at(-1);
  Guide.nextNodes = () => nextGroup()?.nodes.filter(hasSize) || [];

  // 接下來要點的框全部在畫面外時，回傳 { node: 第一個框, below: 在畫面下方, scroll: 可以自動捲過去 }；看得到就回傳 null
  Guide.nextOffscreen = () => {
    const next = nextGroup();
    if (!next) return null;
    const nodes = next.nodes.filter(hasSize);
    const rects = nodes.map((node) => node.getBoundingClientRect());
    if (rects.some((r) => r.bottom > 0 && r.top < window.innerHeight)) return null;
    return { node: nodes[0], below: rects[0].top >= window.innerHeight, scroll: !next.target.noScroll };
  };

  Guide.highlight = highlight;
  Guide.countFound = (targets) => targets.reduce((n, t) => n + find(t).length, 0); // 只數，不畫
  // 點到的東西如果在某個被標示的按鈕裡，回傳那個按鈕的 target
  Guide.clickedTarget = (node) => {
    const hit = node?.closest?.('.gh-guide-target');
    return hit && labels.has(hit) ? targetOf.get(hit) : null;
  };
})();
