import type { UserConfig } from './types';

export type { UserConfig } from './types';

/** 默认用户配置，未设置时使用这些值 */
export const DEFAULT_CONFIG: UserConfig = {
    aiProvider: 'gemini',
    apiKey: '',
    deepseekApiKey: '',
    aiModel: 'gemini-2.5-flash',
    autoSkip: true,
    ignoreVideoLessThan5Minutes: true,
    ignoreVideoMoreThan30Minutes: true,
    usingBrowserAIModel: false,
};

/** 当前生效的用户配置（运行时会被 initializeConfig 覆盖） */
export let config: UserConfig = DEFAULT_CONFIG;

/**
 * 用收到的用户配置初始化全局 config
 * @param inputUserConfig - 从 Chrome 存储中读取的用户配置
 */
export function initializeConfig(inputUserConfig: UserConfig) {
    config = inputUserConfig;
}
