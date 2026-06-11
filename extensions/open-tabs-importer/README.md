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
4. 点击「读取当前窗口」或「读取所有窗口」。
5. 勾选需要导入的标签。
6. 填写「父卡片名称」。
7. 点击「导入勾选标签为子卡片」。
8. 回到 SmartTools 后台确认导入结果，然后点击「💾 保存」。

## 行为说明

- 只导入普通网页标签：`http://` 和 `https://`。
- 不导入 SmartTools 后台页本身。
- 导入结果是一个可展开父卡片，所选标签会作为子卡片。
- 父卡片名称由扩展弹窗输入框指定。
- 导入目标默认是后台当前选中的可写大类；如果当前不可写，会导入到第一个可写大类或未分类。
- 每个子卡片会保存标题、URL、favicon，以及窗口/标签位置等 `openTabMeta` 原始信息。
