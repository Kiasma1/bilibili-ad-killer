import { TOAST_DURATION_MS } from './constants';

declare const Toastify: any;

interface ToastMessages {
    [key: string]: string;
}

const messagesToBeNotified: { message: string; type: 'success' | 'error' | 'warning' | 'info' }[] = [];

export let messages: ToastMessages = {};

export function initToastMessages(inputMessages: ToastMessages) {
    messages = inputMessages;
}

export function notifyDelayedMessages() {
    console.log('📺 ✔️ Notifying delayed messages:', messagesToBeNotified);
    while (messagesToBeNotified.length > 0) {
        const message = messagesToBeNotified.shift();
        if (message) {
            showToast(message.message, message.type);
        }
    }
}

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
        backgroundColor: backgrounds[type],
        stopOnFocus: true,
        style: {
            borderRadius: '8px',
            fontFamily: 'system-ui, -apple-system, sans-serif',
        },
    }).showToast();
}
