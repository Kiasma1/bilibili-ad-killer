import { CSS_CLASSES } from './constants';

// ============================================================
// Animation style generation — config-driven, no duplication
// ============================================================

/** 动画配置接口，定义一种边框动画的所有参数 */
export interface AnimationConfig {
    /** 动画名称（用于生成 CSS keyframe 名） */
    name: string;
    /** 对应的 CSS 类名 */
    className: string;
    /** 渐变色列表（conic-gradient 的色值） */
    colors: string[];
    /** 动画持续时间（CSS 时间值，如 '3s'） */
    duration: string;
    /** 模糊层的不透明度 */
    blurOpacity: number;
}

/** 跳过广告时的红绿蓝渐变动画配置 */
export const skipAnimation: AnimationConfig = {
    name: 'bilibili-skip',
    className: CSS_CLASSES.SKIP_ANIMATION,
    colors: ['#ff4545', '#00ff99', '#006aff', '#ff0095', '#ff4545'],
    duration: '3s',
    blurOpacity: 1,
};

/** AI 思考中的柔和紫蓝渐变动画配置 */
export const thinkingAnimation: AnimationConfig = {
    name: 'bilibili-thinking',
    className: CSS_CLASSES.THINKING_ANIMATION,
    colors: ['#8bb4ff', '#d88cff', '#80e5ff', '#b39ddb', '#8bb4ff'],
    duration: '2.5s',
    blurOpacity: 0.8,
};

/** 字幕不可用时的橙红警告动画配置 */
export const warningAnimation: AnimationConfig = {
    name: 'bilibili-warning',
    className: CSS_CLASSES.WARNING_ANIMATION,
    colors: ['#ff6b35', '#ff4500', '#ff8c42', '#ff6347', '#ff6b35'],
    duration: '1.5s',
    blurOpacity: 0.8,
};

/** 所有动画配置的集合，用于批量注入样式 */
export const ALL_ANIMATIONS = [skipAnimation, thinkingAnimation, warningAnimation];

/**
 * 根据动画配置生成完整的 CSS 样式字符串
 * 包含 @property 声明、元素样式、伪元素渐变和 keyframe 动画
 * @param config - 动画配置对象
 * @returns 完整的 CSS 样式文本
 */
function generateAnimationStyle(config: AnimationConfig): string {
    const angleProp = `--${config.name}-angle`;
    const keyframeName = `${config.name}-spin`;
    const colorStops = config.colors.join(',\n                ');

    return `
        @property ${angleProp} {
            syntax: "<angle>";
            initial-value: 0deg;
            inherits: false;
        }

        .${config.className} {
            background: #1c1f2b;
            position: absolute;
            width: 100%;
            height: 100%;
            left: 0;
            top: 0;
            z-index: -1;
        }

        .${config.className}::after,
        .${config.className}::before {
            content: '';
            position: absolute;
            height: 100%;
            width: 100%;
            background-image: conic-gradient(
                from var(${angleProp}),
                ${colorStops}
            );
            top: 50%;
            left: 50%;
            translate: -50% -50%;
            z-index: 10;
            border-radius: 0;
            animation: ${keyframeName} ${config.duration} linear infinite;
            pointer-events: none;
        }

        .${config.className}::before {
            filter: blur(1.5rem);
            opacity: ${config.blurOpacity};
        }

        @keyframes ${keyframeName} {
            from {
                ${angleProp}: 0deg;
            }
            to {
                ${angleProp}: 360deg;
            }
        }
    `;
}

/**
 * 获取指定动画的 CSS 样式内容（generateAnimationStyle 的公开包装）
 * @param config - 动画配置对象
 * @returns CSS 样式文本
 */
export function getAnimationStyleContent(config: AnimationConfig): string {
    return generateAnimationStyle(config);
}

/**
 * 生成广告标记条的内联 CSS 样式
 * @param left - 距离进度条左侧的偏移量（像素）
 * @param width - 标记条宽度（像素）
 * @returns 内联 CSS 样式字符串
 */
export function initializeAdBarStyle(left: number, width: number): string {
    return `
        position: absolute;
        top: 0;
        left: ${left}px;
        width: ${width}px;
        height: 6px;
        background-color: #FFD700;
        opacity: 0.6;
        pointer-events: none;
        z-index: 10;
        border-radius: 3px;
        box-shadow: 0 0 2px rgba(255, 215, 0, 0.5);
    `;
}
