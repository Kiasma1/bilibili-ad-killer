import { useEffect, useState } from 'react';

/**
 * 命令式地从 chrome.storage.local 读取值（异步）
 * 适用于 React 组件外部或需要获取最新数据的场景
 * @param key - 存储键名
 * @param defaultValue - 键不存在时的默认值
 * @returns 存储的值，不存在则返回默认值
 */
export const getChromeStorageLocal = async <T>(
  key: string,
  defaultValue?: T
): Promise<T | undefined> => {
  if (!chrome?.storage?.local) {
    return defaultValue;
  }

  return new Promise((resolve) => {
    chrome.storage.local.get([key], (result) => {
      resolve(result[key] !== undefined ? (result[key] as T) : defaultValue);
    });
  });
};

/**
 * 命令式地向 chrome.storage.local 写入值（异步）
 * 适用于 React 组件外部
 * @param key - 存储键名
 * @param value - 要存储的值
 */
export const setChromeStorageLocal = async <T>(
  key: string,
  value: T
): Promise<void> => {
  if (!chrome?.storage?.local) {
    return;
  }

  return new Promise((resolve) => {
    chrome.storage.local.set({ [key]: value }, () => {
      resolve();
    });
  });
};

/**
 * 将 React 状态与 chrome.storage.local 双向同步的 Hook
 * 提供类似 useState 的同步接口，自动持久化到 Chrome 存储
 * 同时监听其他上下文（如 popup、content script）对同一键的修改
 *
 * @param key - 存储键名
 * @param defaultValue - 默认值（存储中无数据时使用）
 * @returns [当前值, 设置函数, 异步获取最新值函数]
 */
export const useChromeStorageLocal = <T>(
  key: string,
  defaultValue: T
): [T, (value: T | ((prev: T) => T)) => void, () => Promise<T>] => {
  const [value, setValue] = useState<T>(defaultValue);
  const [isInitialized, setIsInitialized] = useState(false);

  // Load initial value from storage
  useEffect(() => {
    if (chrome?.storage?.local) {
      chrome.storage.local.get([key], (result) => {
        if (result[key] !== undefined) {
          setValue(result[key] as T);
        }
        setIsInitialized(true);
      });
    } else {
      setIsInitialized(true);
    }
  }, [key]);

  // Listen for storage changes from other contexts
  useEffect(() => {
    if (!chrome?.storage?.local) return;

    const handleStorageChange = (
      changes: { [key: string]: chrome.storage.StorageChange },
      areaName: string
    ) => {
      if (areaName === 'local' && changes[key]) {
        setValue(changes[key].newValue as T);
      }
    };

    chrome.storage.onChanged.addListener(handleStorageChange);

    return () => {
      chrome.storage.onChanged.removeListener(handleStorageChange);
    };
  }, [key]);

  // Custom setter that updates both local state and storage
  const setStoredValue = (newValue: T | ((prev: T) => T)) => {
    setValue((prevValue) => {
      const valueToStore = newValue instanceof Function ? newValue(prevValue) : newValue;
      
      // Update storage asynchronously (non-blocking)
      if (chrome?.storage?.local) {
        chrome.storage.local.set({ [key]: valueToStore });
      }
      
      return valueToStore;
    });
  };

  // Getter that fetches fresh value from storage (async)
  const getStoredValue = async (): Promise<T> => {
    const freshValue = await getChromeStorageLocal<T>(key, defaultValue);
    return freshValue ?? defaultValue;
  };

  return [value, setStoredValue, getStoredValue];
};
