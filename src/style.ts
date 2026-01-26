export const skipAnimationClass = 'bilibili-skip-animation';
export const thinkingAnimationClass = 'bilibili-thinking-animation';
export const warningAnimationClass = 'bilibili-warning-animation';

export function aboutToSkipAdStyle(): string {
    return `
        @property --bilibili-skip-angle {
            syntax: "<angle>";
            initial-value: 0deg;
            inherits: false;
        }

        .${skipAnimationClass} {
            background: #1c1f2b;
            position: absolute;
            width: 100%;
            height: 100%;
            left: 0;
            top: 0;
            z-index: -1;
        }

        .${skipAnimationClass}::after,
        .${skipAnimationClass}::before {
            content: '';
            position: absolute;
            height: 100%;
            width: 100%;
            background-image: conic-gradient(
                from var(--bilibili-skip-angle),
                #ff4545,
                #00ff99,
                #006aff,
                #ff0095,
                #ff4545
            );
            top: 50%;
            left: 50%;
            translate: -50% -50%;
            z-index: 10;
            border-radius: 0;
            animation: bilibili-skip-spin 3s linear infinite;
            pointer-events: none;
        }

        .${skipAnimationClass}::before {
            filter: blur(1.5rem);
            opacity: 1;
        }

        @keyframes bilibili-skip-spin {
            from {
                --bilibili-skip-angle: 0deg;
            }
            to {
                --bilibili-skip-angle: 360deg;
            }
        }
    `
}

export function thinkingStyle(): string {
    return `
        @property --bilibili-thinking-angle {
            syntax: "<angle>";
            initial-value: 0deg;
            inherits: false;
        }

        .${thinkingAnimationClass} {
            background: #1c1f2b;
            position: absolute;
            width: 100%;
            height: 100%;
            left: 0;
            top: 0;
            z-index: -1;
        }

        .${thinkingAnimationClass}::after,
        .${thinkingAnimationClass}::before {
            content: '';
            position: absolute;
            height: 100%;
            width: 100%;
            background-image: conic-gradient(
                from var(--bilibili-thinking-angle),
                #8bb4ff,
                #d88cff,
                #80e5ff,
                #b39ddb,
                #8bb4ff
            );
            top: 50%;
            left: 50%;
            translate: -50% -50%;
            z-index: 10;
            border-radius: 0;
            animation: bilibili-thinking-spin 2.5s linear infinite;
            pointer-events: none;
        }

        .${thinkingAnimationClass}::before {
            filter: blur(1.5rem);
            opacity: 0.8;
        }

        @keyframes bilibili-thinking-spin {
            from {
                --bilibili-thinking-angle: 0deg;
            }
            to {
                --bilibili-thinking-angle: 360deg;
            }
        }
    `
}

export function warningStyle(): string {
    return `
        @property --bilibili-warning-angle {
            syntax: "<angle>";
            initial-value: 0deg;
            inherits: false;
        }

        .${warningAnimationClass} {
            background: #1c1f2b;
            position: absolute;
            width: 100%;
            height: 100%;
            left: 0;
            top: 0;
            z-index: -1;
        }

        .${warningAnimationClass}::after,
        .${warningAnimationClass}::before {
            content: '';
            position: absolute;
            height: 100%;
            width: 100%;
            background-image: conic-gradient(
                from var(--bilibili-warning-angle),
                #ff6b35,
                #ff4500,
                #ff8c42,
                #ff6347,
                #ff6b35
            );
            top: 50%;
            left: 50%;
            translate: -50% -50%;
            z-index: 10;
            border-radius: 0;
            animation: bilibili-warning-spin 1.5s linear infinite;
            pointer-events: none;
        }

        .${warningAnimationClass}::before {
            filter: blur(1.5rem);
            opacity: 0.8;
        }

        @keyframes bilibili-warning-spin {
            from {
                --bilibili-warning-angle: 0deg;
            }
            to {
                --bilibili-warning-angle: 360deg;
            }
        }
    `
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