const STORAGE_KEY = "quickPhrases";
const RECENT_CATEGORY_NAME = "上次使用";
const RECENT_LIMIT = 5;

const summaryText = document.getElementById("summaryText");
const newBtn = document.getElementById("newBtn");
const exportBtn = document.getElementById("exportBtn");
const importBtn = document.getElementById("importBtn");
const importFileInput = document.getElementById("importFileInput");
const clearAllBtn = document.getElementById("clearAllBtn");
const categoryNav = document.getElementById("categoryNav");
const renameCategoryBtn = document.getElementById("renameCategoryBtn");
const searchInput = document.getElementById("searchInput");
const sortSelect = document.getElementById("sortSelect");
const filteredCount = document.getElementById("filteredCount");
const phraseList = document.getElementById("phraseList");
const phraseForm = document.getElementById("phraseForm");
const editorTitle = document.getElementById("editorTitle");
const editState = document.getElementById("editState");
const editingId = document.getElementById("editingId");
const categoryInput = document.getElementById("categoryInput");
const titleInput = document.getElementById("titleInput");
const contentInput = document.getElementById("contentInput");
const categoryOptions = document.getElementById("categoryOptions");
const cancelEditBtn = document.getElementById("cancelEditBtn");

let phrases = [];
let activeCategory = "全部";

document.addEventListener("DOMContentLoaded", async () => {
  phrases = await getPhrases();
  resetEditor();
  render();
});

newBtn.addEventListener("click", () => {
  resetEditor();
  categoryInput.focus();
});

clearAllBtn.addEventListener("click", async () => {
  if (!phrases.length) {
    return;
  }

  if (!confirm("确定要清空全部常用语吗？此操作不可撤销。")) {
    return;
  }

  phrases = [];
  await persistAndRefresh();
  resetEditor();
  render();
});

exportBtn.addEventListener("click", () => {
  exportPhrases();
});

importBtn.addEventListener("click", () => {
  importFileInput.click();
});

importFileInput.addEventListener("change", async () => {
  const file = importFileInput.files[0];

  if (!file) {
    return;
  }

  try {
    const text = await file.text();
    await importPhrases(text);
  } catch (error) {
    alert(`导入失败：${error.message}`);
  } finally {
    importFileInput.value = "";
  }
});

renameCategoryBtn.addEventListener("click", async () => {
  await renameCategory();
});

searchInput.addEventListener("input", render);
sortSelect.addEventListener("change", render);

categoryNav.addEventListener("click", (event) => {
  const button = event.target.closest(".category-btn");

  if (!button) {
    return;
  }

  activeCategory = button.dataset.category || "全部";
  render();
});

phraseList.addEventListener("click", async (event) => {
  const deleteButton = event.target.closest(".delete-action");
  const copyButton = event.target.closest(".copy-action");

  if (copyButton) {
    event.stopPropagation();
    await copyPhrase(copyButton.dataset.id);
    return;
  }

  if (deleteButton) {
    event.stopPropagation();
    await deletePhrase(deleteButton.dataset.id);
    return;
  }

  const item = event.target.closest(".phrase-item");

  if (!item) {
    return;
  }

  const phrase = phrases.find((current) => current.id === item.dataset.id);

  if (phrase) {
    loadEditor(phrase);
  }
});

phraseForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const category = categoryInput.value.trim();
  const title = titleInput.value.trim();
  const content = contentInput.value;

  if (!category || !title || !content.trim()) {
    alert("分类、标题和内容不能为空。");
    return;
  }

  const id = editingId.value;

  if (id) {
    phrases = phrases.map((phrase) => {
      if (phrase.id !== id) {
        return phrase;
      }

      return {
        ...phrase,
        category,
        title,
        content,
        updatedAt: Date.now()
      };
    });
  } else {
    const now = Date.now();
    phrases = [
      ...phrases,
      {
        id: createPhraseId(phrases),
        category,
        title,
        content,
        createdAt: now
      }
    ];
  }

  await persistAndRefresh();
  resetEditor();
  render();
});

cancelEditBtn.addEventListener("click", () => {
  resetEditor();
});

