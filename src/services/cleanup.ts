// ============================================================
// CleanupManager — centralized resource tracking and cleanup
// ============================================================

interface TrackedEventListener {
    target: EventTarget;
    type: string;
    listener: EventListener;
}

interface TrackedVideoListener {
    video: HTMLVideoElement;
    type: string;
    listener: EventListener;
}

class CleanupManager {
    private resizeObservers: ResizeObserver[] = [];
    private eventListeners: TrackedEventListener[] = [];
    private videoEventListeners: TrackedVideoListener[] = [];
    private intervals: number[] = [];
    private timeouts: number[] = [];

    trackResizeObserver(observer: ResizeObserver): void {
        this.resizeObservers.push(observer);
    }

    trackEventListener(target: EventTarget, type: string, listener: EventListener): void {
        this.eventListeners.push({ target, type, listener });
    }

    trackVideoEventListener(video: HTMLVideoElement, type: string, listener: EventListener): void {
        this.videoEventListeners.push({ video, type, listener });
    }

    trackInterval(id: number): number {
        this.intervals.push(id);
        return id;
    }

    untrackInterval(id: number): void {
        this.intervals = this.intervals.filter(i => i !== id);
    }

    trackTimeout(id: number): number {
        this.timeouts.push(id);
        return id;
    }

    untrackTimeout(id: number): void {
        this.timeouts = this.timeouts.filter(i => i !== id);
    }

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

export const cleanupManager = new CleanupManager();
