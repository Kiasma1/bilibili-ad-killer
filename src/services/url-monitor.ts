import { URL_POLL_INTERVAL_MS } from '../constants';
import { getVideoIdFromCurrentPage } from '../util';

// ============================================================
// URL Monitor — detects SPA navigation between Bilibili videos
// ============================================================

/** 视频切换时的回调函数类型 */
type OnVideoChanged = (newVideoId: string) => void;

/**
 * 启动 URL 轮询监控，检测 B 站 SPA 页面内的视频切换
 * 通过定时比较当前 URL 中的视频 ID 来判断是否发生了导航
 * @param onVideoChanged - 检测到新视频时触发的回调，参数为新的视频 BV 号
 */
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
