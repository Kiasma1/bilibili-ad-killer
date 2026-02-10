import { GoogleGenAI } from '@google/genai';
import OpenAI from 'openai';
import { AI_TIMEOUT_MS, CONNECTIVITY_TIMEOUT_MS, MessageType } from './constants';
import { messages, showToast } from './toast';
import { AdTimeRange } from './types';
import { getVideoIdFromCurrentPage } from './util';

// ============================================================
// AI ad detection — Gemini, DeepSeek, and Browser AI integration
// ============================================================

/** Provider-agnostic AI 客户端联合类型 */
export type AIClient =
    | { provider: 'gemini'; client: GoogleGenAI }
    | { provider: 'deepseek'; client: OpenAI };

/** Gemini AI 返回的广告时间范围的 JSON Schema 定义（含可选 advertiser） */
const responseSchema = {
    type: 'OBJECT',
    properties: {
        startTime: { type: 'number', nullable: false },
        endTime: { type: 'number', nullable: false },
        advertiser: { type: 'string', nullable: true },
    },
    required: ['startTime', 'endTime'],
};

/** DeepSeek JSON Mode 的 system prompt（必须包含 "json" 字样 + JSON 格式样例） */
const DEEPSEEK_SYSTEM_PROMPT = `你是一个B站视频广告检测专家。你的任务是精准识别视频中嵌入的商业广告片段。

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

/** AI 广告检测的返回结果（含可选 advertiser） */
export interface AdDetectionResult extends AdTimeRange {
    advertiser?: string;
}

/** AI 广告检测的参数选项 */
export interface IdentifyAdTimeRangeOptions {
    /** AI 客户端实例 */
    aiClient: AIClient;
    /** 格式化后的字幕/弹幕字符串 */
    subStr: string;
    /** 使用的 AI 模型名称 */
    aiModel: string;
    /** 视频标题（可选，辅助 AI 判断） */
    videoTitle?: string;
    /** 视频描述（可选，辅助 AI 判断） */
    videoDescription?: string;
    /** 是否为弹幕输入（使用弹幕专用 prompt） */
    isDanmaku?: boolean;
}

/**
 * 构建广告检测的 AI 提示词（Browser AI 和 Gemini AI 共用）
 * @param subtitleStr - 格式化后的字幕字符串
 * @param videoTitle - 视频标题（可选）
 * @param videoDescription - 视频描述（可选）
 * @returns 完整的提示词文本
 */
function buildAdDetectionPrompt(
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
 * 构建弹幕广告检测的 AI 提示词
 * @param danmakuStr - 格式化后的弹幕字符串
 * @param videoTitle - 视频标题（可选）
 * @param videoDescription - 视频描述（可选）
 * @returns 完整的提示词文本
 */
function buildDanmakuAdDetectionPrompt(
    danmakuStr: string,
    videoTitle?: string,
    videoDescription?: string,
): string {
    let prompt = `
    接下来我会分享给你一段视频的弹幕内容（观众实时评论）。
    弹幕格式为：[{时间}s] {弹幕内容}，条目之间由分号（;）隔开。
    弹幕中可能包含观众对广告内容的反应，例如"广告来了"、"恰饭"、"跳过"等。
    请根据弹幕内容判断视频中是否存在广告片段，并给出广告的起止时间。
    如果能识别出广告商名称，请在 advertiser 字段中返回。

    如果存在广告内容，请将广告的起止时间返回给我
    如果不存在广告内容，返回null

    弹幕内容如下：
    ------
    ${danmakuStr}
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
 * 使用浏览器内置 AI 模型检测广告时间段（实验性功能）
 * @param options - 包含字幕、视频信息等参数
 * @returns 检测到的广告时间范围，未检测到返回 undefined
 */
export async function identifyAdTimeRangeByBrowserAI(options: IdentifyAdTimeRangeOptions): Promise<AdTimeRange | undefined> {
    if (!window.LanguageModel || !window.LanguageModel.create) {
        console.error('📺 🤖 ❌ Browser AI not initialized yet, cannot identify ads');
        return undefined;
    }

    const { subStr, videoTitle, videoDescription } = options;
    const finalPrompt = buildAdDetectionPrompt(subStr, videoTitle, videoDescription);

    try {
        const session = await window.LanguageModel.create({
            initialPrompts: [
                { role: 'system', content: '用的作用是识别视频中的广告内容，并返回广告的起止时间。' },
            ],
        });

        const response = await session.prompt([
            { role: 'user', content: finalPrompt },
        ]);

        console.log('📺 🤖 Browser AI response', response);
    } catch (err) {
        console.log('📺 🤖 ❌ Failed to reach Browser AI service, message:', err);
        showToast(messages.aiServiceFailed);
    }
    return undefined;
}

