function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

(async () => {
  try {
    const data = await chrome.storage.local.get('pendingOpenTabsImport');
    const payload = data.pendingOpenTabsImport;
    if (!payload || !payload.configUrl) return;

    const current = new URL(window.location.href);
    const target = new URL(payload.configUrl);
    if (current.origin !== target.origin || current.pathname.replace(/\/$/, '') !== target.pathname.replace(/\/$/, '')) return;

    await chrome.storage.local.remove('pendingOpenTabsImport');
    const message = {
      source: 'smarttools-open-tabs-extension',
      scope: payload.scope,
      sentAt: payload.sentAt,
      tabs: payload.tabs || []
    };
    for (let i = 0; i < 6; i++) {
      window.postMessage(message, window.location.origin);
      await sleep(500);
    }
  } catch (e) {
    // Ignore: normal pages may be inaccessible or not SmartTools.
  }
})();
