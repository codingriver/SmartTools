window.addEventListener('message', event => {
  if (event.source !== window) return;
  const data = event.data;
  if (!data || data.source !== 'smarttools-open-tabs-page') return;
  chrome.runtime.sendMessage(data);
});
