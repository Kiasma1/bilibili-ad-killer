import { AIClient, checkAIConnectivity, identifyAdTimeRange } from '../ai';
import { addAnimation, removeAnimation } from '../bilibili-ui';
import { MIN_VIDEO_DURATION_S, WARNING_DISPLAY_MS } from '../constants';
import { warningAnimation } from '../style';
import { messages, showToast } from '../toast';
import { AdTimeRange, AdTimeRangeCache, BilibiliPlayerResponse, BilibiliSubtitle, LearnedRule, SubtitleFileResponse } from '../types';
import { matchAdByRegex, saveLearnedRule } from './ad-filter';
import { compressSubtitles } from './subtitle-compressor';
import { fetchDanmaku, extractDanmakuWindow, formatDanmakuForAI } from './danmaku';

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
 * 尝试获取视频的 cid（用于弹幕 API）
 * 优先从 API 响应中获取，其次从页面全局变量获取
 */
function getCid(response: BilibiliPlayerResponse): number | undefined {
    if (response.data?.cid) return response.data.cid;
    if (window.__INITIAL_STATE__?.videoData?.cid) return window.__INITIAL_STATE__.videoData.cid;
    return undefined;
}

/**
 * 路线 A：有字幕时的广告检测流程
 * 1. 本地正则预筛字幕
 * 2. 命中则直接返回时间范围（零 Token）
 * 3. 未命中则压缩字幕后发给 AI
 */
async function detectWithSubtitles(
    subtitles: BilibiliSubtitle[],
    aiClient: AIClient,
    aiModel: string,
    learnedRules: LearnedRule[],
): Promise<AdTimeRange | null> {
    const videoTitle = window.__INITIAL_STATE__.videoData.title;
    const videoDescription = window.__INITIAL_STATE__.videoData.desc;

    // Local regex pre-screening with density threshold
    // A sliding 30s window must contain ≥ 3 hits to be considered a real ad
    const DENSITY_WINDOW = 30;
    const DENSITY_THRESHOLD = 3;

    const textsForRegex = subtitles.map(sub => ({ time: sub.from, content: sub.content }));
    const hitTimes = matchAdByRegex(textsForRegex, learnedRules);

    if (hitTimes.length >= DENSITY_THRESHOLD) {
        // Sort hit times
        const sorted = [...hitTimes].sort((a, b) => a - b);

        // Sliding window: find windows with ≥ DENSITY_THRESHOLD hits
        let bestStart = -1;
        let bestEnd = -1;
        let bestCount = 0;

        for (let i = 0; i < sorted.length; i++) {
            const windowStart = sorted[i];
            const windowEnd = windowStart + DENSITY_WINDOW;
            // Count hits within this window
            let count = 0;
            let lastInWindow = i;
            for (let j = i; j < sorted.length && sorted[j] <= windowEnd; j++) {
                count++;
                lastInWindow = j;
            }
            if (count >= DENSITY_THRESHOLD && count > bestCount) {
                bestCount = count;
                bestStart = sorted[i];
                bestEnd = sorted[lastInWindow];
            }
        }

        if (bestStart >= 0) {
            // Expand to full subtitle boundaries
            const adSubtitles = subtitles.filter(
                sub => sub.from >= bestStart && sub.from <= bestEnd + DENSITY_WINDOW
            );
            if (adSubtitles.length > 0) {
                const startTime = Math.min(...adSubtitles.map(s => s.from));
                const endTime = Math.max(...adSubtitles.map(s => s.to));
                console.log(`📺 🔍 Regex density hit: ${bestCount} hits in ${DENSITY_WINDOW}s window, range ${startTime}-${endTime}s`);
                return { startTime, endTime };
            }
        }

        console.log(`📺 🔍 Regex hit ${hitTimes.length} subtitle(s) but no dense window, forwarding to AI`);
    } else if (hitTimes.length > 0) {
        console.log(`📺 🔍 Regex hit ${hitTimes.length} subtitle(s), below density threshold (${DENSITY_THRESHOLD}), ignoring`);
    }

    // Compress subtitles before sending to AI
    const compressedStr = compressSubtitles(subtitles);
    console.log(`📺 🗜️ Compressed subtitle length: ${compressedStr.length} chars`);

    try {
        addAnimation('bilibili-thinking-animation');
        const result = await identifyAdTimeRange({
            aiClient,
            subStr: compressedStr,
            aiModel,
            videoTitle,
            videoDescription,
        });
        removeAnimation();

        if (result?.advertiser) {
            saveLearnedRule(result.advertiser);
        }

        return result ?? null;
    } catch (error) {
        console.error('📺 🤖 ❌ Error identifying ad time range:', error);
        removeAnimation();
        return null;
    }
}

