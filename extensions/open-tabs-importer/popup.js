const DEFAULT_CONFIG_URL = 'https://smarttools-4xj.pages.dev/config.html';

const els = {
  configUrl: document.getElementById('configUrl'),
  saveUrl: document.getElementById('saveUrl'),
  openBackend: document.getElementById('openBackend'),
  importCurrent: document.getElementById('importCurrent'),
  importAll: document.getElementById('importAll'),
  copyCurrent: document.getElementById('copyCurrent'),
  copyAll: document.getElementById('copyAll'),
  exportCurrentFile: document.getElementById('exportCurrentFile'),
  exportAllFile: document.getElementById('exportAllFile'),
  status: document.getElementById('status')
};

function setStatus(message, kind = '') {
  els.status.textContent = message;
  els.status.className = 'status ' + kind;
}

function normalizeConfigUrl(raw) {
  const url = new URL(raw || DEFAULT_CONFIG_URL);
  if (!url.pathname || url.pathname === '/') url.pathname = '/config.html';
  return url.toString();
}

async function getConfigUrl() {
  const data = await chrome.storage.sync.get({ configUrl: DEFAULT_CONFIG_URL });
  return normalizeConfigUrl(data.configUrl);
}

async function saveConfigUrl() {
  try {
    const configUrl = normalizeConfigUrl(els.configUrl.value);
    await chrome.storage.sync.set({ configUrl });
    els.configUrl.value = configUrl;
    setStatus('后台地址已保存', 'ok');
  } catch (e) {
    setStatus('地址格式不正确', 'err');
  }
}

async function openBackend() {
  let configUrl;
  try {
    configUrl = normalizeConfigUrl(els.configUrl.value || await getConfigUrl());
  } catch (e) {
    setStatus('请先填写正确的后台地址', 'err');
    return;
  }
  await chrome.storage.sync.set({ configUrl });
  els.configUrl.value = configUrl;
  await chrome.tabs.create({ url: configUrl, active: true });
  setStatus('已打开 SmartTools 后台', 'ok');
}

function sameConfigPage(tabUrl, configUrl) {
  try {
    const a = new URL(tabUrl);
    const b = new URL(configUrl);
    return a.origin === b.origin && a.pathname.replace(/\/$/, '') === b.pathname.replace(/\/$/, '');
  } catch (e) {
    return false;
  }
}

function isImportableUrl(url) {
  return /^https?:\/\//i.test(url || '');
}

