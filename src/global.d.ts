// ============================================================
// Global type declarations for browser APIs and Bilibili page
// ============================================================

// ---- Browser AI (experimental) ----

/** 浏览器内置 AI 语言模型接口（实验性 API） */
interface LanguageModel {
    /**
     * 检查模型的可用状态
     * @param options - 可选的语言过滤条件
     * @returns 返回模型状态：available（可用）、unavailable（不可用）、downloadable（可下载）、downloading（下载中）
     */
    availability(options: {
        languages?: string[]
    }): Promise<'available' | 'unavailable' | 'downloadable' | 'downloading'>;
    /**
     * 创建一个语言模型会话
     * @param parameters - 创建参数，包含下载进度监听器和初始提示词
     * @returns 返回模型会话实例
     */
    create(parameters: {
        monitor?: (m: any) => void,
        initialPrompts?: { role: 'system' | 'user' | 'assistant', content: string }[],
    }): Promise<any>;
}

declare var LanguageModel: LanguageModel;

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

/** 扩展 Window 接口，添加 B 站页面和浏览器 AI 的全局属性 */
interface Window {
    /** 浏览器内置 AI 语言模型（可选，实验性） */
    LanguageModel?: LanguageModel;
    /** B 站页面的初始状态数据 */
    __INITIAL_STATE__: BilibiliInitialState;
}

// ---- XMLHttpRequest extension (used by XHR interceptor) ----

/** 扩展 XMLHttpRequest 接口，用于 XHR 拦截器记录请求 URL */
interface XMLHttpRequest {
    /** XHR 拦截器注入的属性，保存请求的 URL */
    _url?: string;
}