async function deletePhrase(id) {
  const phrase = phrases.find((item) => item.id === id);

  if (!phrase) {
    return;
  }

  if (!confirm(`确定要删除「${phrase.title}」吗？`)) {
    return;
  }

  phrases = phrases.filter((item) => item.id !== id);

  if (editingId.value === id) {
    resetEditor();
  }

  await persistAndRefresh();
  render();
}

function render() {
  renderSummary();
  renderCategoryNav();
  renderCategoryOptions();
  renderPhraseList();
}

function renderSummary() {
  summaryText.textContent = `共 ${phrases.length} 条常用语`;
  clearAllBtn.disabled = phrases.length === 0;
  exportBtn.disabled = phrases.length === 0;
  renameCategoryBtn.disabled = activeCategory === "全部" ||
    activeCategory === RECENT_CATEGORY_NAME ||
    !phrases.some((phrase) => phrase.category === activeCategory);
}

function renderCategoryNav() {
  categoryNav.innerHTML = "";

  const counts = getCategoryCounts();
  const recentCount = getRecentPhrases(phrases).length;
  const entries = [["全部", phrases.length]];

  if (recentCount) {
    entries.push([RECENT_CATEGORY_NAME, recentCount]);
  }

  entries.push(...Object.entries(counts));

  entries.forEach(([category, count]) => {
    const button = document.createElement("button");
    button.className = category === activeCategory ? "category-btn active" : "category-btn";
    button.type = "button";
    button.dataset.category = category;

    const name = document.createElement("span");
    name.className = "category-name";
    name.textContent = category;

    const total = document.createElement("span");
    total.className = "category-count";
    total.textContent = count;

    button.appendChild(name);
    button.appendChild(total);
    categoryNav.appendChild(button);
  });
}

function renderCategoryOptions() {
  categoryOptions.innerHTML = "";

  Object.keys(getCategoryCounts()).forEach((category) => {
    const option = document.createElement("option");
    option.value = category;
    categoryOptions.appendChild(option);
  });
}

function renderPhraseList() {
  const visiblePhrases = getVisiblePhrases();
  phraseList.innerHTML = "";
  filteredCount.textContent = `${visiblePhrases.length} 条`;

  if (!visiblePhrases.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = phrases.length ? "没有符合条件的常用语" : "暂无常用语，请先新建一条";
    phraseList.appendChild(empty);
    return;
  }

  visiblePhrases.forEach((phrase) => {
    phraseList.appendChild(createPhraseItem(phrase));
  });
}

function createPhraseItem(phrase) {
  const item = document.createElement("button");
  item.className = phrase.id === editingId.value ? "phrase-item active" : "phrase-item";
  item.type = "button";
  item.dataset.id = phrase.id;

  const row = document.createElement("div");
  row.className = "phrase-row";

  const title = document.createElement("div");
  title.className = "phrase-title";
  title.textContent = phrase.title;

  const category = document.createElement("div");
  category.className = "phrase-category";
  category.textContent = phrase.category || "未分类";

  const content = document.createElement("div");
  content.className = "phrase-content";
  content.textContent = phrase.content;

  const meta = document.createElement("div");
  meta.className = "phrase-meta";
  meta.textContent = getMetaText(phrase);

  const deleteButton = document.createElement("span");
  deleteButton.className = "delete-action";
  deleteButton.dataset.id = phrase.id;
  deleteButton.textContent = "删除";

  const copyButton = document.createElement("span");
  copyButton.className = "copy-action";
  copyButton.dataset.id = phrase.id;
  copyButton.textContent = "复制";

  const actions = document.createElement("div");
  actions.className = "item-actions";
  actions.appendChild(copyButton);
  actions.appendChild(deleteButton);

  row.appendChild(title);
  row.appendChild(category);
  item.appendChild(row);
  item.appendChild(content);
  item.appendChild(meta);
  item.appendChild(actions);

  return item;
}

async function copyPhrase(id) {
  const phrase = phrases.find((item) => item.id === id);

  if (!phrase) {
    return;
  }

  await navigator.clipboard.writeText(phrase.content);
  phrases = markPhraseUsed(phrases, id);
  await persistAndRefresh();
  render();
}

function resetEditor() {
  editingId.value = "";
  categoryInput.value = activeCategory === "全部" || activeCategory === RECENT_CATEGORY_NAME ? "" : activeCategory;
  titleInput.value = "";
  contentInput.value = "";
  editorTitle.textContent = "新建常用语";
  editState.textContent = "未保存";
  renderPhraseList();
}

