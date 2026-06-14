const STORAGE_KEY = "quickPhrases";
const RECENT_CATEGORY_NAME = "上次使用";
const RECENT_LIMIT = 5;

const categoryInput = document.getElementById("categoryInput");
const titleInput = document.getElementById("titleInput");
const contentInput = document.getElementById("contentInput");
const addBtn = document.getElementById("addBtn");
const clearBtn = document.getElementById("clearBtn");
const manageBtn = document.getElementById("manageBtn");
const quickSearchInput = document.getElementById("quickSearchInput");
const phraseList = document.getElementById("phraseList");

document.addEventListener("DOMContentLoaded", () => {
  renderPhrases();
});

manageBtn.addEventListener("click", () => {
  chrome.tabs.create({
    url: chrome.runtime.getURL("manage.html")
  });
});

quickSearchInput.addEventListener("input", () => {
  renderPhrases();
});

addBtn.addEventListener("click", async () => {
  const category = categoryInput.value.trim();
  const title = titleInput.value.trim();
  const content = contentInput.value;

  if (!category || !title || !content.trim()) {
    alert("分类、标题和内容不能为空。");
    return;
  }

  const phrases = await getPhrases();
  const now = Date.now();
  const phrase = {
    id: createPhraseId(phrases),
    category,
    title,
    content,
    createdAt: now
  };

  await setPhrases([...phrases, phrase]);
  clearForm();
  renderPhrases();
  refreshContextMenus();
});

clearBtn.addEventListener("click", async () => {
  const phrases = await getPhrases();

  if (!phrases.length) {
    return;
  }

  if (!confirm("确定要清空全部常用语吗？")) {
    return;
  }

  await setPhrases([]);
  renderPhrases();
  refreshContextMenus();
});

phraseList.addEventListener("click", async (event) => {
  const deleteButton = event.target.closest(".delete-btn");
  const copyButton = event.target.closest(".copy-btn");
  const insertButton = event.target.closest(".insert-btn");

  if (copyButton) {
    await copyPhrase(copyButton.dataset.id);
    return;
  }

  if (insertButton) {
    await insertPhrase(insertButton.dataset.id);
    return;
  }

  if (!deleteButton) {
    return;
  }

  const phraseId = deleteButton.dataset.id;
  const phrases = await getPhrases();
  const nextPhrases = phrases.filter((phrase) => phrase.id !== phraseId);

  await setPhrases(nextPhrases);
  renderPhrases();
  refreshContextMenus();
});

async function renderPhrases() {
  const phrases = getFilteredPhrases(await getPhrases());
  phraseList.innerHTML = "";

  if (!phrases.length) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = "暂无常用语";
    phraseList.appendChild(empty);
    return;
  }

  const grouped = groupByCategory(phrases);

  Object.entries(grouped).forEach(([category, items]) => {
    const group = document.createElement("section");
    group.className = "category-group";

    const title = document.createElement("h2");
    title.className = "category-title";
    title.textContent = category;
    group.appendChild(title);

    items.forEach((phrase) => {
      group.appendChild(createPhraseItem(phrase));
    });

    phraseList.appendChild(group);
  });
}

function createPhraseItem(phrase) {
  const item = document.createElement("article");
  item.className = "phrase-item";

  const main = document.createElement("div");
  main.className = "phrase-main";

  const title = document.createElement("div");
  title.className = "phrase-title";
  title.textContent = phrase.title;

  const actions = document.createElement("div");
  actions.className = "phrase-actions";

  const insertButton = document.createElement("button");
  insertButton.className = "small-btn insert-btn";
  insertButton.type = "button";
  insertButton.textContent = "插入";
  insertButton.dataset.id = phrase.id;

  const copyButton = document.createElement("button");
  copyButton.className = "small-btn copy-btn";
  copyButton.type = "button";
  copyButton.textContent = "复制";
  copyButton.dataset.id = phrase.id;

  const deleteButton = document.createElement("button");
  deleteButton.className = "delete-btn";
  deleteButton.type = "button";
  deleteButton.textContent = "删除";
  deleteButton.dataset.id = phrase.id;

  actions.appendChild(insertButton);
  actions.appendChild(copyButton);
  actions.appendChild(deleteButton);
  main.appendChild(title);
  main.appendChild(actions);
  item.appendChild(main);

  return item;
}

