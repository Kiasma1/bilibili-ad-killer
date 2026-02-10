import { BUILTIN_AD_PATTERNS, MAX_LEARNED_RULES, MessageType } from '../constants';
import { LearnedRule } from '../types';

// ============================================================
// Ad filter — local regex pre-screening + self-learning rules
// ============================================================

/**
 * 将自学习规则编译为 RegExp 数组
 * @param rules - 自学习规则列表
 * @returns 编译后的正则数组（无效正则会被跳过）
 */
export function buildRegexFromRules(rules: LearnedRule[]): RegExp[] {
    const result: RegExp[] = [];
    for (const rule of rules) {
        try {
            result.push(new RegExp(rule.pattern));
        } catch {
            console.warn('📺 🔍 Invalid learned rule pattern:', rule.pattern);
        }
    }
    return result;
}

/**
 * 用内置 + 自学习正则扫描文本，返回命中的时间点列表
 * @param texts - 带时间的文本条目（字幕或弹幕）
 * @param learnedRules - 自学习规则列表
 * @returns 命中广告关键词的时间点数组（秒）
 */
export function matchAdByRegex(
    texts: Array<{ time: number; content: string }>,
    learnedRules: LearnedRule[] = []
): number[] {
    const allPatterns = [
        ...BUILTIN_AD_PATTERNS,
        ...buildRegexFromRules(learnedRules),
    ];

    const hitTimes: number[] = [];

    for (const item of texts) {
        for (const pattern of allPatterns) {
            if (pattern.test(item.content)) {
                hitTimes.push(item.time);
                console.log(`📺 🔍 Regex hit: "${item.content}" at ${item.time}s`);
                break;
            }
        }
    }

    return hitTimes;
}

/**
 * 通过 postMessage 请求 content script 保存新的自学习规则
 * @param keyword - 广告商名称
 */
export function saveLearnedRule(keyword: string): void {
    if (!keyword || keyword.trim().length === 0) return;

    const escapedKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    window.postMessage({
        type: MessageType.SAVE_LEARNED_RULE,
        data: {
            keyword: keyword.trim(),
            pattern: escapedKeyword,
            hitCount: 1,
            addedAt: Date.now(),
        },
    });

    console.log(`📺 🔍 Saved learned rule for advertiser: "${keyword}"`);
}

/**
 * 通过 postMessage 请求 content script 发送自学习规则
 */
export function requestLearnedRules(): void {
    window.postMessage({ type: MessageType.REQUEST_LEARNED_RULES }, '*');
}

/**
 * 在 content.ts 中追加新规则到已有规则列表（上限 MAX_LEARNED_RULES）
 * 如果 keyword 已存在，则增加 hitCount
 * @param existingRules - 已有规则列表
 * @param newRule - 新规则
 * @returns 更新后的规则列表
 */
export function appendLearnedRule(
    existingRules: LearnedRule[],
    newRule: LearnedRule
): LearnedRule[] {
    const existing = existingRules.find(r => r.keyword === newRule.keyword);
    if (existing) {
        existing.hitCount += 1;
        return [...existingRules];
    }

    const updated = [...existingRules, newRule];
    if (updated.length > MAX_LEARNED_RULES) {
        updated.sort((a, b) => a.hitCount - b.hitCount);
        updated.shift();
    }
    return updated;
}
