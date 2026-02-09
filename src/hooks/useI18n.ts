import { useEffect, useState } from 'react';

/**
 * 国际化 Hook — 封装 Chrome i18n API，提供翻译函数
 * @returns 包含 t 翻译函数的对象
 */
export const useI18n = () => {
  /**
   * 根据消息键获取对应的国际化文本
   * @param key - Chrome i18n 消息键名
   * @returns 翻译后的文本，如果 Chrome i18n 不可用则返回原始键名
   */
  const t = (key: string): string => {
    if (chrome?.i18n) {
      return chrome.i18n.getMessage(key);
    }
    return key;
  };

  return { t };
};
