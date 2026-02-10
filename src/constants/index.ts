// ============================================================
// Named constants — replaces all magic numbers and strings
// ============================================================

/** content script 与 inject script 之间通过 postMessage 通信的消息类型枚举 */
export enum MessageType {
    /** inject script 已就绪，请求配置 */
    READY = 'BILIBILI_AD_SKIP_READY',
    /** content script 发送用户配置 */
    CONFIG = 'BILIBILI_AD_SKIP_CONFIG',
    /** Toast 通知库已加载完成 */
    TOASTIFY_LOADED = 'TOASTIFY_LOADED',
    /** inject script 请求广告时间范围缓存 */
    REQUEST_CACHE = 'REQUEST_VIDEO_AD_TIMERANGE',
    /** content script 发送广告时间范围缓存 */
    SEND_CACHE = 'SEND_VIDEO_AD_TIMERANGE',
    /** inject script 请求保存广告时间范围到缓存 */
    SAVE_CACHE = 'SAVE_VIDEO_AD_TIMERANGE',
    /** background 检测到 URL 变化，通知 inject script 视频已切换 */
    URL_CHANGED = 'BILIBILI_AD_SKIP_URL_CHANGED',
}

// ---- Timing constants (milliseconds unless noted) ----

/** 广告时间范围缓存的有效期（3 天，单位：毫秒） */
export const CACHE_TTL_MS = 3 * 24 * 60 * 60 * 1000;

/** SPA 页面导航时轮询 URL 变化的间隔（毫秒） */
export const URL_POLL_INTERVAL_MS = 300;

/** 轮询等待 <video> 元素出现的间隔（毫秒） */
export const VIDEO_ELEMENT_POLL_MS = 500;

/** 轮询等待视频 readyState >= 2（可播放）的间隔（毫秒） */
export const VIDEO_READY_POLL_MS = 100;

/** 未找到进度条容器时的重试延迟（毫秒） */
export const PROGRESS_WRAP_RETRY_MS = 200;

/** 窗口 resize 事件的防抖延迟（毫秒） */
export const RESIZE_DEBOUNCE_MS = 100;

/** 警告动画的显示时长（毫秒） */
export const WARNING_DISPLAY_MS = 3000;

/** 广告开始前提前显示跳过动画的时间（秒） */
export const ANIMATION_LEAD_TIME_S = 3;

/** 短于此时长的视频将被忽略（秒，即 5 分钟） */
export const MIN_VIDEO_DURATION_S = 5 * 60;

/** Gemini AI 广告检测请求的超时时间（毫秒） */
export const AI_TIMEOUT_MS = 60 * 1000;

/** Gemini 连通性检查的超时时间（毫秒） */
export const CONNECTIVITY_TIMEOUT_MS = 15 * 1000;

/** Toast 通知的显示时长（毫秒） */
export const TOAST_DURATION_MS = 3000;

// ---- DOM selectors ----

/** B 站播放器相关的 DOM 选择器 */
export const SELECTORS = {
    /** 播放器进度条 */
    PROGRESS_BAR: '.bpx-player-progress-schedule',
    /** 播放器外层容器 */
    PLAYER_CONTAINER: '.bpx-player-container',
    /** 播放器包裹元素的 ID */
    PLAYER_WRAP_ID: 'bilibili-player',
    /** video 标签 */
    VIDEO: 'video',
} as const;

// ---- CSS class names ----

/** 扩展使用的 CSS 类名 */
export const CSS_CLASSES = {
    /** 广告时间段标记条 */
    AD_BAR: 'bilibili-ad-bar',
    /** 跳过广告动画 */
    SKIP_ANIMATION: 'bilibili-skip-animation',
    /** AI 思考中动画 */
    THINKING_ANIMATION: 'bilibili-thinking-animation',
    /** 广告警告动画 */
    WARNING_ANIMATION: 'bilibili-warning-animation',
} as const;

// ---- External APIs ----

/** B 站播放器 API 端点（XHR 拦截器匹配用） */
export const BILIBILI_PLAYER_API = 'api.bilibili.com/x/player/wbi/v2';

// ---- Chrome storage keys ----

/** Chrome 本地存储使用的键名 */
export const STORAGE_KEYS = {
    /** 广告时间范围缓存的存储键 */
    AD_TIME_RANGE_CACHE: 'AD_TIME_RANGE_CACHE',
} as const;
