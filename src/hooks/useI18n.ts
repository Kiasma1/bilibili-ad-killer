import { useEffect, useState } from 'react';

export const useI18n = () => {
  const t = (key: string): string => {
    if (chrome?.i18n) {
      return chrome.i18n.getMessage(key);
    }
    return key;
  };

  return { t };
};
