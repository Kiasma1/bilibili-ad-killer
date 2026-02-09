// ============================================================
// Global type declarations for browser APIs and Bilibili page
// ============================================================

// ---- Browser AI (experimental) ----

interface LanguageModel {
    availability(options: {
        languages?: string[]
    }): Promise<'available' | 'unavailable' | 'downloadable' | 'downloading'>;
    create(parameters: {
        monitor?: (m: any) => void,
        initialPrompts?: { role: 'system' | 'user' | 'assistant', content: string }[],
    }): Promise<any>;
}

declare var LanguageModel: LanguageModel;

// ---- Bilibili page globals ----

interface BilibiliVideoData {
    title: string;
    desc: string;
    duration: number;
    bvid: string;
}

interface BilibiliInitialState {
    videoData: BilibiliVideoData;
}

// ---- Window extensions ----

interface Window {
    LanguageModel?: LanguageModel;
    __INITIAL_STATE__: BilibiliInitialState;
}

// ---- XMLHttpRequest extension (used by XHR interceptor) ----

interface XMLHttpRequest {
    _url?: string;
}
