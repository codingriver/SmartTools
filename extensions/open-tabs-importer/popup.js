const DEFAULT_CONFIG_URL = 'https://smarttools-4xj.pages.dev/config.html';

const els = {
  configUrl: document.getElementById('configUrl'),
  saveUrl: document.getElementById('saveUrl'),
  loadCurrent: document.getElementById('loadCurrent'),
  loadAll: document.getElementById('loadAll'),
  parentTitle: document.getElementById('parentTitle'),
  selectAll: document.getElementById('selectAll'),
  selectNone: document.getElementById('selectNone'),
  importSelected: document.getElementById('importSelected'),
  tabsList: document.getElementById('tabsList'),
  status: document.getElementById('status')
};

let loadedScope = 'current';
let loadedTabs = [];

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

function escapeHtml(text) {
  return String(text || '').replace(/[&<>"']/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[c]));
}

function renderTabsList() {
  if (!loadedTabs.length) {
    els.tabsList.innerHTML = '<p class="empty">没有可导入的普通网页标签</p>';
    return;
  }
  els.tabsList.innerHTML = loadedTabs.map((tab, index) => {
    const icon = tab.favIconUrl
      ? `<img class="tab-icon" src="${escapeHtml(tab.favIconUrl)}" alt="">`
      : '<span class="tab-icon">🌐</span>';
    return `
      <label class="tab-row">
        <input type="checkbox" class="tab-check" data-index="${index}" checked>
        ${icon}
        <span>
          <span class="tab-title" title="${escapeHtml(tab.title)}">${escapeHtml(tab.title)}</span>
          <span class="tab-url" title="${escapeHtml(tab.url)}">${escapeHtml(tab.url)}</span>
        </span>
      </label>
    `;
  }).join('');
}

async function loadTabs(scope) {
  let configUrl;
  try {
    configUrl = normalizeConfigUrl(els.configUrl.value || await getConfigUrl());
  } catch (e) {
    setStatus('请先填写正确的后台地址', 'err');
    return;
  }
  await chrome.storage.sync.set({ configUrl });
  els.configUrl.value = configUrl;
  loadedScope = scope;
  loadedTabs = await collectTabs(scope, configUrl);
  renderTabsList();
  setStatus(`已读取 ${loadedTabs.length} 个可导入标签`, loadedTabs.length ? 'ok' : 'err');
}

function setAllChecked(checked) {
  els.tabsList.querySelectorAll('.tab-check').forEach(input => {
    input.checked = checked;
  });
}

function getSelectedTabs() {
  return [...els.tabsList.querySelectorAll('.tab-check:checked')]
    .map(input => loadedTabs[Number(input.dataset.index)])
    .filter(Boolean);
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

async function importSelectedTabs() {
  let configUrl;
  try {
    configUrl = normalizeConfigUrl(els.configUrl.value || await getConfigUrl());
  } catch (e) {
    setStatus('请先填写正确的后台地址', 'err');
    return;
  }
  await chrome.storage.sync.set({ configUrl });

  const tabs = getSelectedTabs();
  if (!tabs.length) {
    setStatus('请至少勾选一个标签', 'err');
    return;
  }

  const configTab = await findConfigTab(configUrl);
  if (!configTab) {
    await chrome.tabs.create({ url: configUrl, active: true });
    setStatus('已打开 SmartTools 后台。请登录并加载数据后，再点一次导入。', 'err');
    return;
  }

  const parentTitle = els.parentTitle.value.trim() || `打开的标签页 ${new Date().toLocaleString()}`;
  await chrome.tabs.update(configTab.id, { active: true });
  await chrome.windows.update(configTab.windowId, { focused: true });
  await injectTabs(configTab.id, {
    source: 'smarttools-open-tabs-extension',
    scope: loadedScope,
    parentTitle,
    sentAt: new Date().toISOString(),
    tabs
  });
  setStatus(`已发送父卡片「${parentTitle}」和 ${tabs.length} 个子标签`, 'ok');
}

document.addEventListener('DOMContentLoaded', async () => {
  els.configUrl.value = await getConfigUrl();
  els.parentTitle.value = `打开的标签页 ${new Date().toLocaleString()}`;
  els.saveUrl.addEventListener('click', saveConfigUrl);
  els.loadCurrent.addEventListener('click', () => loadTabs('current'));
  els.loadAll.addEventListener('click', () => loadTabs('all'));
  els.selectAll.addEventListener('click', () => setAllChecked(true));
  els.selectNone.addEventListener('click', () => setAllChecked(false));
  els.importSelected.addEventListener('click', importSelectedTabs);
});
