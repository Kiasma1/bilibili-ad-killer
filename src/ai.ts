import OpenAI from 'openai';
import { AI_TIMEOUT_MS, MessageType } from './constants';
import { messages, showToast } from './toast';
import { AdTimeRange } from './types';
import { getVideoIdFromCurrentPage } from './util';

// ============================================================
// AI ad detection — DeepSeek only
// ============================================================

/** DeepSeek JSON Mode 的 system prompt */
const SYSTEM_PROMPT = `你是一个B站视频广告检测专家。你的任务是精准识别视频中嵌入的商业广告片段。

## 广告特征（符合以下任意特征即为广告）
- UP主口播推荐产品/服务/App/游戏（如"感谢XX品牌赞助"、"今天给大家推荐"、"点击下方链接"、"使用我的优惠码"）
- 出现品牌名、产品名、优惠活动、折扣码、下载链接等商业推广内容
- 与视频主题明显无关的内容插入（话题突然转变为推销）
- 弹幕中观众大量吐槽"广告"、"恰饭"、"跳过"、"前方高能（广告）"等

## 非广告内容（不要误判）
- UP主的自我介绍、求关注求三连
- 视频内容本身的讨论，即使提到了某个品牌（如测评视频讨论产品本身）
- 片头片尾的固定栏目

## 判断要点
- 广告通常是一段连续的时间区间，不是零散的单句
- 注意广告的起始点（通常有"话说回来"、"对了"、"顺便说一下"等转折词）和结束点（通常回到正题）
- 如果整个视频都是推广内容，则不算嵌入广告，返回无广告

你必须严格按照以下 json 格式返回结果，不要包含任何其他文字：

如果存在广告内容，返回示例：
{"startTime": 120.5, "endTime": 180.3, "advertiser": "某品牌"}

如果不存在广告内容，返回：
{"startTime": 0, "endTime": 0, "advertiser": null}`;

/** AI 广告检测的返回结果 */
export interface AdDetectionResult extends AdTimeRange {
    advertiser?: string;
}

/** AI 广告检测的参数选项 */
export interface IdentifyAdTimeRangeOptions {
    client: OpenAI;
    subStr: string;
    aiModel: string;
    videoTitle?: string;
    videoDescription?: string;
}

/**
 * 构建广告检测的用户提示词
 */
function buildPrompt(
    subtitleStr: string,
    videoTitle?: string,
    videoDescription?: string,
): string {
    let prompt = `
    接下我会分享给你一段视频字幕，该段字幕由多个字幕语句组成。
    每一句字幕包含三部分内容，分别是起始时间，结束时间，以及字幕内容，格式如下：[{起始时间}-{结束时间}]:{字幕内容}。语句之间由分号（;）隔开。
    帮助我分析其中哪些是与视频无关的广告内容，给出其中连续广告内容起始时间和终止时间。我可能还会分享给你视频的标题以及视频的描述，用于辅助你判断广告内容

    如果存在广告内容，请将广告的起止时间返回给我
    如果不存在广告内容，返回null

    字幕内容如下：
    ------
    ${subtitleStr}
    `;

    if (videoTitle) {
        prompt += `
    ------
    视频标题如下：
    ${videoTitle}
    `;
    }

    if (videoDescription) {
        prompt += `
    ------
    视频描述如下：
    ${videoDescription}
    `;
    }

    return prompt;
}

/**
 * 解析 AI 返回的广告检测 JSON 响应
 * 返回 AdDetectionResult（有广告）或 null（无广告），undefined 表示解析失败
 */
function parseResponse(responseText: string): AdDetectionResult | null | undefined {
    const parsed = JSON.parse(responseText);
    if (!parsed || (parsed.startTime === 0 && parsed.endTime === 0)) {
        console.log('📺 🤖 No ad found');
        return null;
    }

    if (!parsed.startTime || !parsed.endTime) {
        console.log('📺 🤖 No ad found (missing fields)');
        return null;
    }

    if (parsed.startTime < 0 || parsed.endTime < 0 || parsed.startTime >= parsed.endTime) {
        console.log('📺 🤖 Invalid ad time range', parsed);
        return null;
    }

    parsed.startTime = parseFloat(parsed.startTime);
    parsed.endTime = parseFloat(parsed.endTime);

    if (typeof window !== 'undefined') {
        const videoId = getVideoIdFromCurrentPage();
        window.postMessage({
            type: MessageType.SAVE_CACHE,
            data: { videoId, ...parsed },
        });
    }

    const result: AdDetectionResult = {
        startTime: parsed.startTime,
        endTime: parsed.endTime,
    };
    if (parsed.advertiser) {
        result.advertiser = parsed.advertiser;
        console.log(`📺 🤖 Advertiser detected: "${parsed.advertiser}"`);
    }
    return result;
}

/**
 * 使用 DeepSeek AI 分析字幕内容，识别视频中的广告时间段
 * 返回 AdDetectionResult（有广告）、null（无广告）、undefined（请求失败）
 */
export async function identifyAdTimeRange(options: IdentifyAdTimeRangeOptions): Promise<AdDetectionResult | null | undefined> {
    const { client, subStr, aiModel, videoTitle, videoDescription } = options;

    if (!client || !aiModel) {
        console.error('📺 🤖 ❌ AI not initialized');
        showToast(messages.aiNotInitialized);
        return undefined;
    }

    const finalPrompt = buildPrompt(subStr, videoTitle, videoDescription);

    try {
        const response = await client.chat.completions.create({
            model: aiModel,
            response_format: { type: 'json_object' },
            messages: [
                { role: 'system', content: SYSTEM_PROMPT },
                { role: 'user', content: finalPrompt },
            ],
        }, { timeout: AI_TIMEOUT_MS });

        const text = response.choices[0]?.message?.content;
        console.log('📺 🤖 DeepSeek AI response text', text);

        if (!text) {
            console.log('📺 🤖 No response from AI');
            return undefined;
        }

        return parseResponse(text);
    } catch (err) {
        console.log('📺 🤖 ❌ Failed to reach AI service, message:', err);
        showToast(messages.aiServiceFailed);
        return undefined;
    }
}
