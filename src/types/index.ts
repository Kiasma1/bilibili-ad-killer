// ============================================================
// Shared type definitions for the entire project
// ============================================================

/** A single subtitle entry from Bilibili's subtitle API */
export interface Subtitle {
    from: number;
    to: number;
    content: string;
}

/** Formatted subtitle string: [startTime-endTime]:content */
export type SubtitleString = `[${string}-${string}]:${string}`;

/** Time range of a detected ad segment */
export interface AdTimeRange {
    startTime: number;
    endTime: number;
}

/** Cached ad time range with creation timestamp */
export interface AdCacheEntry extends AdTimeRange {
    createAt: number;
}

/** Map of video IDs to their cached ad time ranges */
export interface AdTimeRangeCache {
    [videoId: string]: AdCacheEntry;
}

/** User-configurable settings for the extension */
export interface UserConfig {
    apiKey: string;
    aiModel: string;
    autoSkip: boolean;
    ignoreVideoLessThan5Minutes: boolean;
    ignoreVideoMoreThan30Minutes: boolean;
    usingBrowserAIModel: boolean;
}

/** Bilibili player API response structure (partial) */
export interface BilibiliPlayerResponse {
    data: {
        bvid: string;
        name?: string;
        subtitle?: {
            subtitles: Array<{
                lan: string;
                lan_doc: string;
                type: number;
                subtitle_url: string;
            }>;
        };
    };
}

/** Bilibili subtitle file response */
export interface SubtitleFileResponse {
    body: Subtitle[];
}
