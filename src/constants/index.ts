// ============================================================
// Named constants — replaces all magic numbers and strings
// ============================================================

/** Message types for postMessage communication between content script and inject script */
export enum MessageType {
    READY = 'BILIBILI_AD_SKIP_READY',
    CONFIG = 'BILIBILI_AD_SKIP_CONFIG',
    TOASTIFY_LOADED = 'TOASTIFY_LOADED',
    REQUEST_CACHE = 'REQUEST_VIDEO_AD_TIMERANGE',
    SEND_CACHE = 'SEND_VIDEO_AD_TIMERANGE',
    SAVE_CACHE = 'SAVE_VIDEO_AD_TIMERANGE',
}

// ---- Timing constants (milliseconds unless noted) ----

/** How long cached ad time ranges are kept (3 days) */
export const CACHE_TTL_MS = 3 * 24 * 60 * 60 * 1000;

/** Interval for polling URL changes in SPA navigation */
export const URL_POLL_INTERVAL_MS = 300;

/** Interval for polling until <video> element appears */
export const VIDEO_ELEMENT_POLL_MS = 500;

/** Interval for polling until video.readyState >= 2 */
export const VIDEO_READY_POLL_MS = 100;

/** Retry delay when progress bar wrapper is not found */
export const PROGRESS_WRAP_RETRY_MS = 200;

/** Debounce delay for resize event handlers */
export const RESIZE_DEBOUNCE_MS = 100;

/** Duration to show warning animation (ms) */
export const WARNING_DISPLAY_MS = 3000;

/** Seconds before ad start to show skip animation */
export const ANIMATION_LEAD_TIME_S = 3;

/** Videos shorter than this (seconds) are skipped */
export const MIN_VIDEO_DURATION_S = 5 * 60;

/** Timeout for Gemini AI ad detection requests */
export const AI_TIMEOUT_MS = 60 * 1000;

/** Timeout for Gemini connectivity check */
export const CONNECTIVITY_TIMEOUT_MS = 15 * 1000;

/** How long toast notifications are displayed */
export const TOAST_DURATION_MS = 3000;

// ---- DOM selectors ----

export const SELECTORS = {
    PROGRESS_BAR: '.bpx-player-progress-schedule',
    PLAYER_CONTAINER: '.bpx-player-container',
    PLAYER_WRAP_ID: 'bilibili-player',
    VIDEO: 'video',
} as const;

// ---- CSS class names ----

export const CSS_CLASSES = {
    AD_BAR: 'bilibili-ad-bar',
    SKIP_ANIMATION: 'bilibili-skip-animation',
    THINKING_ANIMATION: 'bilibili-thinking-animation',
    WARNING_ANIMATION: 'bilibili-warning-animation',
} as const;

// ---- External APIs ----

/** Bilibili player API endpoint (matched in XHR interceptor) */
export const BILIBILI_PLAYER_API = 'api.bilibili.com/x/player/wbi/v2';

// ---- Chrome storage keys ----

export const STORAGE_KEYS = {
    AD_TIME_RANGE_CACHE: 'AD_TIME_RANGE_CACHE',
} as const;
