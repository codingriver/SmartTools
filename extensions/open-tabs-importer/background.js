function sameConfigPage(tabUrl, configUrl) {
  try {
    const a = new URL(tabUrl || '');
    const b = new URL(configUrl || '');
    return a.origin === b.origin && sameConfigPath(a.pathname, b.pathname);
  } catch (e) {
    return false;
  }
}

function normalizePagePath(pathname) {
  const path = String(pathname || '/').replace(/\/+$/, '') || '/';
  return path.toLowerCase();
}

function sameConfigPath(tabPathname, configPathname) {
  const tabPath = normalizePagePath(tabPathname);
  const configPath = normalizePagePath(configPathname);
  if (tabPath === configPath) return true;
  const configAliases = new Set(['/config', '/config.html']);
  return configAliases.has(tabPath) && configAliases.has(configPath);
}

async function postPayloadToTab(tabId, payload) {
  await chrome.scripting.executeScript({
    target: { tabId },
    func: data => {
      window.postMessage(data, window.location.origin);
    },
    args: [{
      source: 'smarttools-open-tabs-extension',
      scope: payload.scope,
      sentAt: payload.sentAt,
      tabs: payload.tabs || []
    }]
  });
}

async function tryDeliverPending(tabId, tabUrl) {
  const storageData = chrome.storage && chrome.storage.local
    ? await chrome.storage.local.get('pendingOpenTabsImport')
    : {};
  const payload = storageData.pendingOpenTabsImport;
  if (!payload || !payload.configUrl || !sameConfigPage(tabUrl, payload.configUrl)) return;

  for (let i = 0; i < 8; i++) {
    try {
      await postPayloadToTab(tabId, payload);
    } catch (e) {
      // Page may still be initializing; retry below.
    }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status !== 'complete') return;
  tryDeliverPending(tabId, tab.url);
});
