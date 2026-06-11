# SmartTools Open Tabs Importer

用于 Chrome / Edge 一键把当前打开的标签页导入 SmartTools 后台。

## 安装

1. 打开 Chrome / Edge 的扩展管理页。
2. 开启「开发者模式」。
3. 点击「加载已解压的扩展」。
4. 选择本目录：`extensions/open-tabs-importer`。

## 使用

1. 先打开并登录 SmartTools 后台：`/config.html`。
2. 点击浏览器工具栏里的扩展图标。
3. 确认「后台地址」是当前 SmartTools 后台地址。
4. 点击「导入当前窗口标签」或「导入所有窗口标签」。
5. 回到 SmartTools 后台确认导入结果，然后点击「💾 保存」。

## 行为说明

- 只导入普通网页标签：`http://` 和 `https://`。
- 不导入 SmartTools 后台页本身。
- 导入目标默认是后台当前选中的可写大类；如果当前不可写，会导入到第一个可写大类或未分类。
- 每个标签会保存标题、URL、favicon，以及窗口/标签位置等 `openTabMeta` 原始信息。
