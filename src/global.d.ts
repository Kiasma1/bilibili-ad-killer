// Global type declarations for browser APIs

interface LanguageModel {
  availability(options: {
    languages?: string[]
  }): Promise<'available' | 'unavailable' | 'downloadable' | 'downloading'>;
  create(parameters: {
    monitor?: (m:any) => void,
    initialPrompts?: { role: 'system' | 'user' | 'assistant', content: string }[],
  }): Promise<any>;
}

declare var LanguageModel: LanguageModel;

interface Window {
  LanguageModel?: LanguageModel;
}
