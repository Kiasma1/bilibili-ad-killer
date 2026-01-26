import { useEffect, useState } from 'react';

/**
 * Imperatively get a value from chrome.storage.local (async)
 * Use this outside of React components or when you need to fetch fresh data
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
 * Imperatively set a value in chrome.storage.local (async)
 * Use this outside of React components
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
 * A hook that syncs state with chrome.storage.local
 * Provides a synchronous interface (like useState) with automatic persistence
 * 
 * @param key - The storage key to use
 * @param defaultValue - Default value if nothing is stored
 * @returns [value, setValue, getValue] - Current value, setter function, and async getter for fresh data
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
