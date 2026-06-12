const DEFAULT_CONFIG_URL = 'https://smarttools-4xj.pages.dev/config.html';

const els = {
  configUrl: document.getElementById('configUrl'),
  saveUrl: document.getElementById('saveUrl'),
  importCurrent: document.getElementById('importCurrent'),
  importAll: document.getElementById('importAll'),
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

function toPayloadTab(tab) {
  return {
    title: tab.title || tab.url || '',
    url: tab.url || '',
    favIconUrl: tab.favIconUrl || '',
    windowId: tab.windowId,
    index: tab.index,
    active: tab.active,
    pinned: tab.pinned,
    groupId: tab.groupId,
    audible: tab.audible,
    muted: tab.mutedInfo ? tab.mutedInfo.muted : undefined
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
    await chrome.tabs.create({ url: configUrl, active: true });
    setStatus('已打开 SmartTools 后台。请登录并加载数据后，再点一次导入。', 'err');
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

document.addEventListener('DOMContentLoaded', async () => {
  els.configUrl.value = await getConfigUrl();
  els.saveUrl.addEventListener('click', saveConfigUrl);
  els.importCurrent.addEventListener('click', () => importTabs('current'));
  els.importAll.addEventListener('click', () => importTabs('all'));
});
