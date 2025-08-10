import { requestUrl, Notice } from 'obsidian';
import type { PDF2MDSettings } from '../types';
import type { Provider } from './types';
import { buildUserMessageWithImages } from './messages';

// LM Studio exposes an OpenAI-compatible chat completions API (by default at http://localhost:1234)
// We treat it as OpenAI-compatible, but allow custom base URL and optional API key.
export const LMStudioProvider: Provider = {
  id: 'lmstudio',

  async processImages(settings: PDF2MDSettings, images: string[], prompt: string): Promise<string> {
    const baseUrl = (settings.lmstudioBaseUrl || 'http://localhost:1234').replace(/\/$/, '');
    const model = settings.selectedModel || '';
    if (!model) throw new Error('LM Studio: please set a model name');

    const user = buildUserMessageWithImages(prompt, images, { addPageSeparators: true });

    const messages = [
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
      messages,
      temperature: settings.lmstudioTemperature ?? 0.2,
      max_tokens: settings.lmstudioMaxTokens ?? 2048,
      stream: false
    } as any;

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (settings.lmstudioApiKey) headers['Authorization'] = `Bearer ${settings.lmstudioApiKey}`;

    const resp = await requestUrl({
      url: `${baseUrl}/v1/chat/completions`,
      method: 'POST',
      headers,
      body: JSON.stringify(body)
    });

    if (resp.status !== 200) {
      throw new Error(`LM Studio API error: ${resp.status} - ${JSON.stringify(resp.json)}`);
    }

    const text = resp.json?.choices?.[0]?.message?.content;
    if (typeof text === 'string' && text.length > 0) return text;
    throw new Error('LM Studio: empty response');
  },

  async processText(settings: PDF2MDSettings, text: string, prompt: string): Promise<string> {
    const baseUrl = (settings.lmstudioBaseUrl || 'http://localhost:1234').replace(/\/$/, '');
    const model = settings.selectedModel || '';
    if (!model) throw new Error('LM Studio: please set a model name');

    const messages = [
      { role: 'user', content: [{ type: 'text', text: `${prompt}\n\n${text}` }] }
    ];

    const body = {
      model,
      messages,
      temperature: settings.lmstudioTemperature ?? 0.2,
      max_tokens: settings.lmstudioMaxTokens ?? 2048,
      stream: false
    } as any;

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (settings.lmstudioApiKey) headers['Authorization'] = `Bearer ${settings.lmstudioApiKey}`;

    const resp = await requestUrl({
      url: `${baseUrl}/v1/chat/completions`,
      method: 'POST',
      headers,
      body: JSON.stringify(body)
    });

    if (resp.status !== 200) {
      throw new Error(`LM Studio API error: ${resp.status} - ${JSON.stringify(resp.json)}`);
    }

    const out = resp.json?.choices?.[0]?.message?.content;
    if (typeof out === 'string' && out.length > 0) return out;
    throw new Error('LM Studio: empty response');
  }
};

// Extend with model loading and connection testing
(LMStudioProvider as any).loadModels = async function loadModels(plugin: any): Promise<boolean> {
  try {
    const baseUrl = (plugin.settings.lmstudioBaseUrl || 'http://localhost:1234').replace(/\/$/, '');
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (plugin.settings.lmstudioApiKey) headers['Authorization'] = `Bearer ${plugin.settings.lmstudioApiKey}`;
    // LM Studio exposes OpenAI-compatible list? If unavailable, we attempt a chat/completions with an invalid model to infer.
    // Prefer the models endpoint if present:
    try {
      const resp = await requestUrl({ url: `${baseUrl}/v1/models`, method: 'GET', headers });
      if (resp.status === 200 && Array.isArray(resp.json?.data)) {
        const models = resp.json.data.map((m: any) => m.id).filter(Boolean);
        plugin.settings.lmstudioModels = models;
        await plugin.saveSettings();
        return true;
      }
    } catch {}
    // Fallback: try known local models via info endpoint (some LM Studio builds expose /models)
    try {
      const resp2 = await requestUrl({ url: `${baseUrl}/models`, method: 'GET', headers });
      if (resp2.status === 200) {
        const arr = Array.isArray(resp2.json) ? resp2.json : (Array.isArray(resp2.json?.models) ? resp2.json.models : []);
        const models = arr.map((m: any) => (typeof m === 'string' ? m : m?.id || m?.name)).filter(Boolean);
        plugin.settings.lmstudioModels = models;
        // Heuristic: mark vision-capable models
        const visionSet: Set<string> = new Set();
        const isVision = (name: string) => /vision|vl|llava|moondream|bakllava|qwen[- ]?vl|qwenvl|minicpm|yi[- ]?vl|phi-3-vision/i.test(name);
        models.forEach((m: string) => { if (isVision(m)) visionSet.add(m); });
        plugin.settings.lmstudioVisionModels = Array.from(visionSet);
        await plugin.saveSettings();
        return true;
      }
    } catch {}
  } catch (e) {
    console.warn('[PDF2MD] LM Studio loadModels failed', (e as any)?.message || e);
  }
  plugin.settings.lmstudioModels = [];
  try { await plugin.saveSettings(); } catch {}
  return false;
};

(LMStudioProvider as any).testConnection = async function testConnection(plugin: any): Promise<boolean> {
  try {
    const baseUrl = (plugin.settings.lmstudioBaseUrl || 'http://localhost:1234').replace(/\/$/, '');
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (plugin.settings.lmstudioApiKey) headers['Authorization'] = `Bearer ${plugin.settings.lmstudioApiKey}`;
    const resp = await requestUrl({ url: `${baseUrl}/v1/models`, method: 'GET', headers });
    return resp.status === 200;
  } catch {
    return false;
  }
};
