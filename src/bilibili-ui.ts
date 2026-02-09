import {
    initializeAdBarStyle,
    getAnimationStyleContent,
    ALL_ANIMATIONS,
    skipAnimation,
    AnimationConfig,
} from './style';
import { config } from './config';
import { cleanupManager } from './services/cleanup';
import {
    SELECTORS,
    CSS_CLASSES,
    RESIZE_DEBOUNCE_MS,
    VIDEO_ELEMENT_POLL_MS,
    VIDEO_READY_POLL_MS,
    PROGRESS_WRAP_RETRY_MS,
    ANIMATION_LEAD_TIME_S,
} from './constants';

// ============================================================
// Bilibili UI — ad bar rendering, animations, auto-skip
// ============================================================

/** 当前显示的公共动画元素（思考中/警告等） */
let commonAnimationElement: HTMLElement | null = null;

// ---- Animation style injection ----

/**
 * 将所有动画的 CSS 样式注入到页面 <head> 中
 * 每种动画只注入一次，通过 style 元素的 id 去重
 */
export function injectAnimationStyles(): void {
    for (const anim of ALL_ANIMATIONS) {
        const styleId = `${anim.name}-styles`;
        if (!document.getElementById(styleId)) {
            const style = document.createElement('style');
            style.id = styleId;
            style.textContent = getAnimationStyleContent(anim);
            document.head.appendChild(style);
            console.log(`📺 ✔️ ${anim.name} animation styles injected`);
        }
    }
}

// ---- Animation management ----

/**
 * 在播放器上添加指定的动画效果（如思考中、警告等）
 * 同一时间只显示一个动画，新动画会替换旧的
 * @param targetAnimationClass - 要添加的动画 CSS 类名
 */
export function addAnimation(targetAnimationClass: string): void {
    injectAnimationStyles();

    const playerWrap = document.getElementById(SELECTORS.PLAYER_WRAP_ID) as HTMLElement;
    if (!playerWrap) {
        console.error('📺 ❌ Player wrap not found');
        return;
    }

    if (commonAnimationElement) {
        commonAnimationElement.remove();
        commonAnimationElement = null;
    }

    commonAnimationElement = document.createElement('div');
    commonAnimationElement.classList.add(targetAnimationClass);
    playerWrap.appendChild(commonAnimationElement);
    console.log(`📺 ✨ ${targetAnimationClass} added`);
}

/** 移除当前显示的公共动画元素 */
export function removeAnimation(): void {
    if (commonAnimationElement) {
        commonAnimationElement.remove();
        commonAnimationElement = null;
        console.log('📺 ✨ Common animation removed');
    }
}

// ---- Ad bar position calculation ----

/**
 * 计算广告标记条在进度条上的位置和宽度
 * @param adStartSeconds - 广告开始时间（秒）
 * @param adEndSeconds - 广告结束时间（秒）
 * @param videoDuration - 视频总时长（秒）
 * @param progressBarWidth - 进度条的像素宽度
 * @returns 标记条的 left 偏移和 width（像素）
 */
function calculateAdBarPosition(
    adStartSeconds: number,
    adEndSeconds: number,
    videoDuration: number,
    progressBarWidth: number
): { left: number; width: number } {
    if (videoDuration <= 0) {
        throw Error('Video duration is not valid');
    }
    if (progressBarWidth <= 0) {
        throw Error('Progress bar width is not valid');
    }

    const startTime = Math.max(0, Math.min(adStartSeconds, videoDuration));
    const endTime = Math.max(startTime, Math.min(adEndSeconds, videoDuration));

    const left = (startTime / videoDuration) * progressBarWidth;
    const width = ((endTime - startTime) / videoDuration) * progressBarWidth;

    return { left, width };
}

// ---- Ad bar creation and update ----

/**
 * 更新所有已存在的广告标记条的位置和宽度（窗口 resize 时调用）
 * @param adStartSeconds - 广告开始时间（秒）
 * @param adEndSeconds - 广告结束时间（秒）
 */
function updateAdBarStyles(adStartSeconds: number, adEndSeconds: number): void {
    const adBars = Array.from(document.querySelectorAll(`.${CSS_CLASSES.AD_BAR}`)) as HTMLElement[];
    if (!adBars?.length) return;

    const progressWraps = Array.from(document.querySelectorAll(SELECTORS.PROGRESS_BAR)) as HTMLElement[];
    const video = document.querySelector(SELECTORS.VIDEO) as HTMLVideoElement;
    if (!progressWraps?.length || !video || !video.duration) return;

    for (const progressWrap of progressWraps) {
        const { left, width } = calculateAdBarPosition(
            adStartSeconds, adEndSeconds, video.duration, progressWrap.offsetWidth
        );
        const adBar = progressWrap.querySelector(`.${CSS_CLASSES.AD_BAR}`) as HTMLElement;
        if (adBar) {
            adBar.style.left = `${left}px`;
            adBar.style.width = `${width}px`;
        }
    }
}

