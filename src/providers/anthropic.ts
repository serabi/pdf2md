import { requestUrl } from 'obsidian';
import type { PDF2MDSettings } from '../types';
import type { Provider } from './types';

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

    const content: any[] = [{ type: 'text', text: prompt }];

    images.forEach((imageDataUrl, index) => {
      let mediaType = 'image/png';
      let imageData = imageDataUrl;
      if (imageDataUrl.startsWith('data:image/jpeg;base64,')) {
        mediaType = 'image/jpeg';
        imageData = imageDataUrl.replace(/^data:image\/jpeg;base64,/, '');
      } else if (imageDataUrl.startsWith('data:image/webp;base64,')) {
        mediaType = 'image/webp';
        imageData = imageDataUrl.replace(/^data:image\/webp;base64,/, '');
      } else if (imageDataUrl.startsWith('data:image/png;base64,')) {
        mediaType = 'image/png';
        imageData = imageDataUrl.replace(/^data:image\/png;base64,/, '');
      } else {
        imageData = imageDataUrl.replace(/^data:image\/[^;]+;base64,/, '');
      }

      content.push({
        type: 'image',
        source: { type: 'base64', media_type: mediaType, data: imageData }
      });

      if (index < images.length - 1) {
        content.push({ type: 'text', text: `\n\n--- Page ${index + 2} ---\n\n` });
      }
    });

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
    const content = `${prompt}\n\n${text}`;
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
