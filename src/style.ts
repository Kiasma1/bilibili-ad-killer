import { CSS_CLASSES } from './constants';

// ============================================================
// Animation style generation — config-driven, no duplication
// ============================================================

export interface AnimationConfig {
    name: string;
    className: string;
    colors: string[];
    duration: string;
    blurOpacity: number;
}

export const skipAnimation: AnimationConfig = {
    name: 'bilibili-skip',
    className: CSS_CLASSES.SKIP_ANIMATION,
    colors: ['#ff4545', '#00ff99', '#006aff', '#ff0095', '#ff4545'],
    duration: '3s',
    blurOpacity: 1,
};

export const thinkingAnimation: AnimationConfig = {
    name: 'bilibili-thinking',
    className: CSS_CLASSES.THINKING_ANIMATION,
    colors: ['#8bb4ff', '#d88cff', '#80e5ff', '#b39ddb', '#8bb4ff'],
    duration: '2.5s',
    blurOpacity: 0.8,
};

export const warningAnimation: AnimationConfig = {
    name: 'bilibili-warning',
    className: CSS_CLASSES.WARNING_ANIMATION,
    colors: ['#ff6b35', '#ff4500', '#ff8c42', '#ff6347', '#ff6b35'],
    duration: '1.5s',
    blurOpacity: 0.8,
};

export const ALL_ANIMATIONS = [skipAnimation, thinkingAnimation, warningAnimation];

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

export function getAnimationStyleContent(config: AnimationConfig): string {
    return generateAnimationStyle(config);
}

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