/**
 * 在单个进度条元素上创建广告标记条
 * @param progressWrap - 进度条 DOM 元素
 * @param adStartSeconds - 广告开始时间（秒）
 * @param adEndSeconds - 广告结束时间（秒）
 * @param videoDuration - 视频总时长（秒）
 */
function createIndividualAdBar(
    progressWrap: HTMLElement,
    adStartSeconds: number,
    adEndSeconds: number,
    videoDuration: number
): void {
    const { left, width } = calculateAdBarPosition(
        adStartSeconds, adEndSeconds, videoDuration, progressWrap.offsetWidth
    );

    const existingAdBar = progressWrap.querySelector(`.${CSS_CLASSES.AD_BAR}`);
    if (existingAdBar) existingAdBar.remove();

    const adBar = document.createElement('div');
    adBar.className = CSS_CLASSES.AD_BAR;
    adBar.style.cssText = initializeAdBarStyle(left, width);

    const parentStyle = window.getComputedStyle(progressWrap);
    if (parentStyle.position === 'static') {
        progressWrap.style.position = 'relative';
    }

    progressWrap.appendChild(adBar);
    console.log(`📺 ✔️ Ad bar created: ${adStartSeconds}s - ${adEndSeconds}s (${left.toFixed(2)}px, ${width.toFixed(2)}px)`);
}

/**
 * 在所有进度条上创建广告标记条
 * @param adStartSeconds - 广告开始时间（秒）
 * @param adEndSeconds - 广告结束时间（秒）
 */
function createAdBar(adStartSeconds: number, adEndSeconds: number): void {
    const progressWraps = Array.from(document.querySelectorAll(SELECTORS.PROGRESS_BAR)) as HTMLElement[];
    if (!progressWraps?.length) {
        console.error('📺 ❌ Progress bar not found');
        return;
    }

    const video = document.querySelector(SELECTORS.VIDEO) as HTMLVideoElement;
    if (!video || !video.duration) {
        console.error('📺 ❌ Video element or duration not found');
        return;
    }

    for (const progressWrap of progressWraps) {
        createIndividualAdBar(progressWrap, adStartSeconds, adEndSeconds, video.duration);
    }
}

// ---- Resize handling ----

/**
 * 设置广告标记条的 resize 响应处理器
 * 监听窗口 resize 和进度条/播放器容器的尺寸变化，自动更新标记条位置
 * @param adStartSeconds - 广告开始时间（秒）
 * @param adEndSeconds - 广告结束时间（秒）
 */
function setupAdBarResizeHandlers(adStartSeconds: number, adEndSeconds: number): void {
    let resizeTimeout: number | null = null;

    const handleResize = () => {
        if (resizeTimeout) {
            clearTimeout(resizeTimeout);
            cleanupManager.untrackTimeout(resizeTimeout);
        }
        resizeTimeout = window.setTimeout(() => {
            updateAdBarStyles(adStartSeconds, adEndSeconds);
        }, RESIZE_DEBOUNCE_MS);
        cleanupManager.trackTimeout(resizeTimeout);
    };

    window.addEventListener('resize', handleResize);
    cleanupManager.trackEventListener(window, 'resize', handleResize as EventListener);

    const progressWrap = document.querySelector(SELECTORS.PROGRESS_BAR);
    if (progressWrap) {
        const resizeObserver = new ResizeObserver(() => handleResize());
        resizeObserver.observe(progressWrap);
        cleanupManager.trackResizeObserver(resizeObserver);
    }

    const playerContainer = document.querySelector(SELECTORS.PLAYER_CONTAINER);
    if (playerContainer) {
        const containerObserver = new ResizeObserver(() => handleResize());
        containerObserver.observe(playerContainer);
        cleanupManager.trackResizeObserver(containerObserver);
    }
}

// ---- Auto-skip ----

/**
 * 设置自动跳过广告功能
 * 监听视频的 timeupdate 事件，在广告时间段自动跳转，并显示/移除跳过动画
 * @param video - 视频 DOM 元素
 * @param adStartSeconds - 广告开始时间（秒）
 * @param adEndSeconds - 广告结束时间（秒）
 */
