import OpenAI from 'openai';
import { identifyAdTimeRange } from '../ai';
import { addAnimation, removeAnimation } from '../bilibili-ui';
import { MessageType, MIN_VIDEO_DURATION_S, MAX_VIDEO_DURATION_S, WARNING_DISPLAY_MS } from '../constants';
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
export function shouldSkipVideo(ignoreShortVideos: boolean, ignoreLongVideos: boolean): boolean {
    const videoDuration = window.__INITIAL_STATE__?.videoData?.duration;
    if (!videoDuration || videoDuration <= 0) return false;
    if (ignoreShortVideos && videoDuration <= MIN_VIDEO_DURATION_S) return true;
    if (ignoreLongVideos && videoDuration >= MAX_VIDEO_DURATION_S) return true;
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
    const videoTitle = window.__INITIAL_STATE__?.videoData?.title ?? '';
    const videoDescription = window.__INITIAL_STATE__?.videoData?.desc ?? '';

    // 阶段 1：正则预筛
    const filterResult = filterSubtitles(subtitles, userKeywords, disabledBuiltinKeywords);

    // 阶段 2：决定发什么给 AI
    const targetSubtitles = filterResult.hit
        ? filterResult.contextSubtitles!
        : subtitles;

    if (!filterResult.hit) {
        // No regex hit — send full subtitles to AI
    }

    const subStr = formatSubtitlesForAI(targetSubtitles);

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

        // result: AdDetectionResult (有广告), null (无广告), undefined (请求失败)
        // 只有 undefined 时不缓存（下次重试），null 和有广告都缓存
        if (result === null) {
            window.postMessage({ type: MessageType.SAVE_CACHE, data: {
                videoId: window.__INITIAL_STATE__?.bvid || '',
                startTime: 0, endTime: 0,
            } }, '*');
            return null;
        }

        if (result === undefined) {
            // 请求失败 — 不缓存，下次重试
            return null;
        }

        // 广告商自动学习
        if (result.advertiser) {
            window.postMessage({ type: MessageType.SAVE_KEYWORD, data: { keyword: result.advertiser } }, '*');
            showToast(`已学习新关键词: ${result.advertiser}`);
        }

        return result;
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
        showToast(messages.notLoginYet);
        return null;
    }

    // Check cache first (includes "no ad" cache entries with startTime=0, endTime=0)
    if (cache && videoId && cache[videoId]) {
        const cached = cache[videoId];
        if (cached.startTime === 0 && cached.endTime === 0) return null;
        return { startTime: cached.startTime, endTime: cached.endTime };
    }

    if (!client || !aiModel) return null;

    // Check subtitles
    const hasSubtitles = (response.data?.subtitle?.subtitles?.length ?? 0) > 0;

    if (!hasSubtitles) {
        flashWarningAnimation();
        return null;
    }

    const subtitleList = response.data.subtitle!.subtitles;
    const targetSubtitle = subtitleList.find(s => s.subtitle_url);
    if (!targetSubtitle) {
        flashWarningAnimation();
        return null;
    }

    const fullUrl = targetSubtitle.subtitle_url.startsWith('//')
        ? 'https:' + targetSubtitle.subtitle_url
        : targetSubtitle.subtitle_url;

    console.log(`📺 Subtitles: ${targetSubtitle.lan} (${subtitleList.length} available)`);

    let subtitles: BilibiliSubtitle[];
    try {
        const res = await fetch(fullUrl);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const jsonRes: SubtitleFileResponse = await res.json();
        subtitles = jsonRes.body;
    } catch (err) {
        console.error('📺 ❌ Failed to fetch subtitles:', err);
        flashWarningAnimation();
        return null;
    }

    // Save subtitles for popup transcript tab
    window.postMessage({ type: MessageType.SAVE_SUBTITLES, data: { videoId, subtitles } }, '*');

    return detectWithSubtitles(subtitles, client, aiModel, userKeywords, disabledBuiltinKeywords);
}