/**
 * 路线 B：无字幕时的弹幕 fallback 检测流程
 * 1. 获取弹幕
 * 2. 本地正则预筛弹幕
 * 3. 无命中则判定无广告
 * 4. 有命中则提取窗口弹幕发给 AI
 */
async function detectWithDanmaku(
    cid: number,
    aiClient: AIClient,
    aiModel: string,
    learnedRules: LearnedRule[],
): Promise<AdTimeRange | null> {
    const videoTitle = window.__INITIAL_STATE__.videoData.title;
    const videoDescription = window.__INITIAL_STATE__.videoData.desc;

    console.log(`📺 💬 Danmaku fallback: fetching danmaku for cid=${cid}`);
    const danmakuList = await fetchDanmaku(cid);

    if (danmakuList.length === 0) {
        console.log('📺 💬 No danmaku available');
        flashWarningAnimation();
        return null;
    }

    // Local regex pre-screening on danmaku
    const hitTimes = matchAdByRegex(danmakuList, learnedRules);

    if (hitTimes.length === 0) {
        console.log('📺 💬 No ad keywords found in danmaku, assuming no ads');
        return null;
    }

    console.log(`📺 💬 Regex hit ${hitTimes.length} danmaku, extracting window for AI`);

    // Extract danmaku around hit times and send to AI
    const windowDanmaku = extractDanmakuWindow(danmakuList, hitTimes);
    const danmakuStr = formatDanmakuForAI(windowDanmaku);

    try {
        addAnimation('bilibili-thinking-animation');
        const result = await identifyAdTimeRange({
            aiClient,
            subStr: danmakuStr,
            aiModel,
            videoTitle,
            videoDescription,
            isDanmaku: true,
        });
        removeAnimation();

        if (result?.advertiser) {
            saveLearnedRule(result.advertiser);
        }

        return result ?? null;
    } catch (error) {
        console.error('📺 🤖 ❌ Error identifying ad time range from danmaku:', error);
        removeAnimation();
        return null;
    }
}

/**
 * 从 B 站播放器 API 响应中检测广告时间段
 * 路线 A：有字幕 → 本地正则预筛 + 字幕压缩 + AI
 * 路线 B：无字幕 → 弹幕 fallback
 * @param response - B 站播放器 API 的响应数据
 * @param videoId - 当前视频的 BV 号
 * @param aiClient - AI 客户端实例（可能为 null）
 * @param aiModel - 使用的 AI 模型名称
 * @param cache - 广告时间范围缓存（可能为 null）
 * @param learnedRules - 自学习广告规则列表
 * @returns 检测到的广告时间范围，未检测到则返回 null
 */
export async function detectAdFromVideo(
    response: BilibiliPlayerResponse,
    videoId: string,
    aiClient: AIClient | null,
    aiModel: string,
    cache: AdTimeRangeCache | null,
    learnedRules: LearnedRule[] = [],
): Promise<AdTimeRange | null> {

    // Check login status
    if (!response.data?.name) {
        console.error('📺 ❌ Not login yet');
        showToast(messages.notLoginYet);
        return null;
    }

    // Check cache first (before subtitle check)
    console.log('📺 📦 ✔️ Video ID:', videoId);
    if (cache && videoId && cache[videoId]) {
        const cached = cache[videoId];
        console.log('📺 📦 ✔️ Cache hit for video:', videoId, cached);
        return { startTime: cached.startTime, endTime: cached.endTime };
    }
    console.log('📺 📦 ✔️ Cache miss for video:', videoId);

    // Verify AI client is ready
    if (!aiClient || !aiModel) {
        console.error('📺 🤖 ❌ AI client not initialized');
        return null;
    }

    try {
        const connectivity = await checkAIConnectivity(aiClient, aiModel);
        console.log('📺 🤖 Check AI connectivity', connectivity);
    } catch {
        console.error('📺 🤖 ❌ AI connectivity check failed');
        return null;
    }

    // Determine route: subtitles or danmaku fallback
    const hasSubtitles = (response.data?.subtitle?.subtitles?.length ?? 0) > 0;

    if (hasSubtitles) {
        // Route A: Subtitle-based detection
        console.log('📺 ✔️ Route A: Subtitle-based detection');
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

        return detectWithSubtitles(subtitles, aiClient, aiModel, learnedRules);
    } else {
        // Route B: Danmaku fallback
        console.log('📺 ✔️ Route B: Danmaku fallback (no subtitles)');
        const cid = getCid(response);
        if (!cid) {
            console.error('📺 ❌ Cannot get cid for danmaku API');
            flashWarningAnimation();
            return null;
        }

        return detectWithDanmaku(cid, aiClient, aiModel, learnedRules);
    }
}
