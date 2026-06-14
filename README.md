# 常用语助手

一个 Chrome / Edge Manifest V3 浏览器扩展，用于在本机保存常用语，并在网页输入框中通过右键菜单快速插入。

## 功能

- 在 popup 中快速新增常用语。
- 在管理页系统化维护常用语。
- 支持分类、标题、内容三类信息。
- 支持按分类展示、搜索、排序、编辑、删除、清空。
- 支持导入 / 导出 JSON。
- 支持复制常用语内容。
- 支持分类重命名。
- 支持统计使用次数和最近使用时间。
- 支持“上次使用”虚拟分类，自动显示最近使用的最多 5 条常用语。
- 支持在 `input`、`textarea`、`contenteditable` 区域右键插入。

## 页面预览

### Popup 快速操作

![Popup 快速操作](./po展示.png)

### 后台管理页面

![后台管理页面](./后台展示.png)

## 目录结构

```text
quick-phrases-extension/
├─ manifest.json
├─ background.js
├─ content.js
├─ popup.html
├─ popup.css
├─ popup.js
├─ manage.html
├─ manage.css
└─ manage.js
```

## 本地加载

### Chrome

1. 打开 `chrome://extensions/`。
2. 开启“开发者模式”。
3. 点击“加载已解压的扩展程序”。
4. 选择 `quick-phrases-extension` 目录。

### Edge

1. 打开 `edge://extensions/`。
2. 开启“开发人员模式”。
3. 点击“加载解压缩的扩展”。
4. 选择 `quick-phrases-extension` 目录。

修改代码后，需要在扩展管理页点击“重新加载”。如果改动了 `content.js`，还需要刷新正在测试的网页。

## 使用说明

- 点击浏览器工具栏中的扩展图标，可以打开 popup。
- popup 中可以快速新增、搜索、插入、复制、删除常用语。
- 点击 popup 顶部“管理全部”，可以打开完整管理页。
- 在网页输入框、文本域或可编辑区域中右键，可以通过“插入常用语”菜单插入内容。
- “上次使用”分类不是实际保存的分类，而是根据 `lastUsedAt` 自动生成。

## 数据存储

数据保存在浏览器本机的扩展存储中：

```js
chrome.storage.local
```

存储 key：

```js
quickPhrases
```

数据示例：

```json
[
  {
    "id": "1710000000000",
    "category": "联系方式",
    "title": "手机号",
    "content": "13800138000",
    "createdAt": 1710000000000,
    "usedCount": 3,
    "lastUsedAt": 1710000001000
  }
]
```

删除扩展通常会删除这份本地数据。重装浏览器或换设备前，建议先在管理页导出 JSON。

## 开发检查

可以用 Node 做基础语法检查：

```powershell
node --check quick-phrases-extension\background.js
node --check quick-phrases-extension\content.js
node --check quick-phrases-extension\popup.js
node --check quick-phrases-extension\manage.js
```

## 注意事项

- 扩展不能在 Chrome / Edge 内置页面上注入内容脚本，例如 `chrome://`、`edge://` 页面。
- 右键菜单只在可编辑区域显示。
- popup 中的“插入”需要当前网页已经注入 `content.js`，修改扩展后请刷新测试网页。
- 所有数据只保存在本机浏览器中，不会上传到服务器。
