import { GoogleGenAI } from '@google/genai';
import { initializeAdBar, addAnimation, removeAnimation, cleanupDomElements } from './bilibili-ui';
import { getVideoIdFromCurrentPage } from './util';
import { showToast, initToastMessages, messages, notifyDelayedMessages } from './toast';
import { initializeConfig, UserConfig } from './config';
import { MessageType } from './constants';
import { installXhrInterceptor } from './services/xhr-interceptor';
import { shouldSkipVideo, detectAdFromVideo } from './services/subtitle';
import { cleanupManager } from './services/cleanup';
import { AdTimeRangeCache, BilibiliPlayerResponse } from './types';

// ============================================================
// inject.ts — slim entry point wiring services together
// ============================================================

/** 当前用户配置（从 content script 接收） */
let config: UserConfig | null = null;
/** Gemini AI 客户端实例 */
let geminiClient: GoogleGenAI | null = null;
/** 广告时间范围缓存（从 content script 接收） */
let adTimeRangeCache: AdTimeRangeCache | null = null;

/** XHR 拦截到的播放器 API 响应缓存，按视频 BV 号索引 */
const webResponseCache: { [videoBvid: string]: BilibiliPlayerResponse } = {};
/** 当前正在处理的视频 BV 号 */
let currentVideoId: string | null = null;

// ---- Signal readiness ----

console.log('📺 ✔️ Inject script ready, signaling to content script');
window.postMessage({ type: MessageType.READY }, '*');
window.postMessage({ type: MessageType.REQUEST_CACHE }, '*');

// ---- Message handling ----

window.addEventListener('message', (event) => {
    if (event.source !== window) return;

    if (event.data.type === MessageType.TOASTIFY_LOADED) {
        const notifyWhenBodyReady = () => {
            if (document.body) {
                notifyDelayedMessages();
            } else {
                requestAnimationFrame(notifyWhenBodyReady);
            }
        };
        notifyWhenBodyReady();
        return;
    }

    if (event.data.type === MessageType.SEND_CACHE) {
        adTimeRangeCache = event.data.data;
        if (!adTimeRangeCache || Object.keys(adTimeRangeCache).length === 0) {
            return;
        }
        console.log('📺 📦 ✔️ Retrieved ad time cache');
    }

    if (event.data.type === MessageType.CONFIG) {
        const receivedConfig = event.data.config;
        config = receivedConfig;
        initializeConfig(config!);

        if (event.data.i18n) {
            initToastMessages(event.data.i18n);
        }

        console.log('📺 ⚙️ ✔️ Config received:', {
            apiKey: receivedConfig.apiKey,
            aiModel: receivedConfig.aiModel,
            autoSkip: receivedConfig.autoSkip,
            ignoreVideoLessThan5Minutes: receivedConfig.ignoreVideoLessThan5Minutes,
            ignoreVideoMoreThan30Minutes: receivedConfig.ignoreVideoMoreThan30Minutes,
            usingBrowserAIModel: receivedConfig.usingBrowserAIModel,
        });

        if (receivedConfig.apiKey) {
            geminiClient = new GoogleGenAI({ apiKey: receivedConfig.apiKey });
            console.log('📺 🤖 ✔️ AI initialized');
        } else {
            console.log('📺 🤖 ❌ No API key provided');
            showToast(messages.noApiKeyProvided);
        }
    }
});

// ---- Process a video ----

/**
 * 处理单个视频的广告检测流程
 * 检查是否应跳过短视频，然后调用 AI 检测广告并初始化广告标记条
 * @param response - B 站播放器 API 的响应数据
 * @param videoId - 当前视频的 BV 号
 */
async function processVideo(response: BilibiliPlayerResponse, videoId: string): Promise<void> {
    if (config?.ignoreVideoLessThan5Minutes && shouldSkipVideo(true)) {
        return;
    }

    const adTimeRange = await detectAdFromVideo(
        response, videoId, geminiClient, config?.aiModel ?? '', adTimeRangeCache
    );

    if (!adTimeRange) {
        console.log('📺 ✔️ No ads detected in this video');
        return;
    }

    console.log('📺 ✔️ Ad detected:', adTimeRange);
    initializeAdBar(adTimeRange.startTime, adTimeRange.endTime);
}

// ---- XHR interception ----

installXhrInterceptor(async (responseText: string) => {
    try {
        const response: BilibiliPlayerResponse = JSON.parse(responseText);
        const videoBvid = response.data?.bvid;
        const videoId = getVideoIdFromCurrentPage();

        if (videoBvid) {
            webResponseCache[videoBvid] = response;
        }

        if (!videoId || videoBvid !== videoId) {
            return;
        }

        await processVideo(response, videoId);
    } catch (error) {
        console.error('📺 ❌ Error parsing response:', error);
    }
});

// ---- URL change monitoring ----

/** 页面导航时清理所有资源和 DOM 元素 */
function cleanupForNavigation(): void {
    cleanupManager.cleanupAll();
    cleanupDomElements();
}

/**
 * 启动 URL 变化监控，检测 B 站 SPA 内的视频切换
 * 切换时清理旧资源，并尝试从缓存中处理新视频
 */
function monitorUrlChanges(): void {
    setInterval(async () => {
        if (!window.location.pathname.startsWith('/video/')) {
            return;
        }

        const urlVideoId = getVideoIdFromCurrentPage();
        if (!urlVideoId || urlVideoId === currentVideoId) {
            return;
        }

        console.log('📺 🔄 URL changed:', currentVideoId, '→', urlVideoId);
        cleanupForNavigation();
        currentVideoId = urlVideoId;

        if (webResponseCache[urlVideoId]) {
            console.log('📺 ⚡ Processing from cache:', urlVideoId);
            await processVideo(webResponseCache[urlVideoId], urlVideoId);
        } else {
            console.log('📺 ⏭️ Cache miss for:', urlVideoId, '- cleaned up only');
        }
    }, 300);
}

if (window.location.pathname.startsWith('/video/')) {
    currentVideoId = getVideoIdFromCurrentPage();
    console.log('📺 ✔️ Initial video ID:', currentVideoId);
}

monitorUrlChanges();
console.log('📺 ✔️ URL monitoring active');
