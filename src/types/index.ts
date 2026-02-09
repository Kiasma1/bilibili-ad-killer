// ============================================================
// Shared type definitions for the entire project
// ============================================================

/** 单条字幕条目，来自 B 站字幕 API */
export type BilibiliSubtitle = {
    /** 字幕开始时间（秒） */
    from: number;
    /** 字幕结束时间（秒） */
    to: number;
    /** 字幕文本内容 */
    content: string;
}

/** 格式化后的字幕字符串，格式为 [开始时间-结束时间]:内容 */
export type SubtitleString = `[${string}-${string}]:${string}`;

/** 检测到的广告片段的时间范围 */
export type AdTimeRange = {
    /** 广告开始时间（秒） */
    startTime: number;
    /** 广告结束时间（秒） */
    endTime: number;
}

/** 带创建时间戳的广告时间范围缓存条目 */
export type AdCacheEntry = AdTimeRange & {
    /** 缓存创建时间（Unix 时间戳，毫秒） */
    createAt: number;
}

/** 视频 ID 到广告时间范围缓存的映射表 */
export type AdTimeRangeCache = Record<string, AdCacheEntry>;

/** 用户可配置的扩展设置 */
export type UserConfig = {
    /** Gemini API 密钥 */
    apiKey: string;
    /** 使用的 AI 模型名称 */
    aiModel: string;
    /** 是否自动跳过广告 */
    autoSkip: boolean;
    /** 是否忽略时长小于 5 分钟的视频 */
    ignoreVideoLessThan5Minutes: boolean;
    /** 是否忽略时长大于 30 分钟的视频 */
    ignoreVideoMoreThan30Minutes: boolean;
    /** 是否使用浏览器内置 AI 模型 */
    usingBrowserAIModel: boolean;
}

/** B 站播放器 API 响应结构（部分字段） */
export type BilibiliPlayerResponse = {
    data: {
        /** 视频的 BV 号 */
        bvid: string;
        /** 视频标题 */
        name?: string;
        /** 字幕信息 */
        subtitle?: {
            subtitles: Array<{
                /** 字幕语言代码，如 "zh-CN" */
                lan: string;
                /** 字幕语言描述，如 "中文（自动生成）" */
                lan_doc: string;
                /** 字幕类型 */
                type: number;
                /** 字幕文件下载地址 */
                subtitle_url: string;
            }>;
        };
    };
}

/** B 站字幕文件的响应结构 */
export type SubtitleFileResponse = {
    /** 字幕条目数组 */
    body: BilibiliSubtitle[];
}
