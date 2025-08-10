import type { PDF2MDSettings } from './types';
import type PDF2MDPlugin from 'main';
import { getProvider } from './providers';
import type { AiMessage } from './providers/messages';

export async function processWithAI(settings: PDF2MDSettings, images: string[], prompt?: string): Promise<string> {
  const usePrompt = prompt || settings.currentPrompt;
  const provider = getProvider(settings.selectedProvider);
  return provider.processImages(settings, images, usePrompt);
}

// Backwards-compatible named helpers
export async function processWithAnthropic(settings: PDF2MDSettings, images: string[], prompt: string): Promise<string> {
  const provider = getProvider('anthropic');
  return provider.processImages(settings, images, prompt);
}

export async function processWithOllama(settings: PDF2MDSettings, images: string[], prompt: string): Promise<string> {
  const provider = getProvider('ollama');
  return provider.processImages(settings, images, prompt);
}

export async function processTextWithAnthropic(settings: PDF2MDSettings, text: string, prompt: string): Promise<string> {
  const provider = getProvider('anthropic');
  return provider.processText(settings, text, prompt);
}

export async function processTextWithOllama(settings: PDF2MDSettings, text: string, prompt: string): Promise<string> {
  const provider = getProvider('ollama');
  return provider.processText(settings, text, prompt);
}

export async function loadOllamaModels(plugin: PDF2MDPlugin) {
  const provider = getProvider('ollama');
  if (provider.loadModels) {
    return provider.loadModels(plugin);
  }
  return false;
}
