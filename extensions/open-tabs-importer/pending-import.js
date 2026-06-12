// Guard: only run in extension context with chrome.storage available
if (!(chrome && chrome.storage && chrome.storage.local)) {
  window.addEventListener('message', function noop() {});
} else {
  function sleep(ms) {
    return new Promise(function(resolve) { setTimeout(resolve, ms); });
  }

  (async function() {
    try {
      var data = await chrome.storage.local.get('pendingOpenTabsImport');
      var payload = data.pendingOpenTabsImport;
      if (!payload || !payload.configUrl) return;

      var current = new URL(window.location.href);
      var target = new URL(payload.configUrl);
      if (current.origin !== target.origin || current.pathname.replace(/\/$/, '') !== target.pathname.replace(/\/$/, '')) return;

      var message = {
        source: 'smarttools-open-tabs-extension',
        scope: payload.scope,
        sentAt: payload.sentAt,
        tabs: payload.tabs || []
      };
      for (var i = 0; i < 6; i++) {
        window.postMessage(message, window.location.origin);
        await sleep(500);
      }
    } catch (e) {
      // Ignore errors on non-SmartTools pages
    }
  })();

  window.addEventListener('message', function(event) {
    if (event.source !== window) return;
    var data = event.data;
    if (!data || data.source !== 'smarttools-open-tabs-page' || data.action !== 'pending-received') return;
    chrome.storage.local.remove('pendingOpenTabsImport');
  });
}