import { GoogleGenAI } from '@google/genai';
import { AdTimeRange } from './types';
import { AI_TIMEOUT_MS, CONNECTIVITY_TIMEOUT_MS } from './constants';
import { getVideoIdFromCurrentPage } from './util';
import { showToast, messages } from './toast';
import { MessageType } from './constants';

// ============================================================
// AI ad detection — Gemini and Browser AI integration
// ============================================================

/** Gemini AI 返回的广告时间范围的 JSON Schema 定义 */
const responseSchema = {
    type: 'OBJECT',
    properties: {
        startTime: { type: 'number', nullable: false },
        endTime: { type: 'number', nullable: false },
    },
    required: ['startTime', 'endTime'],
};

/** AI 广告检测的参数选项 */
export interface IdentifyAdTimeRangeOptions {
    /** Gemini AI 客户端实例 */
    geminiClient: GoogleGenAI;
    /** 格式化后的字幕字符串 */
    subStr: string;
    /** 使用的 AI 模型名称 */
    aiModel: string;
    /** 视频标题（可选，辅助 AI 判断） */
    videoTitle?: string;
    /** 视频描述（可选，辅助 AI 判断） */
    videoDescription?: string;
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
    videoDescription?: string
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
 * 使用浏览器内置 AI 模型检测广告时间段（实验性功能）
 * @param options - 包含字幕、视频信息等参数
 * @returns 检测到的广告时间范围，未检测到返回 undefined
 */
export async function identifyAdTimeRangeByBrowserAI(options: IdentifyAdTimeRangeOptions): Promise<AdTimeRange | undefined> {
    if (!window.LanguageModel || !window.LanguageModel.create) {
        console.error('📺 🤖 ❌ Browser AI not initialized yet, cannot identify ads');
        return null;
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
 * 使用 Gemini AI 分析字幕内容，识别视频中的广告时间段
 * 检测成功后会通过 postMessage 将结果发送给 content script 进行缓存
 * @param options - 包含 Gemini 客户端、字幕、模型名称、视频信息等参数
 * @returns 检测到的广告时间范围，未检测到或出错返回 null/undefined
 */
export async function identifyAdTimeRangeByGeminiAI(options: IdentifyAdTimeRangeOptions): Promise<AdTimeRange | undefined> {
    const { geminiClient, subStr, aiModel, videoTitle, videoDescription } = options;

    if (!geminiClient || !aiModel) {
        console.error('📺 🤖 ❌ AI not initialized yet, cannot identify ads');
        showToast(messages.aiNotInitialized);
        return null;
    }

    const finalPrompt = buildAdDetectionPrompt(subStr, videoTitle, videoDescription);

    try {
        const response = await geminiClient.models.generateContent({
            model: aiModel,
            config: {
                responseJsonSchema: responseSchema,
                responseMimeType: 'application/json',
                httpOptions: { timeout: AI_TIMEOUT_MS },
            },
            contents: finalPrompt,
        });

        console.log('📺 🤖 AI response text', response.text);

        const targetAdTimeRange = JSON.parse(response.text!);
        if (!targetAdTimeRange || !targetAdTimeRange.startTime || !targetAdTimeRange.endTime) {
            console.log('📺 🤖 No ad found');
            return null;
        }

        if (targetAdTimeRange.startTime < 0
            || targetAdTimeRange.endTime < 0
            || targetAdTimeRange.startTime >= targetAdTimeRange.endTime) {
            console.log('📺 🤖 Invalid ad time range', targetAdTimeRange);
            return null;
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
        return targetAdTimeRange;
    } catch (err) {
        console.log('📺 🤖 ❌ Failed to reach AI service, message:', err);
        showToast(messages.aiServiceFailed);
        return null;
    }
}
