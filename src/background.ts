// Background service worker
console.log('[Bilibili Subtitle Monitor] Background service worker initialized');

// Listen for installation
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('[Bilibili Ad Killer] Extension installed');
  } else if (details.reason === 'update') {
    console.log('[Bilibili Ad Killer] Extension updated');
  }
});

// Optional: Listen for messages from content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[Bilibili Ad Killer] Message received:', message);
  sendResponse({ received: true });
  return true;
});

