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

let config: UserConfig | null = null;
let geminiClient: GoogleGenAI | null = null;
let adTimeRangeCache: AdTimeRangeCache | null = null;

const webResponseCache: { [videoBvid: string]: BilibiliPlayerResponse } = {};
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

function cleanupForNavigation(): void {
    cleanupManager.cleanupAll();
    cleanupDomElements();
}

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
