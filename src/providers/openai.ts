import { requestUrl } from 'obsidian';
import type { PDF2MDSettings } from '../types';
import type { Provider } from './types';
import { buildUserMessageWithImages } from './messages';

// Minimal OpenAI Chat Completions adapter (non-streaming)
// Vision support via content parts: text + image_url with data URLs
export const OpenAIProvider: Provider = {
  id: 'openai',

  async processImages(settings: PDF2MDSettings, images: string[], prompt: string): Promise<string> {
    if (!settings.openaiApiKey) throw new Error('OpenAI API key is missing');
    const baseUrl = (settings.openaiBaseUrl || 'https://api.openai.com').replace(/\/$/, '');
    const model = settings.selectedModel || 'gpt-4o';

    const user = buildUserMessageWithImages(prompt, images, { addPageSeparators: true });

    const openaiMessages = [
      {
        role: 'user',
        content: user.parts.map((p) => {
          if (p.type === 'text') return { type: 'text', text: p.text };
          const dataUrl = `data:${p.mimeType};base64,${p.dataBase64}`;
          return { type: 'image_url', image_url: { url: dataUrl } };
        })
      }
    ];

    const body = {
      model,
      messages: openaiMessages,
      temperature: settings.openaiTemperature ?? 0.2,
      max_tokens: settings.openaiMaxTokens ?? 2048,
      stream: false
    } as any;

    const resp = await requestUrl({
      url: `${baseUrl}/v1/chat/completions`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${settings.openaiApiKey}`,
        ...(settings.openaiOrganization ? { 'OpenAI-Organization': settings.openaiOrganization } : {})
      },
      body: JSON.stringify(body)
    });

    if (resp.status !== 200) {
      throw new Error(`OpenAI API error: ${resp.status} - ${JSON.stringify(resp.json)}`);
    }

    const text = resp.json?.choices?.[0]?.message?.content;
    if (typeof text === 'string' && text.length > 0) return text;
    throw new Error('OpenAI: empty response');
  },

  async processText(settings: PDF2MDSettings, text: string, prompt: string): Promise<string> {
    if (!settings.openaiApiKey) throw new Error('OpenAI API key is missing');
    const baseUrl = (settings.openaiBaseUrl || 'https://api.openai.com').replace(/\/$/, '');
    const model = settings.selectedModel || 'gpt-4o-mini';

    const openaiMessages = [
      { role: 'user', content: [{ type: 'text', text: `${prompt}\n\n${text}` }] }
    ];

    const body = {
      model,
      messages: openaiMessages,
      temperature: settings.openaiTemperature ?? 0.2,
      max_tokens: settings.openaiMaxTokens ?? 2048,
      stream: false
    } as any;

    const resp = await requestUrl({
      url: `${baseUrl}/v1/chat/completions`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${settings.openaiApiKey}`,
        ...(settings.openaiOrganization ? { 'OpenAI-Organization': settings.openaiOrganization } : {})
      },
      body: JSON.stringify(body)
    });

    if (resp.status !== 200) {
      throw new Error(`OpenAI API error: ${resp.status} - ${JSON.stringify(resp.json)}`);
    }

    const out = resp.json?.choices?.[0]?.message?.content;
    if (typeof out === 'string' && out.length > 0) return out;
    throw new Error('OpenAI: empty response');
  }
};