async function copyPhrase(id) {
  const phrases = await getPhrases();
  const phrase = phrases.find((item) => item.id === id);

  if (!phrase) {
    return;
  }

  await navigator.clipboard.writeText(phrase.content);
  await markPhraseUsedAndRefresh(id);
  renderPhrases();
}

async function insertPhrase(id) {
  const phrases = await getPhrases();
  const phrase = phrases.find((item) => item.id === id);

  if (!phrase) {
    return;
  }

  chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
    const tab = tabs[0];

    if (!tab || !tab.id) {
      return;
    }

    chrome.tabs.sendMessage(
      tab.id,
      {
        type: "INSERT_PHRASE",
        content: phrase.content
      },
      async () => {
        if (chrome.runtime.lastError) {
          console.warn("发送插入消息失败：", chrome.runtime.lastError.message);
          return;
        }

        await markPhraseUsedAndRefresh(id);
        renderPhrases();
      }
    );
  });
}

function getPhrases() {
  return new Promise((resolve) => {
    chrome.storage.local.get({ [STORAGE_KEY]: [] }, (result) => {
      const phrases = Array.isArray(result[STORAGE_KEY]) ? result[STORAGE_KEY] : [];
      resolve(phrases);
    });
  });
}

function setPhrases(phrases) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [STORAGE_KEY]: phrases }, () => {
      resolve();
    });
  });
}

function refreshContextMenus() {
  chrome.runtime.sendMessage({ type: "REFRESH_CONTEXT_MENUS" }, () => {
    if (chrome.runtime.lastError) {
      console.warn("通知右键菜单刷新失败：", chrome.runtime.lastError.message);
    }
  });
}

function groupByCategory(phrases) {
  const groups = {};
  const recentPhrases = getRecentPhrases(phrases);

  if (recentPhrases.length) {
    groups[RECENT_CATEGORY_NAME] = recentPhrases;
  }

  return phrases.reduce((groups, phrase) => {
    const category = phrase.category || "未分类";

    if (!groups[category]) {
      groups[category] = [];
    }

    groups[category].push(phrase);
    return groups;
  }, groups);
}

function clearForm() {
  categoryInput.value = "";
  titleInput.value = "";
  contentInput.value = "";
  categoryInput.focus();
}

function getFilteredPhrases(phrases) {
  const keyword = quickSearchInput.value.trim().toLowerCase();

  return phrases
    .filter((phrase) => {
      if (!keyword) {
        return true;
      }

      return [phrase.category, phrase.title, phrase.content]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(keyword));
    })
    .sort(compareByUsage);
}

function compareByUsage(a, b) {
  const lastUsedDiff = Number(b.lastUsedAt || 0) - Number(a.lastUsedAt || 0);

  if (lastUsedDiff !== 0) {
    return lastUsedDiff;
  }

  const usedCountDiff = Number(b.usedCount || 0) - Number(a.usedCount || 0);

  if (usedCountDiff !== 0) {
    return usedCountDiff;
  }

  return Number(b.createdAt || 0) - Number(a.createdAt || 0);
}

function getRecentPhrases(phrases) {
  return phrases
    .filter((phrase) => phrase.lastUsedAt)
    .sort((a, b) => Number(b.lastUsedAt || 0) - Number(a.lastUsedAt || 0))
    .slice(0, RECENT_LIMIT);
}

async function markPhraseUsedAndRefresh(id) {
  const phrases = await getPhrases();
  const now = Date.now();
  const nextPhrases = phrases.map((phrase) => {
    if (phrase.id !== id) {
      return phrase;
    }

    return {
      ...phrase,
      usedCount: Number(phrase.usedCount || 0) + 1,
      lastUsedAt: now
    };
  });

  await setPhrases(nextPhrases);
  refreshContextMenus();
}

function createPhraseId(phrases) {
  let id = String(Date.now());
  const existingIds = new Set(phrases.map((phrase) => phrase.id));

  while (existingIds.has(id)) {
    id = String(Date.now() + Math.floor(Math.random() * 1000));
  }

  return id;
}
