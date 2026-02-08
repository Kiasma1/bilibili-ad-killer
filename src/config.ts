export interface UserConfig { 
    apiKey: string; 
    aiModel: string, 
    autoSkip: boolean,
    ignoreVideoLessThan5Minutes: boolean,
    ignoreVideoMoreThan30Minutes: boolean,
    usingBrowserAIModel: boolean
} 

export const DEFAULT_CONFIG: UserConfig = {
    apiKey: '',
    aiModel: 'gemini-2.5-flash',
    autoSkip: true,
    ignoreVideoLessThan5Minutes: true,
    ignoreVideoMoreThan30Minutes: true,
    usingBrowserAIModel: false
}

export let config: UserConfig = DEFAULT_CONFIG;

export function initializeConfig(inputUserConfig: UserConfig) {
    config = inputUserConfig
}

