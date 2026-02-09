import { GoogleGenAI } from '@google/genai';
import { AdTimeRange, AdTimeRangeCache, BilibiliPlayerResponse, Subtitle, SubtitleFileResponse } from '../types';
import { MIN_VIDEO_DURATION_S, WARNING_DISPLAY_MS } from '../constants';
import { convertSubtitleObjToStr } from '../util';
import { identifyAdTimeRangeByGeminiAI, checkGeminiConnectivity } from '../ai';
import { showToast, messages } from '../toast';
import { addAnimation, removeAnimation } from '../bilibili-ui';
import { warningAnimation } from '../style';

// ============================================================
// Subtitle service — fetches subtitles and detects ads via AI
// ============================================================

/**
 * 根据视频时长判断是否应跳过该视频的广告检测
 * @param ignoreShortVideos - 用户是否开启了"忽略短视频"设置
 * @returns 如果视频时长 ≤ 5 分钟且设置开启，返回 true
 */
export function shouldSkipVideo(ignoreShortVideos: boolean): boolean {
    if (!ignoreShortVideos) return false;
    const videoDuration = window.__INITIAL_STATE__.videoData.duration;
    console.log('📺 ✔️ Video duration', videoDuration);
    if (videoDuration !== null && videoDuration <= MIN_VIDEO_DURATION_S) {
        console.log(`📺 ✔️ Ignoring video: duration (${videoDuration}s) is less than 5 minutes`);
        return true;
    }
    return false;
}

/** 短暂闪烁警告动画，提示用户字幕不可用 */
function flashWarningAnimation(): void {
    addAnimation(warningAnimation.className);
    setTimeout(() => {
        removeAnimation();
    }, WARNING_DISPLAY_MS);
}

/**
 * 从 B 站播放器 API 响应中获取字幕，调用 AI 检测广告时间段
 * @param response - B 站播放器 API 的响应数据
 * @param videoId - 当前视频的 BV 号
 * @param geminiClient - Gemini AI 客户端实例（可能为 null）
 * @param aiModel - 使用的 AI 模型名称
 * @param cache - 广告时间范围缓存（可能为 null）
 * @returns 检测到的广告时间范围，未检测到则返回 null
 */
export async function detectAdFromVideo(
    response: BilibiliPlayerResponse,
    videoId: string,
    geminiClient: GoogleGenAI | null,
    aiModel: string,
    cache: AdTimeRangeCache | null
): Promise<AdTimeRange | null> {

    // Check login status
    if (!response.data?.name) {
        console.error('📺 ❌ Not login yet');
        showToast(messages.notLoginYet);
        return null;
    }

    // Check subtitles exist
    if (!response.data?.subtitle?.subtitles?.length) {
        console.error('📺 ❌ No subtitles found in response');
        flashWarningAnimation();
        return null;
    }

    // Get first subtitle track
    const targetSubtitle = response.data.subtitle.subtitles[0];
    if (!targetSubtitle.subtitle_url) {
        console.error('📺 ❌ Unable to get the subtitle url');
        flashWarningAnimation();
        return null;
    }

    // Normalize URL (Bilibili uses protocol-relative URLs)
    const fullUrl = targetSubtitle.subtitle_url.startsWith('//')
        ? 'https:' + targetSubtitle.subtitle_url
        : targetSubtitle.subtitle_url;

    console.log(`📺 ✔️ Language: ${targetSubtitle.lan_doc} (${targetSubtitle.lan})`);
    console.log(`📺 ✔️ URL: ${fullUrl}`);

    // Fetch and convert subtitles
    const jsonRes: SubtitleFileResponse = await (await fetch(fullUrl)).json();
    const subtitles: Subtitle[] = jsonRes.body;
    const subtitleStr = convertSubtitleObjToStr(subtitles);

    // Verify AI client is ready
    if (!geminiClient || !aiModel) {
        console.error('📺 🤖 ❌ Gemini client not initialized');
        return null;
    }

    const connectivity = await checkGeminiConnectivity(geminiClient, aiModel);
    console.log('📺 🤖 Check Gemini connectivity', connectivity);

    // Check cache first
    console.log('📺 📦 ✔️ Video ID:', videoId);
    console.log('📺 📦 ✔️ Ad time range cache:', cache);

    if (cache && videoId && cache[videoId]) {
        const cached = cache[videoId];
        console.log('📺 📦 ✔️ Cache hit for video:', videoId, cached);
        return { startTime: cached.startTime, endTime: cached.endTime };
    }

    // Cache miss — call AI
    console.log('📺 📦 ✔️ Cache miss for video:', videoId);
    const videoTitle = window.__INITIAL_STATE__.videoData.title;
    const videoDescription = window.__INITIAL_STATE__.videoData.desc;

    try {
        addAnimation('bilibili-thinking-animation');
        const adTimeRange = await identifyAdTimeRangeByGeminiAI({
            geminiClient,
            subStr: subtitleStr,
            aiModel,
            videoTitle,
            videoDescription,
        });
        removeAnimation();
        return adTimeRange ?? null;
    } catch (error) {
        console.error('📺 🤖 ❌ Error identifying ad time range:', error);
        removeAnimation();
        return null;
    }
}
