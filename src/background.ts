// Background service worker
console.log('[Bilibili Subtitle Monitor] Background service worker initialized');

/** 监听扩展安装/更新事件 */
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('[Bilibili Ad Killer] Extension installed');
  } else if (details.reason === 'update') {
    console.log('[Bilibili Ad Killer] Extension updated');
  }
});

/** 监听来自 content script 的消息 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[Bilibili Ad Killer] Message received:', message);
  sendResponse({ received: true });
  return true;
});

