const STORAGE_KEY = "quickPhrases";
const ROOT_MENU_ID = "quick-phrases-root";
const PHRASE_MENU_PREFIX = "phrase:";
const RECENT_CATEGORY_NAME = "上次使用";
const RECENT_LIMIT = 5;

chrome.runtime.onInstalled.addListener(() => {
  refreshContextMenus();
});

chrome.runtime.onStartup.addListener(() => {
  refreshContextMenus();
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message && message.type === "REFRESH_CONTEXT_MENUS") {
    refreshContextMenus()
      .then(() => sendResponse({ ok: true }))
      .catch((error) => {
        console.error("刷新右键菜单失败：", error);
        sendResponse({ ok: false, error: error.message });
      });
    return true;
  }

  if (message && message.type === "RECORD_PHRASE_USAGE" && message.id) {
    recordPhraseUsage(message.id)
      .then(() => sendResponse({ ok: true }))
      .catch((error) => {
        console.error("记录使用次数失败：", error);
        sendResponse({ ok: false, error: error.message });
      });
    return true;
  }

  return false;
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (!info.menuItemId || typeof info.menuItemId !== "string") {
    return;
  }

  if (!info.menuItemId.startsWith(PHRASE_MENU_PREFIX)) {
    return;
  }

  const phraseId = parsePhraseIdFromMenuItemId(info.menuItemId);

  if (!phraseId) {
    return;
  }

  getPhrasesWithCallback((phrases) => {
    const phrase = phrases.find((item) => item.id === phraseId);

    if (!phrase || !tab || !tab.id) {
      return;
    }

    chrome.tabs.sendMessage(
      tab.id,
      {
        type: "INSERT_PHRASE",
        content: phrase.content
      },
      (response) => {
        if (chrome.runtime.lastError) {
          console.warn("发送插入消息失败：", chrome.runtime.lastError.message);
          return;
        }

        if (!response || !response.ok) {
          return;
        }

        recordPhraseUsageWithCallback(phrase.id);
      }
    );
  });
});

async function refreshContextMenus() {
  await removeAllContextMenus();

  const phrases = await getPhrases();

  chrome.contextMenus.create({
    id: ROOT_MENU_ID,
    title: "插入常用语",
    contexts: ["editable"]
  });

  if (!phrases.length) {
    return;
  }

  const grouped = groupByCategory(phrases);
  const recentPhrases = getRecentPhrases(phrases);

  if (recentPhrases.length) {
    createCategoryMenu(RECENT_CATEGORY_NAME, recentPhrases, "recent");
  }

  Object.entries(grouped).forEach(([category, items], index) => {
    createCategoryMenu(category, items, `category:${index}`);
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

function getPhrasesWithCallback(callback) {
  chrome.storage.local.get({ [STORAGE_KEY]: [] }, (result) => {
    const phrases = Array.isArray(result[STORAGE_KEY]) ? result[STORAGE_KEY] : [];
    callback(phrases);
  });
}

function setPhrases(phrases) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [STORAGE_KEY]: phrases }, () => {
      resolve();
    });
  });
}

function removeAllContextMenus() {
  return new Promise((resolve) => {
    chrome.contextMenus.removeAll(() => {
      resolve();
    });
  });
}

function createCategoryMenu(category, phrases, categoryMenuId) {
  chrome.contextMenus.create({
    id: categoryMenuId,
    parentId: ROOT_MENU_ID,
    title: category,
    contexts: ["editable"]
  });

  sortPhrasesForMenu(phrases).forEach((phrase) => {
    chrome.contextMenus.create({
      id: createPhraseMenuItemId(categoryMenuId, phrase.id),
      parentId: categoryMenuId,
      title: phrase.title,
      contexts: ["editable"]
    });
  });
}

function createPhraseMenuItemId(categoryMenuId, phraseId) {
  return `${PHRASE_MENU_PREFIX}${categoryMenuId}:${phraseId}`;
}

function parsePhraseIdFromMenuItemId(menuItemId) {
  const rawId = menuItemId.slice(PHRASE_MENU_PREFIX.length);
  const separatorIndex = rawId.lastIndexOf(":");

  if (separatorIndex === -1) {
    return rawId;
  }

  return rawId.slice(separatorIndex + 1);
}

async function recordPhraseUsage(id) {
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
  await refreshContextMenus();
}

function recordPhraseUsageWithCallback(id) {
  getPhrasesWithCallback((phrases) => {
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

    chrome.storage.local.set({ [STORAGE_KEY]: nextPhrases }, () => {
      if (chrome.runtime.lastError) {
        console.error("记录使用次数失败：", chrome.runtime.lastError.message);
        return;
      }

      refreshContextMenus().catch((error) => {
        console.error("刷新右键菜单失败：", error);
      });
    });
  });
}

function sortPhrasesForMenu(phrases) {
  return [...phrases].sort((a, b) => {
    const lastUsedDiff = Number(b.lastUsedAt || 0) - Number(a.lastUsedAt || 0);

    if (lastUsedDiff !== 0) {
      return lastUsedDiff;
    }

    const usedCountDiff = Number(b.usedCount || 0) - Number(a.usedCount || 0);

    if (usedCountDiff !== 0) {
      return usedCountDiff;
    }

    return Number(b.createdAt || 0) - Number(a.createdAt || 0);
  });
}

function getRecentPhrases(phrases) {
  return phrases
    .filter((phrase) => phrase.lastUsedAt)
    .sort((a, b) => Number(b.lastUsedAt || 0) - Number(a.lastUsedAt || 0))
    .slice(0, RECENT_LIMIT);
}

function groupByCategory(phrases) {
  return phrases.reduce((groups, phrase) => {
    const category = phrase.category || "未分类";

    if (!groups[category]) {
      groups[category] = [];
    }

    groups[category].push(phrase);
    return groups;
  }, {});
}
