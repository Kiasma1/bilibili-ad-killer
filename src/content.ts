import { MessageType, CACHE_TTL_MS, STORAGE_KEYS } from './constants';
import { DEFAULT_CONFIG } from './config';

console.log('📺 ✔️ Content script loaded');

// ---- Inject scripts into page ----

const cssLink = document.createElement('link');
cssLink.rel = 'stylesheet';
cssLink.href = chrome.runtime.getURL('lib/toastify.min.css');
(document.head || document.documentElement).appendChild(cssLink);

const injectScript = document.createElement('script');
injectScript.src = chrome.runtime.getURL('inject.js');
injectScript.onload = () => {
  console.log('📺 ✔️ Inject script loaded successfully');
  injectScript.remove();

  const toastifyScript = document.createElement('script');
  toastifyScript.src = chrome.runtime.getURL('lib/toastify.min.js');
  toastifyScript.onload = function() {
    console.log('📺 ✔️ Toastify loaded successfully');
    window.postMessage({ type: MessageType.TOASTIFY_LOADED }, '*');
  };
  (document.head || document.documentElement).appendChild(toastifyScript);
};
(document.head || document.documentElement).appendChild(injectScript);

// ---- Config & cache communication ----

(async () => {
  const result = await chrome.storage.local.get([
    'apiKey', 'aiModel', 'autoSkip', 'ignoreVideoLessThan5Minutes', 'ignoreVideoMoreThan30Minutes', 'usingBrowserAIModel'
  ]);

  const apiKey = result.apiKey || DEFAULT_CONFIG.apiKey;
  const aiModel = result.aiModel || DEFAULT_CONFIG.aiModel;
  const autoSkip = result.autoSkip !== undefined ? result.autoSkip : DEFAULT_CONFIG.autoSkip;
  const usingBrowserAIModel = result.usingBrowserAIModel !== undefined
    ? result.usingBrowserAIModel
    : DEFAULT_CONFIG.usingBrowserAIModel;
  const ignoreVideoLessThan5Minutes = result.ignoreVideoLessThan5Minutes !== undefined
    ? result.ignoreVideoLessThan5Minutes
    : DEFAULT_CONFIG.ignoreVideoLessThan5Minutes;
  const ignoreVideoMoreThan30Minutes = result.ignoreVideoMoreThan30Minutes !== undefined
    ? result.ignoreVideoMoreThan30Minutes
    : DEFAULT_CONFIG.ignoreVideoMoreThan30Minutes;

  console.log('📺 ✔️ Content script - Config retrieved:', {
    apiKey, aiModel, autoSkip, usingBrowserAIModel, ignoreVideoLessThan5Minutes, ignoreVideoMoreThan30Minutes
  });

  const sendConfig = () => {
    console.log('📺 ✔️ Sending config via postMessage');
    window.postMessage({
      type: MessageType.CONFIG,
      config: { apiKey, aiModel, autoSkip, ignoreVideoLessThan5Minutes, ignoreVideoMoreThan30Minutes, usingBrowserAIModel },
      i18n: {
        noApiKeyProvided: chrome.i18n.getMessage('noApiKeyProvided'),
        aiNotInitialized: chrome.i18n.getMessage('aiNotInitialized'),
        aiServiceFailed: chrome.i18n.getMessage('aiServiceFailed'),
        notLoginYet: chrome.i18n.getMessage('notLoginYet'),
      },
    }, '*');
  };

  const sendAdTimeRangeCache = async () => {
    const cache = (await chrome.storage.local.get(STORAGE_KEYS.AD_TIME_RANGE_CACHE))[STORAGE_KEYS.AD_TIME_RANGE_CACHE];
    window.postMessage({ type: MessageType.SEND_CACHE, data: cache }, '*');
  };

  const cleanOldCache = async () => {
    const cache = (await chrome.storage.local.get(STORAGE_KEYS.AD_TIME_RANGE_CACHE))[STORAGE_KEYS.AD_TIME_RANGE_CACHE] || {};
    const cutoff = Date.now() - CACHE_TTL_MS;

    const cleaned = Object.entries(cache).reduce((acc, [videoId, entry]: [string, any]) => {
      if (entry.createAt && entry.createAt > cutoff) {
        acc[videoId] = entry;
      }
      return acc;
    }, {} as Record<string, any>);

    await chrome.storage.local.set({ [STORAGE_KEYS.AD_TIME_RANGE_CACHE]: cleaned });

    const removedCount = Object.keys(cache).length - Object.keys(cleaned).length;
    if (removedCount > 0) {
      console.log(`📺 ✔️ Cleaned ${removedCount} old cache entries (older than 3 days)`);
    }
  };

  window.addEventListener('message', async (event) => {
    if (event.source !== window) return;

    if (event.data.type === MessageType.READY) {
      console.log('📺 ✔️ Inject script ready, sending config');
      sendConfig();
    }

    if (event.data.type === MessageType.REQUEST_CACHE) {
      console.log('📺 ✔️ Received request for AD time range cache');
      await sendAdTimeRangeCache();
    }

    if (event.data.type === MessageType.SAVE_CACHE) {
      const eventData = event.data.data;
      if (!eventData.videoId || !eventData.startTime || !eventData.endTime) {
        console.log('📺 ❌ No ad time range received');
        return;
      }

      const cache = (await chrome.storage.local.get(STORAGE_KEYS.AD_TIME_RANGE_CACHE))[STORAGE_KEYS.AD_TIME_RANGE_CACHE] || {};
      await chrome.storage.local.set({
        [STORAGE_KEYS.AD_TIME_RANGE_CACHE]: {
          ...cache,
          [eventData.videoId]: {
            startTime: eventData.startTime,
            endTime: eventData.endTime,
            createAt: Date.now(),
          },
        },
      });

      await cleanOldCache();
    }
  });
})();
