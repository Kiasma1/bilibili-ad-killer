import { CONTEXT_WINDOW_S } from '../constants';
import { BilibiliSubtitle, UserKeyword } from '../types';

// ============================================================
// Keyword filter — regex pre-screening for ad detection
// ============================================================

/** 内置广告敏感词库 */
export const BUILTIN_KEYWORDS: string[] = [
    '感谢', '赞助', '链接', '下单', '折扣', '领券',
    '金主爸爸', '点击下方', '简介区', '防不胜防',
    '恰饭', '推广', '广告', '甚至还有',
];

/** 正则预筛的返回结果 */
export interface FilterResult {
    /** 是否命中关键词 */
    hit: boolean;
    /** 命中时截取的上下文窗口字幕 */
    contextSubtitles?: BilibiliSubtitle[];
    /** 命中的关键词列表 */
    hitKeywords: string[];
}

/** 缓存编译后的正则和对应的关键词指纹 */
let cachedRegex: RegExp | null = null;
let cachedKeywordsFingerprint = '';

/**
 * 获取或编译关键词正则（关键词不变时复用缓存）
 */
function getKeywordRegex(allKeywords: string[]): RegExp | null {
    if (allKeywords.length === 0) return null;
    const fingerprint = allKeywords.join('|');
    if (cachedRegex && fingerprint === cachedKeywordsFingerprint) {
        return cachedRegex;
    }
    const escaped = allKeywords.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    cachedRegex = new RegExp(escaped.join('|'), 'i');
    cachedKeywordsFingerprint = fingerprint;
    return cachedRegex;
}

/**
 * 对字幕进行正则预筛，命中时截取上下文窗口
 */
export function filterSubtitles(
    subtitles: BilibiliSubtitle[],
    userKeywords: UserKeyword[],
    disabledBuiltinKeywords: string[] = [],
): FilterResult {
    const activeBuiltin = BUILTIN_KEYWORDS.filter(k => !disabledBuiltinKeywords.includes(k));
    const allKeywords = [
        ...activeBuiltin,
        ...userKeywords.map(k => k.keyword),
    ];

    const regex = getKeywordRegex(allKeywords);
    if (!regex) {
        return { hit: false, hitKeywords: [] };
    }

    // 遍历字幕，记录命中的关键词和时间点
    const hitKeywords: string[] = [];
    let firstHitTime: number | null = null;

    for (const sub of subtitles) {
        const match = sub.content.match(regex);
        if (match) {
            const matched = match[0];
            if (!hitKeywords.includes(matched)) {
                hitKeywords.push(matched);
            }
            if (firstHitTime === null) {
                firstHitTime = sub.from;
            }
        }
    }

    // 未命中
    if (firstHitTime === null) {
        return { hit: false, hitKeywords: [] };
    }

    // 命中：截取 [firstHitTime - CONTEXT_WINDOW_S, firstHitTime + CONTEXT_WINDOW_S]
    const windowStart = firstHitTime - CONTEXT_WINDOW_S;
    const windowEnd = firstHitTime + CONTEXT_WINDOW_S;

    const contextSubtitles = subtitles.filter(
        sub => sub.from >= windowStart && sub.to <= windowEnd
    );

    console.log(
        `📺 🔍 Regex hit: [${hitKeywords.join(', ')}] at ${firstHitTime}s, ` +
        `context window: ${contextSubtitles.length}/${subtitles.length} subtitles`
    );

    return { hit: true, contextSubtitles, hitKeywords };
}
