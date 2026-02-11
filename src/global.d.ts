// ============================================================
// Global type declarations for browser APIs and Bilibili page
// ============================================================

// ---- Bilibili page globals ----

/** B 站视频数据结构（来自页面全局变量） */
interface BilibiliVideoData {
    /** 视频标题 */
    title: string;
    /** 视频简介 */
    desc: string;
    /** 视频时长（秒） */
    duration: number;
    /** 视频 BV 号 */
    bvid: string;
    /** 视频 cid（用于弹幕 API） */
    cid?: number;
}

/** B 站页面初始状态，挂载在 window.__INITIAL_STATE__ 上 */
interface BilibiliInitialState {
    /** 当前视频的数据 */
    videoData: BilibiliVideoData;
}

// ---- Window extensions ----

/** 扩展 Window 接口，添加 B 站页面全局属性 */
interface Window {
    /** B 站页面的初始状态数据 */
    __INITIAL_STATE__: BilibiliInitialState;
}

// ---- XMLHttpRequest extension (used by XHR interceptor) ----

/** 扩展 XMLHttpRequest 接口，用于 XHR 拦截器记录请求 URL */
interface XMLHttpRequest {
    /** XHR 拦截器注入的属性，保存请求的 URL */
    _url?: string;
}
