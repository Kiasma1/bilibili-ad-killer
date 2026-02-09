// ============================================================
// CleanupManager — centralized resource tracking and cleanup
// ============================================================

/** 被追踪的 DOM 事件监听器信息 */
interface TrackedEventListener {
    /** 事件目标元素 */
    target: EventTarget;
    /** 事件类型（如 'click'、'resize'） */
    type: string;
    /** 事件回调函数 */
    listener: EventListener;
}

/** 被追踪的视频元素事件监听器信息 */
interface TrackedVideoListener {
    /** 视频元素 */
    video: HTMLVideoElement;
    /** 事件类型（如 'timeupdate'） */
    type: string;
    /** 事件回调函数 */
    listener: EventListener;
}

/**
 * 资源清理管理器 — 集中追踪和清理所有需要手动释放的资源
 * 包括：ResizeObserver、事件监听器、定时器等
 */
class CleanupManager {
    private resizeObservers: ResizeObserver[] = [];
    private eventListeners: TrackedEventListener[] = [];
    private videoEventListeners: TrackedVideoListener[] = [];
    private intervals: number[] = [];
    private timeouts: number[] = [];

    /**
     * 追踪一个 ResizeObserver，以便后续统一断开
     * @param observer - 要追踪的 ResizeObserver 实例
     */
    trackResizeObserver(observer: ResizeObserver): void {
        this.resizeObservers.push(observer);
    }

    /**
     * 追踪一个 DOM 事件监听器，以便后续统一移除
     * @param target - 事件目标
     * @param type - 事件类型
     * @param listener - 事件回调
     */
    trackEventListener(target: EventTarget, type: string, listener: EventListener): void {
        this.eventListeners.push({ target, type, listener });
    }

    /**
     * 追踪一个视频元素的事件监听器
     * @param video - 视频元素
     * @param type - 事件类型
     * @param listener - 事件回调
     */
    trackVideoEventListener(video: HTMLVideoElement, type: string, listener: EventListener): void {
        this.videoEventListeners.push({ video, type, listener });
    }

    /**
     * 追踪一个 setInterval 定时器
     * @param id - setInterval 返回的定时器 ID
     * @returns 传入的定时器 ID（方便链式调用）
     */
    trackInterval(id: number): number {
        this.intervals.push(id);
        return id;
    }

    /**
     * 取消追踪一个 setInterval 定时器（手动清除时调用）
     * @param id - 要取消追踪的定时器 ID
     */
    untrackInterval(id: number): void {
        this.intervals = this.intervals.filter(i => i !== id);
    }

    /**
     * 追踪一个 setTimeout 定时器
     * @param id - setTimeout 返回的定时器 ID
     * @returns 传入的定时器 ID（方便链式调用）
     */
    trackTimeout(id: number): number {
        this.timeouts.push(id);
        return id;
    }

    /**
     * 取消追踪一个 setTimeout 定时器（手动清除时调用）
     * @param id - 要取消追踪的定时器 ID
     */
    untrackTimeout(id: number): void {
        this.timeouts = this.timeouts.filter(i => i !== id);
    }

    /**
     * 清理所有被追踪的资源：断开 Observer、移除事件监听、清除定时器
     */
    cleanupAll(): void {
        console.log('📺 🧹 Starting cleanup of all elements and listeners...');

        this.resizeObservers.forEach(observer => {
            observer.disconnect();
        });
        this.resizeObservers = [];

        this.eventListeners.forEach(({ target, type, listener }) => {
            target.removeEventListener(type, listener);
        });
        this.eventListeners = [];

        this.videoEventListeners.forEach(({ video, type, listener }) => {
            video.removeEventListener(type, listener);
        });
        this.videoEventListeners = [];

        this.intervals.forEach(id => clearInterval(id));
        this.intervals = [];

        this.timeouts.forEach(id => clearTimeout(id));
        this.timeouts = [];

        console.log('📺 🧹 ✔️ Cleanup completed');
    }
}

/** 全局唯一的清理管理器实例 */
export const cleanupManager = new CleanupManager();
