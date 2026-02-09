import { BILIBILI_PLAYER_API } from '../constants';

// ============================================================
// XHR Interceptor — monkey-patches XMLHttpRequest to detect
// Bilibili player API calls and trigger a callback on response
// ============================================================

type OnPlayerApiResponse = (responseText: string) => void;

export function installXhrInterceptor(onPlayerApiResponse: OnPlayerApiResponse): void {
    const originalOpen = XMLHttpRequest.prototype.open;
    const originalSend = XMLHttpRequest.prototype.send;

    XMLHttpRequest.prototype.open = function (method: string, url: string | URL, ...args: any[]) {
        this._url = url.toString();
        return originalOpen.call(this, method, url, ...args);
    };

    XMLHttpRequest.prototype.send = function (...args: any[]) {
        const url = this._url;

        const isVideoPage = window.location.pathname.startsWith('/video/');
        const isPlayerApi = url && url.includes(BILIBILI_PLAYER_API);

        if (isVideoPage && isPlayerApi) {
            console.log('📺 ✔️ Detected player API request');

            this.addEventListener('load', function () {
                if (this.status !== 200) {
                    console.error('📺 ❌ Player API request failed:', this.status);
                    return;
                }
                onPlayerApiResponse(this.responseText);
            });
        }

        return originalSend.call(this, ...args);
    };

    console.log('📺 ✔️ XHR interception active');
}
