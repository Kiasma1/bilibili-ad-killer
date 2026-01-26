export interface UserConfig { 
    apiKey: string; 
    aiModel: string, 
    autoSkip: boolean,
    ignoreVideoLessThan5Minutes: boolean,
    usingBrowserAIModel: boolean
} 

export const DEFAULT_CONFIG: UserConfig = {
    apiKey: '',
    aiModel: 'gemini-2.5-flash',
    autoSkip: true,
    ignoreVideoLessThan5Minutes: true,
    usingBrowserAIModel: false
}

