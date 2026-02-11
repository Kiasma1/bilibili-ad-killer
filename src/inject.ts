import OpenAI from 'openai';
import { initializeAdBar, addAnimation, removeAnimation, cleanupDomElements } from './bilibili-ui';
import { getVideoIdFromCurrentPage } from './util';
import { showToast, initToastMessages, messages, notifyDelayedMessages } from './toast';
import { initializeConfig, UserConfig } from './config';
import { MessageType } from './constants';
import { installXhrInterceptor } from './services/xhr-interceptor';
import { shouldSkipVideo, detectAdFromVideo } from './services/subtitle';
import { cleanupManager } from './services/cleanup';
import { AdTimeRangeCache, BilibiliPlayerResponse, UserKeyword } from './types';

// ============================================================
// inject.ts — slim entry point wiring services together
// ============================================================

/** 当前用户配置（从 content script 接收） */
let config: UserConfig | null = null;
/** DeepSeek AI 客户端实例 */
let aiClient: OpenAI | null = null;
/** 广告时间范围缓存（从 content script 接收） */
let adTimeRangeCache: AdTimeRangeCache | null = null;
/** 用户词库（从 content script 接收） */
let userKeywords: UserKeyword[] = [];
/** 用户禁用的内置关键词（从 content script 接收） */
let disabledBuiltinKeywords: string[] = [];

/** XHR 拦截到的播放器 API 响应缓存，按视频 BV 号索引 */
const webResponseCache: { [videoBvid: string]: BilibiliPlayerResponse } = {};
/** 当前正在处理的视频 BV 号 */
let currentVideoId: string | null = null;
/** 当前正在进行的 AI 检测的视频 ID，用于竞态条件检查 */
let processingVideoId: string | null = null;

// ---- Signal readiness ----

window.postMessage({ type: MessageType.READY }, '*');
window.postMessage({ type: MessageType.REQUEST_CACHE }, '*');
window.postMessage({ type: MessageType.REQUEST_KEYWORDS }, '*');

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
    }

    if (event.data.type === MessageType.SEND_KEYWORDS) {
        userKeywords = event.data.data || [];
        disabledBuiltinKeywords = event.data.disabledBuiltin || [];
    }

    if (event.data.type === MessageType.CONFIG) {
        const receivedConfig = event.data.config;
        config = receivedConfig;
        initializeConfig(config!);

        if (event.data.i18n) {
            initToastMessages(event.data.i18n);
        }

        if (receivedConfig.deepseekApiKey) {
            aiClient = new OpenAI({
                apiKey: receivedConfig.deepseekApiKey,
                baseURL: 'https://api.deepseek.com',
                dangerouslyAllowBrowser: true,
            });
        } else {
            showToast(messages.noApiKeyProvided);
        }
    }

    if (event.data.type === MessageType.URL_CHANGED) {
        const newVideoId = event.data.videoId;
        if (newVideoId && newVideoId !== currentVideoId) {
            handleVideoChange(newVideoId);
        }
    }
});

// ---- Process a video ----

/**
 * 处理单个视频的广告检测流程
 */
async function processVideo(response: BilibiliPlayerResponse, videoId: string): Promise<void> {
    if (config?.ignoreVideoLessThan5Minutes || config?.ignoreVideoMoreThan30Minutes) {
        if (shouldSkipVideo(!!config.ignoreVideoLessThan5Minutes, !!config.ignoreVideoMoreThan30Minutes)) {
            return;
        }
    }

    processingVideoId = videoId;

    const adTimeRange = await detectAdFromVideo(
        response, videoId, aiClient, config?.aiModel ?? '', adTimeRangeCache, userKeywords, disabledBuiltinKeywords
    );

    // Race condition guard: if video changed during AI request, discard result
    if (processingVideoId !== videoId) {
        console.log('📺 Video changed during detection, discarding result for', videoId);
        return;
    }

    if (!adTimeRange) return;

    console.log('📺 Ad detected:', adTimeRange);
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

// ---- URL change monitoring (via background service worker) ----

/** 页面导航时清理所有资源和 DOM 元素 */
function cleanupForNavigation(): void {
    cleanupManager.cleanupAll();
    cleanupDomElements();
}

/**
 * 处理视频切换逻辑：清理旧资源，尝试从缓存处理新视频
 */
async function handleVideoChange(newVideoId: string): Promise<void> {
    cleanupForNavigation();
    currentVideoId = newVideoId;

    if (webResponseCache[newVideoId]) {
        await processVideo(webResponseCache[newVideoId], newVideoId);
    }
}

if (window.location.pathname.startsWith('/video/')) {
    currentVideoId = getVideoIdFromCurrentPage();
}
