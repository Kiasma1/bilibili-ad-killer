import { URL_POLL_INTERVAL_MS } from '../constants';
import { getVideoIdFromCurrentPage } from '../util';

// ============================================================
// URL Monitor — detects SPA navigation between Bilibili videos
// ============================================================

type OnVideoChanged = (newVideoId: string) => void;

export function startUrlMonitor(onVideoChanged: OnVideoChanged): void {
    let currentVideoId = getVideoIdFromCurrentPage();

    if (currentVideoId) {
        console.log('📺 ✔️ Initial video ID:', currentVideoId);
    }

    setInterval(() => {
        if (!window.location.pathname.startsWith('/video/')) {
            return;
        }

        const newVideoId = getVideoIdFromCurrentPage();

        if (!newVideoId || newVideoId === currentVideoId) {
            return;
        }

        console.log('📺 🔄 URL changed:', currentVideoId, '→', newVideoId);
        currentVideoId = newVideoId;
        onVideoChanged(newVideoId);
    }, URL_POLL_INTERVAL_MS);

    console.log('📺 ✔️ URL monitoring active');
}
