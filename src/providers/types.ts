import type { PDF2MDSettings } from '../types';
import type PDF2MDPlugin from 'main';

export type ProviderId = 'anthropic' | 'ollama' | 'openrouter';

export interface ModelInfo {
  id: string;
  displayName?: string;
  capabilities?: {
    vision?: boolean;
    streaming?: boolean;
  };
}

export interface Provider {
  id: ProviderId;
  processImages(settings: PDF2MDSettings, images: string[], prompt: string): Promise<string>;
  processText(settings: PDF2MDSettings, text: string, prompt: string): Promise<string>;
  loadModels?(plugin: PDF2MDPlugin): Promise<boolean>;
  testConnection?(plugin: PDF2MDPlugin): Promise<boolean>;
}
