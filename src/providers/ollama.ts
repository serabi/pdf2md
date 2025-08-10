import { requestUrl, Notice } from 'obsidian';
import { reportProgress, isCancelled } from '../progress';
import type { PDF2MDSettings } from '../types';
import type { Provider } from './types';
import { buildUserMessageWithImages, toOllamaPromptAndImages } from './messages';

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
      if (isCancelled()) throw new Error('Cancelled by user');
      chunkIndex++;
      reportProgress({ phase: 'chunk', message: `Processing chunk ${chunkIndex}/${chunks.length}`, current: chunkIndex, total: chunks.length });
      try {
        new Notice(`Ollama: processing chunk ${chunkIndex}/${chunks.length}...`, 2000);
      } catch {}
      // Build unified message and translate to Ollama fields
      const userMessage = buildUserMessageWithImages(prompt, chunk, { addPageSeparators: chunk.length > 1 });
      const { prompt: promptForChunk, images: processedImages } = toOllamaPromptAndImages([userMessage]);

      // Enforce max payload size by truncating images if necessary
      const maxChars = Math.max(200000, settings.ollamaMaxRequestChars ?? 900000);
      const promptPart = promptForChunk || '';
      let payloadImages = processedImages.slice();
      while (payloadImages.length > 0) {
        const estimatedSize = JSON.stringify({ model: settings.selectedModel, prompt: promptPart, images: payloadImages, stream: false }).length;
        if (estimatedSize <= maxChars) break;
        // Drop last image if too large; fall back to single image if needed
        if (payloadImages.length === 1) break;
        payloadImages = payloadImages.slice(0, payloadImages.length - 1);
      }

      const requestBody = {
        model: settings.selectedModel,
        prompt: promptPart,
        images: payloadImages,
        stream: Boolean(settings.ollamaEnableStreaming),
        options: {
          temperature: settings.ollamaTemperature ?? 0.2,
          num_predict: settings.ollamaNumPredict ?? 1024
        }
      } as any;

      let attempt = 0;
      while (true) {
        if (isCancelled()) throw new Error('Cancelled by user');
        try {
          const response = await requestUrl({
            url: `${ollamaUrl}/api/generate`,
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
          });

          if (response.status === 200) {
            const textAgg = extractResponseText(response);
            if (textAgg) {
              results.push(textAgg);
            } else if (response.json && response.json.response) {
              results.push(response.json.response);
            } else {
              throw new Error('Unexpected Ollama response format');
            }
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
              if (settings.ollamaTextFallbackEnabled) {
                try {
                  // Save data URLs to temp PNG files for Tesseract
                  const fs = require('fs').promises;
                  const os = require('os');
                  const path = require('path');
                  const tmpDir = os.tmpdir();
                  const imagePaths: string[] = [];
                  for (const dataUrl of chunk) {
                    const m = dataUrl.match(/^data:image\/(png|jpeg);base64,(.*)$/);
                    if (!m) continue;
                    const ext = m[1] === 'jpeg' ? 'jpg' : 'png';
                    const b64 = m[2];
                    const buf = Buffer.from(b64, 'base64');
                    const filePath = path.join(tmpDir, `pdf2md-ocr-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`);
                    await fs.writeFile(filePath, buf);
                    imagePaths.push(filePath);
                  }
                  if (imagePaths.length > 0) {
                    const { runTesseract } = await import('../utils');
                    const ocrText = await runTesseract({
                      imagePaths,
                      tesseractPath: settings.tesseractPath,
                      languages: settings.tesseractLanguages,
                      oem: settings.tesseractOEM,
                      psm: settings.tesseractPSM
                    });
                    // Clean up temp files
                    for (const p of imagePaths) { try { await fs.unlink(p); } catch {} }
                    if (ocrText && ocrText.trim().length > 0) {
                      const textPrompt = `${prompt}\n\nThe previous step failed to process images; clean, correct, and format this OCR text instead:\n\n${ocrText}`;
                      const textResult = await this.processText(settings, textPrompt, '');
                      if (textResult) {
                        results.push(textResult);
                        break;
                      }
                    }
                  }
                } catch {}
              }
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
      stream: Boolean(settings.ollamaEnableStreaming),
      options: {
        temperature: settings.ollamaTemperature ?? 0.2,
        num_predict: settings.ollamaNumPredict ?? 1024
      }
    };

    const response = await requestUrl({
      url: `${ollamaUrl}/api/generate`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });

    if (response.status === 200) {
      const textAgg = extractResponseText(response);
      if (textAgg) return textAgg;
      if (response.json && response.json.response) return response.json.response;
    }

    throw new Error(`Ollama API error: ${response.status} - ${JSON.stringify(response.json)}`);
  },

  async loadModels(plugin): Promise<boolean> {
    try {
      let ollamaUrl = normalizeUrl(plugin.settings.ollamaUrl);
      const response = await requestUrl({ url: `${ollamaUrl}/api/tags`, method: 'GET' });
      if (response.status === 200 && response.json.models) {
        const models: string[] = response.json.models.map((m: any) => m.name);
        plugin.settings.ollamaModels = models;
        // Build vision-capable list using heuristic and /api/show metadata if available
        const visionSet: Set<string> = new Set();
        models.forEach(m => { if (isVisionModel(m)) visionSet.add(m); });
        try {
          for (const m of models) {
            const show = await requestUrl({ url: `${ollamaUrl}/api/show`, method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: m }) });
            if (show.status === 200) {
              const lower = JSON.stringify(show.json || {}).toLowerCase();
              if (lower.includes('vision') || lower.includes('image') || lower.includes('multimodal')) {
                visionSet.add(m);
              }
            }
          }
        } catch {}
        plugin.settings.ollamaVisionModels = Array.from(visionSet);
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

function extractResponseText(resp: any): string | null {
  try {
    // If streaming was on, Ollama returns NDJSON lines. Try to parse resp.text
    if (typeof resp.text === 'string' && resp.text.trim().length > 0) {
      const lines = resp.text.split(/\r?\n/).filter((l: string) => l.trim().length > 0);
      let aggregate = '';
      for (const line of lines) {
        try {
          const obj = JSON.parse(line);
          if (typeof obj.response === 'string') {
            aggregate += obj.response;
          }
        } catch {
          // ignore non-JSON lines
        }
      }
      return aggregate.length > 0 ? aggregate : null;
    }
  } catch {}
  return null;
}
