import { requestUrl } from 'obsidian';
import type { PDF2MDSettings } from '../types';
import type { Provider } from './types';
import { buildUserMessageWithImages, toAnthropicContent } from './messages';

const VALID_MODELS = [
  'claude-sonnet-4-20250514',
  'claude-opus-4-20250514',
  'claude-3-5-sonnet-20241022',
  'claude-3-5-sonnet-20240620',
  'claude-3-5-haiku-20241022',
  'claude-3-opus-20240229',
  'claude-3-sonnet-20240229',
  'claude-3-haiku-20240307'
];

export const AnthropicProvider: Provider = {
  id: 'anthropic',

  async processImages(settings: PDF2MDSettings, images: string[], prompt: string): Promise<string> {
    const modelToUse = VALID_MODELS.includes(settings.selectedModel)
      ? settings.selectedModel
      : VALID_MODELS[0];

    const userMessage = buildUserMessageWithImages(prompt, images, { addPageSeparators: true });
    const content = toAnthropicContent(userMessage);

    const requestBody = {
      model: modelToUse,
      max_tokens: 4096,
      messages: [{ role: 'user', content }]
    };

    const response = await requestUrl({
      url: 'https://api.anthropic.com/v1/messages',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': settings.anthropicApiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(requestBody)
    });

    if (response.status === 200 && response.json.content) {
      return response.json.content[0].text;
    }

    throw new Error(`Anthropic API error: ${response.status} - ${JSON.stringify(response.json)}`);
  },

  async processText(settings: PDF2MDSettings, text: string, prompt: string): Promise<string> {
    const content = [{ type: 'text', text: `${prompt}\n\n${text}` }];
    const requestBody = {
      model: settings.selectedModel,
      max_tokens: 4096,
      messages: [{ role: 'user', content }]
    };

    const response = await requestUrl({
      url: 'https://api.anthropic.com/v1/messages',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': settings.anthropicApiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(requestBody)
    });

    if (response.status === 200 && response.json.content) {
      return response.json.content[0].text;
    }

    throw new Error(`Anthropic API error: ${response.status} - ${JSON.stringify(response.json)}`);
  }
};
