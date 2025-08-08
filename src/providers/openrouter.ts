import { requestUrl } from 'obsidian';
import type { PDF2MDSettings } from '../types';
import type { Provider } from './types';

// Stub provider: to be implemented in a later step.
export const OpenRouterProvider: Provider = {
  id: 'openrouter',

  async processImages(settings: PDF2MDSettings, images: string[], prompt: string): Promise<string> {
    throw new Error('OpenRouter provider not implemented yet.');
  },

  async processText(settings: PDF2MDSettings, text: string, prompt: string): Promise<string> {
    throw new Error('OpenRouter provider not implemented yet.');
  },

  async testConnection(): Promise<boolean> {
    return false;
  }
};
