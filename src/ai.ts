import { GoogleGenAI } from '@google/genai';
import { AdTimeRange } from './types';
import { AI_TIMEOUT_MS, CONNECTIVITY_TIMEOUT_MS } from './constants';
import { getVideoIdFromCurrentPage } from './util';
import { showToast, messages } from './toast';
import { MessageType } from './constants';

// ============================================================
// AI ad detection — Gemini and Browser AI integration
// ============================================================

const responseSchema = {
    type: 'OBJECT',
    properties: {
        startTime: { type: 'number', nullable: false },
        endTime: { type: 'number', nullable: false },
    },
    required: ['startTime', 'endTime'],
};

export interface IdentifyAdTimeRangeOptions {
    geminiClient: GoogleGenAI;
    subStr: string;
    aiModel: string;
    videoTitle?: string;
    videoDescription?: string;
}

/** Build the prompt shared by both Browser AI and Gemini AI */
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
