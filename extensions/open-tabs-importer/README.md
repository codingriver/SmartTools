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
5. SmartTools 后台会弹出确认界面。
6. 在后台确认界面里勾选需要导入的标签。
7. 填写「父卡片名称」。
8. 选择「所属分类」；该选择会通过 cookie 记住，下次自动使用。
9. 点击「确认导入」。
10. 回到 SmartTools 后台确认导入结果，然后点击「💾 保存」。

## 行为说明

- 只导入普通网页标签：`http://` 和 `https://`。
- 不导入 SmartTools 后台页本身。
- 扩展只负责读取标签页并发送到 SmartTools 后台。
- 导入结果是一个可展开父卡片，后台确认界面中勾选的标签会作为子卡片。
- 父卡片名称和所属分类都在 SmartTools 后台确认界面设置。
- 所属分类会通过 cookie 持久化；如果未设置或分类不可用，自动导入未分类。
- 每个子卡片会保存标题、URL、favicon，以及窗口/标签位置等 `openTabMeta` 原始信息。