/**
 * 检查 Gemini AI 服务的连通性
 * @param geminiClient - Gemini AI 客户端实例
 * @param aiModel - 使用的模型名称
 * @returns AI 响应文本，连接失败则抛出异常
 */
export async function checkGeminiConnectivity(geminiClient: GoogleGenAI, aiModel: string): Promise<string | undefined> {
    try {
        const response = await geminiClient.models.generateContent({
            model: aiModel,
            config: {
                responseJsonSchema: { type: 'boolean' },
                responseMimeType: 'application/json',
                httpOptions: { timeout: CONNECTIVITY_TIMEOUT_MS },
            },
            contents: 'Hi',
        });
        return response.text;
    } catch (err) {
        console.log('📺 🤖 ❌ Failed to reach AI service, message:', err);
        showToast(messages.aiServiceFailed);
        throw err;
    }
}

/**
 * 使用 Gemini AI 分析字幕/弹幕内容，识别视频中的广告时间段
 * 检测成功后会通过 postMessage 将结果发送给 content script 进行缓存
 * @param options - 包含 AI 客户端、字幕/弹幕、模型名称、视频信息等参数
 * @returns 检测到的广告时间范围（含可选 advertiser），未检测到或出错返回 undefined
 */
async function identifyAdTimeRangeByGeminiAI(options: IdentifyAdTimeRangeOptions): Promise<AdDetectionResult | undefined> {
    const { aiClient, subStr, aiModel, videoTitle, videoDescription, isDanmaku } = options;

    if (aiClient.provider !== 'gemini' || !aiClient.client || !aiModel) {
        console.error('📺 🤖 ❌ AI not initialized yet, cannot identify ads');
        showToast(messages.aiNotInitialized);
        return undefined;
    }

    const finalPrompt = isDanmaku
        ? buildDanmakuAdDetectionPrompt(subStr, videoTitle, videoDescription)
        : buildAdDetectionPrompt(subStr, videoTitle, videoDescription);

    try {
        const response = await aiClient.client.models.generateContent({
            model: aiModel,
            config: {
                responseJsonSchema: responseSchema,
                responseMimeType: 'application/json',
                httpOptions: { timeout: AI_TIMEOUT_MS },
            },
            contents: finalPrompt,
        });

        console.log('📺 🤖 Gemini AI response text', response.text);
        return parseAdDetectionResponse(response.text!);
    } catch (err) {
        console.log('📺 🤖 ❌ Failed to reach Gemini AI service, message:', err);
        showToast(messages.aiServiceFailed);
        return undefined;
    }
}

/**
 * 使用 DeepSeek AI 分析字幕/弹幕内容，识别视频中的广告时间段
 * @param options - 包含 AI 客户端、字幕/弹幕、模型名称、视频信息等参数
 * @returns 检测到的广告时间范围（含可选 advertiser），未检测到或出错返回 undefined
 */
async function identifyAdTimeRangeByDeepSeekAI(options: IdentifyAdTimeRangeOptions): Promise<AdDetectionResult | undefined> {
    const { aiClient, subStr, aiModel, videoTitle, videoDescription, isDanmaku } = options;

    if (aiClient.provider !== 'deepseek' || !aiClient.client || !aiModel) {
        console.error('📺 🤖 ❌ DeepSeek AI not initialized yet, cannot identify ads');
        showToast(messages.aiNotInitialized);
        return undefined;
    }

    const finalPrompt = isDanmaku
        ? buildDanmakuAdDetectionPrompt(subStr, videoTitle, videoDescription)
        : buildAdDetectionPrompt(subStr, videoTitle, videoDescription);

    try {
        const response = await aiClient.client.chat.completions.create({
            model: aiModel,
            response_format: { type: 'json_object' },
            messages: [
                { role: 'system', content: DEEPSEEK_SYSTEM_PROMPT },
                { role: 'user', content: finalPrompt },
            ],
        }, { timeout: AI_TIMEOUT_MS });

        const text = response.choices[0]?.message?.content;
        console.log('📺 🤖 DeepSeek AI response text', text);

        if (!text) {
            console.log('📺 🤖 No response from DeepSeek AI');
            return undefined;
        }

        return parseAdDetectionResponse(text);
    } catch (err) {
        console.log('📺 🤖 ❌ Failed to reach DeepSeek AI service, message:', err);
        showToast(messages.aiServiceFailed);
        return undefined;
    }
}

