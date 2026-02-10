import { BILIBILI_DANMAKU_API, DANMAKU_WINDOW_SECONDS } from '../constants';
import { Danmaku } from '../types';

// ============================================================
// Danmaku service — fetch and parse Bilibili danmaku (barrage)
// ============================================================

/**
 * 从 B 站弹幕 XML API 获取弹幕列表
 * @param cid - 视频的 cid
 * @returns 弹幕数组，失败返回空数组
 */
export async function fetchDanmaku(cid: number): Promise<Danmaku[]> {
    try {
        const url = `${BILIBILI_DANMAKU_API}?oid=${cid}`;
        console.log(`📺 💬 Fetching danmaku: ${url}`);

        const response = await fetch(url);
        if (!response.ok) {
            console.error(`📺 💬 ❌ Danmaku API returned ${response.status}`);
            return [];
        }

        const text = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(text, 'text/xml');
        const dElements = doc.querySelectorAll('d');

        const danmakuList: Danmaku[] = [];
        dElements.forEach((el) => {
            const pAttr = el.getAttribute('p');
            const content = el.textContent;
            if (!pAttr || !content) return;

            // p attribute format: "time,type,fontSize,color,timestamp,pool,userId,rowId"
            const time = parseFloat(pAttr.split(',')[0]);
            if (!isNaN(time)) {
                danmakuList.push({ time, content: content.trim() });
            }
        });

        console.log(`📺 💬 Fetched ${danmakuList.length} danmaku entries`);
        return danmakuList;
    } catch (error) {
        console.error('📺 💬 ❌ Failed to fetch danmaku:', error);
        return [];
    }
}

/**
 * 提取命中时间点前后 N 秒窗口内的弹幕
 * @param danmakuList - 全部弹幕列表
 * @param hitTimes - 正则命中的时间点数组（秒）
 * @param windowSeconds - 窗口大小（秒），默认 DANMAKU_WINDOW_SECONDS
 * @returns 窗口内的弹幕子集
 */
export function extractDanmakuWindow(
    danmakuList: Danmaku[],
    hitTimes: number[],
    windowSeconds: number = DANMAKU_WINDOW_SECONDS
): Danmaku[] {
    if (hitTimes.length === 0) return [];

    const result: Danmaku[] = [];
    const seen = new Set<number>();

    for (const hitTime of hitTimes) {
        const windowStart = Math.max(0, hitTime - windowSeconds);
        const windowEnd = hitTime + windowSeconds;

        for (let i = 0; i < danmakuList.length; i++) {
            if (seen.has(i)) continue;
            const d = danmakuList[i];
            if (d.time >= windowStart && d.time <= windowEnd) {
                result.push(d);
                seen.add(i);
            }
        }
    }

    result.sort((a, b) => a.time - b.time);
    console.log(`📺 💬 Extracted ${result.length} danmaku in window around ${hitTimes.length} hit(s)`);
    return result;
}

/**
 * 将弹幕列表格式化为 AI 可读的字符串
 * @param danmakuList - 弹幕列表
 * @returns 格式化字符串，如 `[120s] 内容; [121s] 内容`
 */
export function formatDanmakuForAI(danmakuList: Danmaku[]): string {
    return danmakuList
        .map(d => `[${Math.round(d.time)}s] ${d.content}`)
        .join('; ');
}