function setupAutoSkip(video: HTMLVideoElement, adStartSeconds: number, adEndSeconds: number): void {
    const autoSkip = config.autoSkip;
    let hasSkipped = false;
    let animationAdded = false;

    const playerWrap = document.querySelector(`#${SELECTORS.PLAYER_WRAP_ID}`) as HTMLElement;
    let animationElement: HTMLElement | null = null;

    const addSkipAnimation = () => {
        if (playerWrap && !animationAdded && !animationElement) {
            animationElement = document.createElement('div');
            animationElement.classList.add(skipAnimation.className);
            playerWrap.appendChild(animationElement);
            animationAdded = true;
            console.log('📺 ✨ Skip animation added');
        }
    };

    const removeSkipAnimation = () => {
        if (animationElement && animationAdded) {
            animationElement.remove();
            animationElement = null;
            animationAdded = false;
            console.log('📺 ✨ Skip animation removed');
        }
    };

    const handleTimeUpdate = () => {
        const currentTime = video.currentTime;
        const animationStartTime = Math.max(0, adStartSeconds - ANIMATION_LEAD_TIME_S);

        // Show animation before ad starts
        if (currentTime >= animationStartTime && currentTime < adEndSeconds && !animationAdded) {
            addSkipAnimation();
        }

        // Auto-skip the ad
        if (autoSkip && currentTime >= adStartSeconds && currentTime < adEndSeconds && !hasSkipped) {
            console.log(`📺 ⏩ Auto-skipping ad: ${currentTime.toFixed(2)}s → ${adEndSeconds}s`);
            video.currentTime = adEndSeconds;
            hasSkipped = true;
        }

        // Remove animation after ad ends
        if (hasSkipped && currentTime >= adEndSeconds) {
            removeSkipAnimation();
        }

        // Reset if user seeks away from ad region
        const resetBeforeTime = Math.max(0, adStartSeconds - ANIMATION_LEAD_TIME_S - 1);
        if (currentTime < resetBeforeTime || currentTime >= adEndSeconds + 1) {
            hasSkipped = false;
            removeSkipAnimation();
        }
    };

    video.addEventListener('timeupdate', handleTimeUpdate);
    cleanupManager.trackVideoEventListener(video, 'timeupdate', handleTimeUpdate as EventListener);
    console.log(`📺 ✔️ Auto-skip enabled: ${adStartSeconds}s - ${adEndSeconds}s`);
}

// ---- DOM element cleanup ----

/** 清理所有广告相关的 DOM 元素（标记条、动画等） */
export function cleanupDomElements(): void {
    // Remove all ad bars
    document.querySelectorAll(`.${CSS_CLASSES.AD_BAR}`).forEach(bar => bar.remove());

    // Remove common animation element
    if (commonAnimationElement) {
        commonAnimationElement.remove();
        commonAnimationElement = null;
    }

    // Remove skip animation elements
    document.querySelectorAll(`.${skipAnimation.className}`).forEach(anim => anim.remove());
}

// ---- Main entry point ----

/**
 * 初始化广告标记条（主入口）
 * 等待视频元素和进度条就绪后，创建标记条、设置 resize 处理和自动跳过
 * @param adStartSeconds - 广告开始时间（秒）
 * @param adEndSeconds - 广告结束时间（秒）
 */
export function initializeAdBar(adStartSeconds: number, adEndSeconds: number): void {
    injectAnimationStyles();

    const video = document.querySelector(SELECTORS.VIDEO) as HTMLVideoElement;

    if (!video) {
        console.log('📺 ❌ Video element not found, checking again...');
        const checkVideo = window.setInterval(() => {
            const v = document.querySelector(SELECTORS.VIDEO) as HTMLVideoElement;
            if (v) {
                console.log('📺 ✔️ Video element found');
                clearInterval(checkVideo);
                cleanupManager.untrackInterval(checkVideo);
                initializeAdBar(adStartSeconds, adEndSeconds);
            }
        }, VIDEO_ELEMENT_POLL_MS);
        cleanupManager.trackInterval(checkVideo);
        return;
    }

    const createAndSetup = () => {
        const progressWrap = document.querySelector(SELECTORS.PROGRESS_BAR);
        if (!progressWrap) {
            console.log('📺 ❌ Progress wrap not found, retrying...');
            const timeout = window.setTimeout(createAndSetup, PROGRESS_WRAP_RETRY_MS);
            cleanupManager.trackTimeout(timeout);
            return;
        }

        createAdBar(adStartSeconds, adEndSeconds);
        setupAdBarResizeHandlers(adStartSeconds, adEndSeconds);
        setupAutoSkip(video, adStartSeconds, adEndSeconds);
    };

    if (video.readyState >= 2) {
        console.log('📺 ✔️ Video ready, initializing ad bar...');
        createAndSetup();
    } else {
        console.log('📺 ❌ Video not ready, checking again...');
        const checkReady = window.setInterval(() => {
            if (video.readyState >= 2) {
                console.log('📺 ✔️ Video ready, initializing ad bar...');
                clearInterval(checkReady);
                cleanupManager.untrackInterval(checkReady);
                createAndSetup();
            }
        }, VIDEO_READY_POLL_MS);
        cleanupManager.trackInterval(checkReady);
    }
}