/**
 * 解析 AI 返回的广告检测 JSON 响应，提取时间范围和广告商信息
 * @param responseText - AI 返回的 JSON 文本
 * @returns 解析后的广告检测结果，无效则返回 undefined
 */
function parseAdDetectionResponse(responseText: string): AdDetectionResult | undefined {
    const targetAdTimeRange = JSON.parse(responseText);
    if (!targetAdTimeRange || !targetAdTimeRange.startTime || !targetAdTimeRange.endTime) {
        console.log('📺 🤖 No ad found');
        return undefined;
    }

    if (targetAdTimeRange.startTime < 0
        || targetAdTimeRange.endTime < 0
        || targetAdTimeRange.startTime >= targetAdTimeRange.endTime) {
        console.log('📺 🤖 Invalid ad time range', targetAdTimeRange);
        return undefined;
    }

    targetAdTimeRange.startTime = parseFloat(targetAdTimeRange.startTime);
    targetAdTimeRange.endTime = parseFloat(targetAdTimeRange.endTime);

    if (typeof window !== 'undefined') {
        const videoId = getVideoIdFromCurrentPage();
        window.postMessage({
            type: MessageType.SAVE_CACHE,
            data: { videoId, ...targetAdTimeRange },
        });
    }

    const result: AdDetectionResult = {
        startTime: targetAdTimeRange.startTime,
        endTime: targetAdTimeRange.endTime,
    };
    if (targetAdTimeRange.advertiser) {
        result.advertiser = targetAdTimeRange.advertiser;
        console.log(`📺 🤖 Advertiser detected: "${targetAdTimeRange.advertiser}"`);
    }
    return result;
}

/**
 * 统一调度函数：根据 AI 客户端类型分发到对应的检测函数
 * @param options - 包含 AI 客户端、字幕/弹幕、模型名称、视频信息等参数
 * @returns 检测到的广告时间范围（含可选 advertiser），未检测到或出错返回 undefined
 */
export async function identifyAdTimeRange(options: IdentifyAdTimeRangeOptions): Promise<AdDetectionResult | undefined> {
    return options.aiClient.provider === 'gemini'
        ? identifyAdTimeRangeByGeminiAI(options)
        : identifyAdTimeRangeByDeepSeekAI(options);
}

/**
 * 检查 DeepSeek AI 服务的连通性
 * @param client - OpenAI 客户端实例
 * @param aiModel - 使用的模型名称
 * @returns 响应文本，连接失败则抛出异常
 */
async function checkDeepSeekConnectivity(client: OpenAI, aiModel: string): Promise<string | undefined> {
    try {
        const response = await client.chat.completions.create({
            model: aiModel,
            messages: [{ role: 'user', content: 'Hi' }],
            max_tokens: 10,
        }, { timeout: CONNECTIVITY_TIMEOUT_MS });
        return response.choices[0]?.message?.content ?? undefined;
    } catch (err) {
        console.log('📺 🤖 ❌ Failed to reach DeepSeek AI service, message:', err);
        showToast(messages.aiServiceFailed);
        throw err;
    }
}

/**
 * 统一 AI 连通性检查：根据客户端类型分发到对应的检查函数
 * @param aiClient - AI 客户端实例
 * @param aiModel - 使用的模型名称
 * @returns 响应文本，连接失败则抛出异常
 */
export async function checkAIConnectivity(aiClient: AIClient, aiModel: string): Promise<string | undefined> {
    return aiClient.provider === 'gemini'
        ? checkGeminiConnectivity(aiClient.client, aiModel)
        : checkDeepSeekConnectivity(aiClient.client, aiModel);
}
