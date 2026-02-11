import { TOAST_DURATION_MS } from './constants';

declare const Toastify: any;

/** Toast 消息的键值对映射 */
interface ToastMessages {
    [key: string]: string;
}

/** 等待 Toastify 加载完成后再发送的消息队列 */
const messagesToBeNotified: { message: string; type: 'success' | 'error' | 'warning' | 'info' }[] = [];

/** 当前已加载的 Toast 消息文本（由 i18n 提供） */
export let messages: ToastMessages = {};

/**
 * 初始化 Toast 消息文本（通常由 i18n 模块调用）
 * @param inputMessages - 包含各种提示文本的键值对
 */
export function initToastMessages(inputMessages: ToastMessages) {
    messages = inputMessages;
}

/**
 * 发送所有延迟的 Toast 消息（在 Toastify 库加载完成后调用）
 */
export function notifyDelayedMessages() {
    console.log('📺 ✔️ Notifying delayed messages:', messagesToBeNotified);
    while (messagesToBeNotified.length > 0) {
        const message = messagesToBeNotified.shift();
        if (message) {
            showToast(message.message, message.type);
        }
    }
}

/**
 * 显示一条 Toast 通知。如果 Toastify 尚未加载，消息会被暂存到队列中
 * @param message - 要显示的消息文本
 * @param type - 通知类型：success（成功）、error（错误）、warning（警告）、info（信息）
 */
export function showToast(message: string, type: 'success' | 'error' | 'warning' | 'info' = 'error') {
    if (typeof Toastify === 'undefined') {
        messagesToBeNotified.push({ message, type });
        console.error('📺 ⚠️ Toastify not available yet, cannot show toast');
        console.error('📺 ⚠️ Messages to be notified:', JSON.stringify(messagesToBeNotified));
        return;
    }

    if (!message) {
        return;
    }

    const backgrounds = {
        success: 'linear-gradient(to right, #00b09b, #96c93d)',
        error: 'linear-gradient(to right, #ff5f6d, #ffc371)',
        warning: 'linear-gradient(to right, #f7971e, #ffd200)',
        info: 'linear-gradient(to right, #4facfe, #00f2fe)',
    };

    Toastify({
        text: message,
        duration: TOAST_DURATION_MS,
        gravity: 'top',
        position: 'right',
        stopOnFocus: true,
        style: {
            background: backgrounds[type],
            borderRadius: '8px',
            fontFamily: 'system-ui, -apple-system, sans-serif',
        },
    }).showToast();
}