function loadEditor(phrase) {
  editingId.value = phrase.id;
  categoryInput.value = phrase.category || "";
  titleInput.value = phrase.title || "";
  contentInput.value = phrase.content || "";
  editorTitle.textContent = "编辑常用语";
  editState.textContent = "正在编辑";
  renderPhraseList();
}

function getVisiblePhrases() {
  const keyword = searchInput.value.trim().toLowerCase();
  const sourcePhrases = activeCategory === RECENT_CATEGORY_NAME ? getRecentPhrases(phrases) : phrases;

  return sourcePhrases
    .filter((phrase) => activeCategory === "全部" ||
      activeCategory === RECENT_CATEGORY_NAME ||
      phrase.category === activeCategory)
    .filter((phrase) => {
      if (!keyword) {
        return true;
      }

      return [phrase.category, phrase.title, phrase.content]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(keyword));
    })
    .sort((a, b) => comparePhrases(a, b, sortSelect.value));
}

function comparePhrases(a, b, sortType) {
  if (sortType === "oldest") {
    return (a.createdAt || 0) - (b.createdAt || 0);
  }

  if (sortType === "recentUsed") {
    return Number(b.lastUsedAt || 0) - Number(a.lastUsedAt || 0) ||
      Number(b.usedCount || 0) - Number(a.usedCount || 0) ||
      Number(b.createdAt || 0) - Number(a.createdAt || 0);
  }

  if (sortType === "mostUsed") {
    return Number(b.usedCount || 0) - Number(a.usedCount || 0) ||
      Number(b.lastUsedAt || 0) - Number(a.lastUsedAt || 0) ||
      Number(b.createdAt || 0) - Number(a.createdAt || 0);
  }

  if (sortType === "category") {
    return String(a.category || "").localeCompare(String(b.category || ""), "zh-CN") ||
      String(a.title || "").localeCompare(String(b.title || ""), "zh-CN");
  }

  if (sortType === "title") {
    return String(a.title || "").localeCompare(String(b.title || ""), "zh-CN");
  }

  return (b.createdAt || 0) - (a.createdAt || 0);
}

function getCategoryCounts() {
  return phrases.reduce((counts, phrase) => {
    const category = phrase.category || "未分类";
    counts[category] = (counts[category] || 0) + 1;
    return counts;
  }, {});
}

function getRecentPhrases(sourcePhrases) {
  return sourcePhrases
    .filter((phrase) => phrase.lastUsedAt)
    .sort((a, b) => Number(b.lastUsedAt || 0) - Number(a.lastUsedAt || 0))
    .slice(0, RECENT_LIMIT);
}

function getMetaText(phrase) {
  const createdAt = phrase.createdAt ? formatTime(phrase.createdAt) : "未知时间";
  const updatedText = phrase.updatedAt ? `，更新于 ${formatTime(phrase.updatedAt)}` : "";
  const usedCount = Number(phrase.usedCount || 0);
  const usedText = phrase.lastUsedAt ? `，使用 ${usedCount} 次，最近使用 ${formatTime(phrase.lastUsedAt)}` : `，使用 ${usedCount} 次`;
  return `创建于 ${createdAt}${updatedText}${usedText}`;
}

