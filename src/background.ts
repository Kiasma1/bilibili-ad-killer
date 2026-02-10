// Background service worker
console.log('[Bilibili Ad Killer] Background service worker initialized');

/** 监听扩展安装/更新事件 */
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('[Bilibili Ad Killer] Extension installed');
  } else if (details.reason === 'update') {
    console.log('[Bilibili Ad Killer] Extension updated');
  }
});

/**
 * 监听 Tab URL 变化，检测 B 站视频页面的 SPA 导航
 * 当 URL 变化且为视频页时，通知对应 tab 的 content script
 */
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.url && tab.url) {
    const match = tab.url.match(/bilibili\.com\/video\/(BV\w+)/);
    if (match) {
      const videoId = match[1];
      console.log(`[Bilibili Ad Killer] Tab ${tabId} navigated to video: ${videoId}`);
      chrome.tabs.sendMessage(tabId, {
        type: 'BILIBILI_AD_SKIP_URL_CHANGED',
        videoId,
      }).catch(() => {
        // content script 可能尚未加载，忽略错误
      });
    }
  }
});
