import OpenAI from 'openai';
import { checkAIConnectivity, identifyAdTimeRange } from '../ai';
import { addAnimation, removeAnimation } from '../bilibili-ui';
import { MessageType, MIN_VIDEO_DURATION_S, WARNING_DISPLAY_MS } from '../constants';
import { warningAnimation } from '../style';
import { messages, showToast } from '../toast';
import { AdTimeRange, AdTimeRangeCache, BilibiliPlayerResponse, BilibiliSubtitle, SubtitleFileResponse, UserKeyword } from '../types';
import { filterSubtitles } from './keyword-filter';

// ============================================================
// Subtitle service — fetches subtitles and detects ads via AI
// ============================================================

/**
 * 根据视频时长判断是否应跳过该视频的广告检测
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
 * 将字幕数组格式化为 AI 可读的字符串
 */
function formatSubtitlesForAI(subtitles: BilibiliSubtitle[]): string {
    return subtitles
        .map(sub => `[${sub.from}-${sub.to}]:${sub.content}`)
        .join(';');
}

/**
 * 有字幕时的广告检测：正则预筛 → AI 精确定位
 */
async function detectWithSubtitles(
    subtitles: BilibiliSubtitle[],
    client: OpenAI,
    aiModel: string,
    userKeywords: UserKeyword[],
    disabledBuiltinKeywords: string[],
): Promise<AdTimeRange | null> {
    const videoTitle = window.__INITIAL_STATE__.videoData.title;
    const videoDescription = window.__INITIAL_STATE__.videoData.desc;

    // 阶段 1：正则预筛
    const filterResult = filterSubtitles(subtitles, userKeywords, disabledBuiltinKeywords);

    // 阶段 2：决定发什么给 AI
    const targetSubtitles = filterResult.hit
        ? filterResult.contextSubtitles!
        : subtitles;

    if (!filterResult.hit) {
        console.log('📺 🔍 No regex hit, sending full subtitles');
    }

    const subStr = formatSubtitlesForAI(targetSubtitles);
    console.log(`📺 📝 Subtitle length: ${subStr.length} chars`);

    try {
        addAnimation('bilibili-thinking-animation');
        const result = await identifyAdTimeRange({
            client,
            subStr,
            aiModel,
            videoTitle,
            videoDescription,
        });
        removeAnimation();

        // 广告商自动学习
        if (result?.advertiser) {
            window.postMessage({ type: MessageType.SAVE_KEYWORD, data: { keyword: result.advertiser } }, '*');
            showToast(`已学习新关键词: ${result.advertiser}`);
        }

        return result ?? null;
    } catch (error) {
        console.error('📺 🤖 ❌ Error identifying ad time range:', error);
        removeAnimation();
        return null;
    }
}

/**
 * 从 B 站播放器 API 响应中检测广告时间段
 */
export async function detectAdFromVideo(
    response: BilibiliPlayerResponse,
    videoId: string,
    client: OpenAI | null,
    aiModel: string,
    cache: AdTimeRangeCache | null,
    userKeywords: UserKeyword[],
    disabledBuiltinKeywords: string[] = [],
): Promise<AdTimeRange | null> {

    // Check login status
    if (!response.data?.name) {
        console.error('📺 ❌ Not login yet');
        showToast(messages.notLoginYet);
        return null;
    }

    // Check cache first
    console.log('📺 📦 ✔️ Video ID:', videoId);
    if (cache && videoId && cache[videoId]) {
        const cached = cache[videoId];
        console.log('📺 📦 ✔️ Cache hit for video:', videoId, cached);
        return { startTime: cached.startTime, endTime: cached.endTime };
    }
    console.log('📺 📦 ✔️ Cache miss for video:', videoId);

    // Verify AI client is ready
    if (!client || !aiModel) {
        console.error('📺 🤖 ❌ AI client not initialized');
        return null;
    }

    try {
        const connectivity = await checkAIConnectivity(client, aiModel);
        console.log('📺 🤖 Check AI connectivity', connectivity);
    } catch {
        console.error('📺 🤖 ❌ AI connectivity check failed');
        return null;
    }

    // Check subtitles
    const hasSubtitles = (response.data?.subtitle?.subtitles?.length ?? 0) > 0;

    if (!hasSubtitles) {
        console.log('📺 ❌ No subtitles available');
        flashWarningAnimation();
        return null;
    }

    const targetSubtitle = response.data.subtitle!.subtitles[0];
    if (!targetSubtitle.subtitle_url) {
        console.error('📺 ❌ Unable to get the subtitle url');
        flashWarningAnimation();
        return null;
    }

    const fullUrl = targetSubtitle.subtitle_url.startsWith('//')
        ? 'https:' + targetSubtitle.subtitle_url
        : targetSubtitle.subtitle_url;

    console.log(`📺 ✔️ Language: ${targetSubtitle.lan_doc} (${targetSubtitle.lan})`);
    console.log(`📺 ✔️ URL: ${fullUrl}`);

    const jsonRes: SubtitleFileResponse = await (await fetch(fullUrl)).json();
    const subtitles: BilibiliSubtitle[] = jsonRes.body;

    return detectWithSubtitles(subtitles, client, aiModel, userKeywords, disabledBuiltinKeywords);
}
