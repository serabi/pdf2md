import { requestUrl, Notice } from 'obsidian';
import { reportProgress } from '../progress';
import type { PDF2MDSettings } from '../types';
import type { Provider } from './types';

function normalizeUrl(url: string): string {
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    return `http://${url}`;
  }
  return url;
}

function isVisionModel(modelName: string): boolean {
  const name = modelName.toLowerCase();
  return (
    name.includes('llava') ||
    name.includes('bakllava') ||
    name.includes('moondream') ||
    name.includes('qwenvl') ||
    name.includes('qwen-vl') ||
    name.includes('minicpm') ||
    name.includes('yi-vl') ||
    name.includes('phi-3-vision')
  );
}

export const OllamaProvider: Provider = {
  id: 'ollama',

  async processImages(settings: PDF2MDSettings, images: string[], prompt: string): Promise<string> {
    if (!images || images.length === 0) {
      throw new Error('No images to process');
    }

    const ollamaUrl = normalizeUrl(settings.ollamaUrl);

    const imagesPerRequest = Math.max(1, settings.ollamaImagesPerRequest ?? 1);
    const retryCount = Math.max(0, settings.ollamaRetryCount ?? 2);
    const retryDelayMs = Math.max(0, settings.ollamaRetryDelayMs ?? 1000);

    // Chunk images according to the configured size. Many Ollama vision models only accept one image.
    const chunks: string[][] = [];
    for (let i = 0; i < images.length; i += imagesPerRequest) {
      chunks.push(images.slice(i, i + imagesPerRequest));
    }

    const results: string[] = [];
    let chunkIndex = 0;
    for (const chunk of chunks) {
      chunkIndex++;
      reportProgress({ phase: 'chunk', message: `Processing chunk ${chunkIndex}/${chunks.length}`, current: chunkIndex, total: chunks.length });
      try {
        new Notice(`Ollama: processing chunk ${chunkIndex}/${chunks.length}...`, 2000);
      } catch {}
      const processedImages = chunk.map((img) => {
        if (img.startsWith('data:image/jpeg;base64,')) {
          return img.replace(/^data:image\/jpeg;base64,/, '');
        } else if (img.startsWith('data:image/webp;base64,')) {
          return img.replace(/^data:image\/webp;base64,/, '');
        } else if (img.startsWith('data:image/png;base64,')) {
          return img.replace(/^data:image\/png;base64,/, '');
        }
        return img.replace(/^data:image\/[^;]+;base64,/, '');
      });

      const requestBody = {
        model: settings.selectedModel,
        prompt: chunk.length > 1
          ? `${prompt}\n\nThe following images are consecutive pages for this document chunk. Preserve their order.`
          : prompt,
        images: processedImages,
        stream: Boolean(settings.ollamaEnableStreaming)
      } as any;

      let attempt = 0;
      while (true) {
        try {
          const response = await requestUrl({
            url: `${ollamaUrl}/api/generate`,
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
          });

          if (response.status === 200 && response.json.response) {
            results.push(response.json.response);
            reportProgress({ phase: 'chunk', message: `Finished chunk ${chunkIndex}/${chunks.length}`, current: chunkIndex, total: chunks.length });
            try { new Notice(`Ollama: finished chunk ${chunkIndex}/${chunks.length}`, 1200); } catch {}
            break;
          }

          // Non-200 or malformed response: throw to trigger retry logic
          throw new Error(`HTTP ${response.status}: ${JSON.stringify(response.json)}`);
        } catch (err: any) {
          if (attempt < retryCount) {
            attempt++;
            await new Promise((r) => setTimeout(r, retryDelayMs));
            continue;
          }
          const reason = err?.message || 'Unknown error';
          // Specific notices
          try {
            const msg = String(reason).toLowerCase();
            if (msg.includes('err_connection_refused')) {
              new Notice('Ollama: connection refused. Ensure Ollama is running and URL is correct.', 6000);
            } else if (msg.includes('not found') && msg.includes('model')) {
              new Notice(`Ollama: model "${settings.selectedModel}" not found. Try: ollama pull ${settings.selectedModel}`, 6000);
            } else if (msg.includes('image') && (msg.includes('unsupported') || msg.includes('not support') || msg.includes('vision'))) {
              new Notice('Ollama: selected model may not support image inputs. Use a vision-capable model (e.g., llava).', 6000);
            } else {
              new Notice(`Ollama: chunk ${chunkIndex}/${chunks.length} failed: ${reason}`, 6000);
            }
          } catch {}
          throw new Error(`Ollama request failed for chunk ${chunkIndex}/${chunks.length}: ${reason}`);
        }
      }
    }

    // Concatenate chunk results with clear separators to preserve order
    const joined = results
      .map((r, i) => `\n\n<!-- chunk:${i + 1}/${results.length} -->\n${r.trim()}`)
      .join('\n');
    reportProgress({ phase: 'status', message: 'All chunks processed' });
    try { new Notice('Ollama: all chunks processed successfully', 2000); } catch {}
    return joined.trim();
  },

  async processText(settings: PDF2MDSettings, text: string, prompt: string): Promise<string> {
    const ollamaUrl = normalizeUrl(settings.ollamaUrl);

    const requestBody = {
      model: settings.selectedModel,
      prompt: `${prompt}\n\n${text}`,
      stream: false
    };

    const response = await requestUrl({
      url: `${ollamaUrl}/api/generate`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });

    if (response.status === 200 && response.json.response) {
      return response.json.response;
    }

    throw new Error(`Ollama API error: ${response.status} - ${JSON.stringify(response.json)}`);
  },

  async loadModels(plugin): Promise<boolean> {
    try {
      let ollamaUrl = normalizeUrl(plugin.settings.ollamaUrl);
      const response = await requestUrl({ url: `${ollamaUrl}/api/tags`, method: 'GET' });
      if (response.status === 200 && response.json.models) {
        plugin.settings.ollamaModels = response.json.models.map((m: any) => m.name);
        await plugin.saveSettings();
        return true;
      }
    } catch (error: any) {
      if (!error.message?.includes('ERR_CONNECTION_REFUSED')) {
        console.warn('[PDF2MD] Failed to load Ollama models:', error.message);
      }
      plugin.settings.ollamaModels = [];
      return false;
    }
    return false;
  },

  async testConnection(plugin): Promise<boolean> {
    try {
      const url = normalizeUrl(plugin.settings.ollamaUrl);
      const resp = await requestUrl({ url: `${url}/api/tags`, method: 'GET' });
      if (resp.status !== 200) return false;
      const model = plugin.settings.selectedModel;
      const tags: string[] = (resp.json?.models || []).map((m: any) => m.name);
      const hasModel = model ? tags.includes(model) : true;

      // Vision capability heuristic unless user overrides
      const assumeVision = Boolean(plugin.settings.ollamaAssumeVision);
      const visionOk = assumeVision || (model ? isVisionModel(model) : false);

      if (!hasModel) {
        new Notice(`Ollama: model "${model}" not found. Pull it via 'ollama pull ${model}'.`);
        return false;
      }

      if (!visionOk) {
        new Notice(`Ollama: model "${model}" may not support images. Consider a vision model like 'llava'.`);
        // Still return true, connection works; just warn about capability
      }
      return true;
    } catch (e) {
      new Notice('Failed to connect to Ollama. Ensure it is running and URL is correct.');
      return false;
    }
  }
};
