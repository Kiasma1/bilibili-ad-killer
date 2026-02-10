import { FILLER_WORDS, SUBTITLE_MERGE_WINDOW_SECONDS } from '../constants';
import { BilibiliSubtitle } from '../types';

// ============================================================
// Subtitle compressor — merges and deduplicates subtitles
// ============================================================

/**
 * 压缩字幕：按时间窗口合并、过滤语气词、去除相邻重复
 * @param subtitles - 原始字幕数组
 * @returns 压缩后的字幕字符串，格式为 `[0-30s]: 合并文本; [30-60s]: 合并文本`
 */
export function compressSubtitles(subtitles: BilibiliSubtitle[]): string {
    if (!subtitles || subtitles.length === 0) return '';

    // Filter out pure filler-word entries
    const filtered = subtitles.filter(sub => {
        const trimmed = sub.content.trim();
        return trimmed.length > 0 && !FILLER_WORDS.includes(trimmed);
    });

    if (filtered.length === 0) return '';

    // Group by time windows
    const windows: Map<number, string[]> = new Map();

    for (const sub of filtered) {
        const windowIndex = Math.floor(sub.from / SUBTITLE_MERGE_WINDOW_SECONDS);
        if (!windows.has(windowIndex)) {
            windows.set(windowIndex, []);
        }
        windows.get(windowIndex)!.push(sub.content.trim());
    }

    // Build compressed string, deduplicating adjacent content within each window
    const parts: string[] = [];

    const sortedKeys = [...windows.keys()].sort((a, b) => a - b);
    for (const windowIndex of sortedKeys) {
        const startSec = windowIndex * SUBTITLE_MERGE_WINDOW_SECONDS;
        const endSec = startSec + SUBTITLE_MERGE_WINDOW_SECONDS;
        const contents = windows.get(windowIndex)!;

        // Remove adjacent duplicates
        const deduped: string[] = [];
        for (const content of contents) {
            if (deduped.length === 0 || deduped[deduped.length - 1] !== content) {
                deduped.push(content);
            }
        }

        parts.push(`[${startSec}-${endSec}s]: ${deduped.join('，')}`);
    }

    const compressed = parts.join('; ');
    console.log(`📺 🗜️ Subtitle compressed: ${subtitles.length} entries → ${parts.length} windows`);
    return compressed;
}