function formatTime(timestamp) {
  return new Date(timestamp).toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function exportPhrases() {
  const payload = {
    app: "常用语助手",
    version: 1,
    exportedAt: Date.now(),
    quickPhrases: phrases
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const date = new Date().toISOString().slice(0, 10);

  link.href = url;
  link.download = `quick-phrases-${date}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

async function importPhrases(text) {
  const parsed = JSON.parse(text);
  const imported = Array.isArray(parsed) ? parsed : parsed.quickPhrases;

  if (!Array.isArray(imported)) {
    throw new Error("JSON 中没有可导入的常用语数组。");
  }

  const normalized = normalizeImportedPhrases(imported);

  if (!normalized.length) {
    throw new Error("没有有效的常用语可导入。");
  }

  const importMode = prompt("请输入导入方式：merge 表示合并，replace 表示覆盖。取消则不导入。", "merge");

  if (importMode === null) {
    return;
  }

  const normalizedMode = importMode.trim().toLowerCase();

  if (normalizedMode !== "merge" && normalizedMode !== "replace") {
    alert("导入方式只能填写 merge 或 replace。");
    return;
  }

  if (normalizedMode === "replace" && !confirm("确定要用导入数据覆盖当前全部常用语吗？此操作不可撤销。")) {
    return;
  }

  phrases = normalizedMode === "merge" ? mergePhrases(phrases, normalized) : normalized;
  activeCategory = "全部";
  await persistAndRefresh();
  resetEditor();
  render();
}

async function renameCategory() {
  if (activeCategory === "全部" || activeCategory === RECENT_CATEGORY_NAME) {
    alert("请先在左侧选择要重命名的分类。");
    return;
  }

  const nextCategory = prompt("请输入新的分类名称：", activeCategory);

  if (nextCategory === null) {
    return;
  }

  const trimmedCategory = nextCategory.trim();

  if (!trimmedCategory) {
    alert("分类名称不能为空。");
    return;
  }

  if (trimmedCategory === activeCategory) {
    return;
  }

  const now = Date.now();
  phrases = phrases.map((phrase) => {
    if (phrase.category !== activeCategory) {
      return phrase;
    }

    return {
      ...phrase,
      category: trimmedCategory,
      updatedAt: now
    };
  });

  activeCategory = trimmedCategory;
  await persistAndRefresh();
  render();
}

function getPhrases() {
  return new Promise((resolve) => {
    chrome.storage.local.get({ [STORAGE_KEY]: [] }, (result) => {
      resolve(Array.isArray(result[STORAGE_KEY]) ? result[STORAGE_KEY] : []);
    });
  });
}

function setPhrases(nextPhrases) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [STORAGE_KEY]: nextPhrases }, resolve);
  });
}

async function persistAndRefresh() {
  await setPhrases(phrases);
  await refreshContextMenus();
}

function refreshContextMenus() {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: "REFRESH_CONTEXT_MENUS" }, () => {
      if (chrome.runtime.lastError) {
        console.warn("通知右键菜单刷新失败：", chrome.runtime.lastError.message);
      }

      resolve();
    });
  });
}

function createPhraseId(currentPhrases) {
  let id = String(Date.now());
  const existingIds = new Set(currentPhrases.map((phrase) => phrase.id));

  while (existingIds.has(id)) {
    id = String(Date.now() + Math.floor(Math.random() * 1000));
  }

  return id;
}

function normalizeImportedPhrases(imported) {
  const now = Date.now();
  const ids = new Set();

  return imported
    .filter((item) => item && typeof item === "object")
    .map((item, index) => {
      const category = String(item.category || "").trim();
      const title = String(item.title || "").trim();
      const content = typeof item.content === "string" ? item.content : String(item.content || "");

      if (!category || !title || !content.trim()) {
        return null;
      }

      let id = String(item.id || now + index);

      while (ids.has(id)) {
        id = String(now + index + Math.floor(Math.random() * 100000));
      }

      ids.add(id);

      const phrase = {
        id,
        category,
        title,
        content,
        createdAt: Number(item.createdAt || now),
        usedCount: Number(item.usedCount || 0)
      };

      if (item.updatedAt) {
        phrase.updatedAt = Number(item.updatedAt);
      }

      if (item.lastUsedAt) {
        phrase.lastUsedAt = Number(item.lastUsedAt);
      }

      return phrase;
    })
    .filter(Boolean);
}

function mergePhrases(currentPhrases, importedPhrases) {
  const result = [...currentPhrases];
  const existingIds = new Set(result.map((phrase) => phrase.id));

  importedPhrases.forEach((phrase) => {
    if (existingIds.has(phrase.id)) {
      phrase = {
        ...phrase,
        id: createPhraseId(result)
      };
    }

    existingIds.add(phrase.id);
    result.push(phrase);
  });

  return result;
}

function markPhraseUsed(currentPhrases, id) {
  const now = Date.now();

  return currentPhrases.map((phrase) => {
    if (phrase.id !== id) {
      return phrase;
    }

    return {
      ...phrase,
      usedCount: Number(phrase.usedCount || 0) + 1,
      lastUsedAt: now
    };
  });
}