function sanitizeFaviconUrl(url) {
  const raw = String(url || '').trim();
  if (!raw || /^data:image\//i.test(raw)) return '';
  return raw;
}

function toPayloadTab(tab) {
  return {
    title: tab.title || tab.url || '',
    url: tab.url || '',
    favIconUrl: sanitizeFaviconUrl(tab.favIconUrl)
  };
}

async function collectTabs(scope, configUrl) {
  const query = scope === 'all' ? {} : { currentWindow: true };
  const tabs = await chrome.tabs.query(query);
  return tabs
    .filter(tab => isImportableUrl(tab.url) && !sameConfigPage(tab.url, configUrl))
    .map(toPayloadTab);
}

async function findConfigTab(configUrl) {
  const tabs = await chrome.tabs.query({});
  return tabs.find(tab => sameConfigPage(tab.url, configUrl)) || null;
}

async function injectTabs(tabId, payload) {
  await chrome.scripting.executeScript({
    target: { tabId },
    func: data => {
      window.postMessage(data, window.location.origin);
    },
    args: [payload]
  });
}

async function importTabs(scope) {
  let configUrl;
  try {
    configUrl = normalizeConfigUrl(els.configUrl.value || await getConfigUrl());
  } catch (e) {
    setStatus('请先填写正确的后台地址', 'err');
    return;
  }
  await chrome.storage.sync.set({ configUrl });
  els.configUrl.value = configUrl;

  const tabs = await collectTabs(scope, configUrl);
  if (!tabs.length) {
    setStatus('没有可导入的普通网页标签', 'err');
    return;
  }

  const configTab = await findConfigTab(configUrl);
  if (!configTab) {
    await chrome.storage.local.set({
      pendingOpenTabsImport: {
        configUrl,
        scope,
        sentAt: new Date().toISOString(),
        tabs
      }
    });
    await chrome.tabs.create({ url: configUrl, active: true });
    setStatus(`已打开 SmartTools 后台，并准备导入 ${tabs.length} 个标签`, 'ok');
    return;
  }

  await chrome.tabs.update(configTab.id, { active: true });
  await chrome.windows.update(configTab.windowId, { focused: true });
  await injectTabs(configTab.id, {
    source: 'smarttools-open-tabs-extension',
    scope,
    sentAt: new Date().toISOString(),
    tabs
  });
  setStatus(`已发送 ${tabs.length} 个标签到 SmartTools 后台`, 'ok');
}

// Copy to clipboard as JSON
async function copyTabsToClipboard(scope) {
  let configUrl;
  try {
    configUrl = normalizeConfigUrl(els.configUrl.value || await getConfigUrl());
  } catch (e) {
    setStatus('请先填写正确的后台地址', 'err');
    return;
  }
  await chrome.storage.sync.set({ configUrl });
  els.configUrl.value = configUrl;

  const tabs = await collectTabs(scope, configUrl);
  if (!tabs.length) {
    setStatus('没有可复制的普通网页标签', 'err');
    return;
  }

  const json = JSON.stringify(tabs, null, 2);
  try {
    await navigator.clipboard.writeText(json);
    setStatus(`已复制 ${tabs.length} 个标签到粘贴板 (JSON)`, 'ok');
  } catch (e) {
    setStatus('复制失败，请检查浏览器权限', 'err');
  }
}

// Export to HTML file (Chrome-compatible bookmark format)
async function exportTabsToFile(scope) {
  let configUrl;
  try {
    configUrl = normalizeConfigUrl(els.configUrl.value || await getConfigUrl());
  } catch (e) {
    setStatus('请先填写正确的后台地址', 'err');
    return;
  }
  await chrome.storage.sync.set({ configUrl });
  els.configUrl.value = configUrl;

  const tabs = await collectTabs(scope, configUrl);
  if (!tabs.length) {
    setStatus('没有可导出的普通网页标签', 'err');
    return;
  }

  const timestamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-');
  const filename = `smarttools-tabs-${scope === 'current' ? 'current' : 'all'}-${timestamp}.html`;

  const html = [
    '<!DOCTYPE NETSCAPE-Bookmark-file-1>',
    '<!-- SmartTools Tabs Export -->',
    '<TITLE>SmartTools Tabs</TITLE>',
    '<H1>SmartTools Tabs</H1>',
    '<DL><p>',
    ...tabs.map(tab => {
      const escapedTitle = (tab.title || tab.url || '').replace(/&/g, '&').replace(/</g, '<').replace(/>/g, '>').replace(/"/g, '"');
      const escapedUrl = (tab.url || '').replace(/&/g, '&').replace(/</g, '<').replace(/>/g, '>');
      return `    <DT><A HREF="${escapedUrl}">${escapedTitle}</A>`;
    }),
    '</p></DL>'
  ].join('\n');

  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  try {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setStatus(`已导出 ${tabs.length} 个标签到文件 (HTML)`, 'ok');
  } catch (e) {
    setStatus('导出失败，请检查浏览器权限', 'err');
  } finally {
    URL.revokeObjectURL(url);
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  els.configUrl.value = await getConfigUrl();
  els.saveUrl.addEventListener('click', saveConfigUrl);
  els.openBackend.addEventListener('click', openBackend);
  els.importCurrent.addEventListener('click', () => importTabs('current'));
  els.importAll.addEventListener('click', () => importTabs('all'));
  els.copyCurrent.addEventListener('click', () => copyTabsToClipboard('current'));
  els.copyAll.addEventListener('click', () => copyTabsToClipboard('all'));
  els.exportCurrentFile.addEventListener('click', () => exportTabsToFile('current'));
  els.exportAllFile.addEventListener('click', () => exportTabsToFile('all'));
});