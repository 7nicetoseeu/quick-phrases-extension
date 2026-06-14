let lastEditableElement = null;
let lastEditableRange = null;

document.addEventListener(
  "contextmenu",
  (event) => {
    const editableElement = findEditableElement(event.target);

    if (!editableElement) {
      return;
    }

    lastEditableElement = editableElement;

    if (isContentEditableElement(editableElement)) {
      saveCurrentRange(editableElement);
    } else {
      lastEditableRange = null;
    }
  },
  true
);

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || message.type !== "INSERT_PHRASE") {
    return false;
  }

  const target = getInsertTarget();

  if (!target) {
    sendResponse({ ok: false });
    return false;
  }

  insertText(target, String(message.content || ""));
  sendResponse({ ok: true });
  return false;
});

function getInsertTarget() {
  if (isEditableElement(lastEditableElement)) {
    return lastEditableElement;
  }

  return findEditableElement(document.activeElement);
}

function insertText(target, text) {
  if (isTextInputOrTextarea(target)) {
    insertIntoInput(target, text);
    return;
  }

  if (isContentEditableElement(target)) {
    insertIntoContentEditable(target, text);
  }
}

function insertIntoInput(target, text) {
  target.focus();

  const value = target.value || "";
  const start = typeof target.selectionStart === "number" ? target.selectionStart : value.length;
  const end = typeof target.selectionEnd === "number" ? target.selectionEnd : start;
  const nextValue = value.slice(0, start) + text + value.slice(end);
  const nextCursorPosition = start + text.length;

  target.value = nextValue;
  target.setSelectionRange(nextCursorPosition, nextCursorPosition);
  dispatchFormEvents(target);
}

function insertIntoContentEditable(target, text) {
  target.focus();

  const selection = window.getSelection();
  let range = null;

  if (lastEditableRange && target.contains(lastEditableRange.commonAncestorContainer)) {
    range = lastEditableRange.cloneRange();
  } else if (selection && selection.rangeCount > 0) {
    const currentRange = selection.getRangeAt(0);

    if (target.contains(currentRange.commonAncestorContainer)) {
      range = currentRange;
    }
  }

  if (!range) {
    range = document.createRange();
    range.selectNodeContents(target);
    range.collapse(false);
  }

  range.deleteContents();

  const textNode = document.createTextNode(text);
  range.insertNode(textNode);

  range.setStartAfter(textNode);
  range.setEndAfter(textNode);

  if (selection) {
    selection.removeAllRanges();
    selection.addRange(range);
  }

  lastEditableRange = range.cloneRange();
  target.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: text }));
}

function findEditableElement(element) {
  if (!element || element.nodeType !== Node.ELEMENT_NODE) {
    return null;
  }

  if (isTextInputOrTextarea(element)) {
    return element;
  }

  if (isContentEditableElement(element)) {
    return element;
  }

  const contentEditableParent = element.closest('[contenteditable="true"], [contenteditable=""]');

  if (isContentEditableElement(contentEditableParent)) {
    return contentEditableParent;
  }

  return null;
}

function isEditableElement(element) {
  return isTextInputOrTextarea(element) || isContentEditableElement(element);
}

function isTextInputOrTextarea(element) {
  if (!element) {
    return false;
  }

  if (element instanceof HTMLTextAreaElement) {
    return !element.disabled && !element.readOnly;
  }

  if (!(element instanceof HTMLInputElement)) {
    return false;
  }

  const editableTypes = new Set([
    "",
    "email",
    "number",
    "password",
    "search",
    "tel",
    "text",
    "url"
  ]);

  return editableTypes.has(element.type) && !element.disabled && !element.readOnly;
}

function isContentEditableElement(element) {
  return Boolean(element && element.nodeType === Node.ELEMENT_NODE && element.isContentEditable);
}

function saveCurrentRange(target) {
  const selection = window.getSelection();

  if (!selection || selection.rangeCount === 0) {
    lastEditableRange = null;
    return;
  }

  const range = selection.getRangeAt(0);
  lastEditableRange = target.contains(range.commonAncestorContainer) ? range.cloneRange() : null;
}

function dispatchFormEvents(target) {
  target.dispatchEvent(new Event("input", { bubbles: true }));
  target.dispatchEvent(new Event("change", { bubbles: true }));
}
