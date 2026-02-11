// ============================================================
// Content script — runs in Chrome extension isolated world
// NOTE: This file CANNOT use ES imports because Chrome loads
// content scripts as plain scripts, not ES modules.
// Constants are inlined here instead of imported.
// ============================================================

// ---- Inlined constants (from constants/index.ts) ----

const MessageType = {
  READY: 'BILIBILI_AD_SKIP_READY',
  CONFIG: 'BILIBILI_AD_SKIP_CONFIG',
  TOASTIFY_LOADED: 'TOASTIFY_LOADED',
  REQUEST_CACHE: 'REQUEST_VIDEO_AD_TIMERANGE',
  SEND_CACHE: 'SEND_VIDEO_AD_TIMERANGE',
  SAVE_CACHE: 'SAVE_VIDEO_AD_TIMERANGE',
  URL_CHANGED: 'BILIBILI_AD_SKIP_URL_CHANGED',
} as const;

const CACHE_TTL_MS = 3 * 24 * 60 * 60 * 1000;
const AD_TIME_RANGE_CACHE_KEY = 'AD_TIME_RANGE_CACHE';

const DEFAULT_CONFIG = {
  deepseekApiKey: '',
  aiModel: 'deepseek-chat',
  autoSkip: true,
  ignoreVideoLessThan5Minutes: true,
  ignoreVideoMoreThan30Minutes: true,
};

// ============================================================

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
    'deepseekApiKey', 'aiModel', 'autoSkip', 'ignoreVideoLessThan5Minutes', 'ignoreVideoMoreThan30Minutes'
  ]);

  const deepseekApiKey = result.deepseekApiKey || DEFAULT_CONFIG.deepseekApiKey;
  const aiModel = result.aiModel || DEFAULT_CONFIG.aiModel;
  const autoSkip = result.autoSkip !== undefined ? result.autoSkip : DEFAULT_CONFIG.autoSkip;
  const ignoreVideoLessThan5Minutes = result.ignoreVideoLessThan5Minutes !== undefined
    ? result.ignoreVideoLessThan5Minutes
    : DEFAULT_CONFIG.ignoreVideoLessThan5Minutes;
  const ignoreVideoMoreThan30Minutes = result.ignoreVideoMoreThan30Minutes !== undefined
    ? result.ignoreVideoMoreThan30Minutes
    : DEFAULT_CONFIG.ignoreVideoMoreThan30Minutes;

  console.log('📺 ✔️ Content script - Config retrieved:', {
    deepseekApiKey, aiModel, autoSkip, ignoreVideoLessThan5Minutes, ignoreVideoMoreThan30Minutes
  });

  /**
   * 将用户配置和 i18n 文本通过 postMessage 发送给 inject script
   */
  const sendConfig = () => {
    console.log('📺 ✔️ Sending config via postMessage');
    window.postMessage({
      type: MessageType.CONFIG,
      config: { deepseekApiKey, aiModel, autoSkip, ignoreVideoLessThan5Minutes, ignoreVideoMoreThan30Minutes },
      i18n: {
        noApiKeyProvided: chrome.i18n.getMessage('noApiKeyProvided'),
        aiNotInitialized: chrome.i18n.getMessage('aiNotInitialized'),
        aiServiceFailed: chrome.i18n.getMessage('aiServiceFailed'),
        notLoginYet: chrome.i18n.getMessage('notLoginYet'),
      },
    }, '*');
  };

  /**
   * 从 Chrome 本地存储读取广告时间范围缓存，并发送给 inject script
   */
  const sendAdTimeRangeCache = async () => {
    const cache = (await chrome.storage.local.get(AD_TIME_RANGE_CACHE_KEY))[AD_TIME_RANGE_CACHE_KEY];
    window.postMessage({ type: MessageType.SEND_CACHE, data: cache }, '*');
  };

  /**
   * 清理过期的广告缓存条目（超过 3 天的会被删除）
   */
  const cleanOldCache = async () => {
    const cache = (await chrome.storage.local.get(AD_TIME_RANGE_CACHE_KEY))[AD_TIME_RANGE_CACHE_KEY] || {};
    const cutoff = Date.now() - CACHE_TTL_MS;

    const cleaned = Object.entries(cache).reduce((acc, [videoId, entry]: [string, any]) => {
      if (entry.createAt && entry.createAt > cutoff) {
        acc[videoId] = entry;
      }
      return acc;
    }, {} as Record<string, any>);

    await chrome.storage.local.set({ [AD_TIME_RANGE_CACHE_KEY]: cleaned });

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

      const cache = (await chrome.storage.local.get(AD_TIME_RANGE_CACHE_KEY))[AD_TIME_RANGE_CACHE_KEY] || {};
      await chrome.storage.local.set({
        [AD_TIME_RANGE_CACHE_KEY]: {
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

  /**
   * 监听来自 background service worker 的消息
   * 当 background 检测到 URL 变化时，转发给 inject script
   */
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === MessageType.URL_CHANGED && message.videoId) {
      console.log('📺 ✔️ URL change detected by background, forwarding to inject:', message.videoId);
      window.postMessage({
        type: MessageType.URL_CHANGED,
        videoId: message.videoId,
      }, '*');
    }
  });
})();
