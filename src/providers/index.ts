export * from './types';
export { AnthropicProvider } from './anthropic';
export { OllamaProvider } from './ollama';
export { OpenRouterProvider } from './openrouter';
export { OpenAIProvider } from './openai';
export { LMStudioProvider } from './lmstudio';

import type { Provider, ProviderId } from './types';
import { AnthropicProvider } from './anthropic';
import { OllamaProvider } from './ollama';
import { OpenRouterProvider } from './openrouter';
import { OpenAIProvider } from './openai';
import { LMStudioProvider } from './lmstudio';

const REGISTRY: Record<ProviderId, Provider> = {
  anthropic: AnthropicProvider,
  ollama: OllamaProvider,
  openrouter: OpenRouterProvider,
  openai: OpenAIProvider,
  lmstudio: LMStudioProvider
};

export function getProvider(id: ProviderId): Provider {
  return REGISTRY[id];
}
