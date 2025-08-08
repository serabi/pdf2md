export * from './types';
export { AnthropicProvider } from './anthropic';
export { OllamaProvider } from './ollama';
export { OpenRouterProvider } from './openrouter';

import type { Provider, ProviderId } from './types';
import { AnthropicProvider } from './anthropic';
import { OllamaProvider } from './ollama';
import { OpenRouterProvider } from './openrouter';

const REGISTRY: Record<ProviderId, Provider> = {
  anthropic: AnthropicProvider,
  ollama: OllamaProvider,
  openrouter: OpenRouterProvider
};

export function getProvider(id: ProviderId): Provider {
  return REGISTRY[id];
}
