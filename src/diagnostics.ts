import type PDF2MDPlugin from '../main';
import { getProvider } from './providers';
import { testPdftoppmPath, testTesseractPath } from './utils';
import { requestUrl } from 'obsidian';

export type DiagnosticsResult = {
  provider: string;
  providerConnectionOk: boolean;
  modelsCount?: number;
  tinyTestOk?: boolean;
  popplerOk: boolean;
  tesseractOk: boolean;
  messages: string[];
};

export async function runDiagnostics(plugin: PDF2MDPlugin): Promise<DiagnosticsResult> {
  const result: DiagnosticsResult = {
    provider: plugin.settings.selectedProvider,
    providerConnectionOk: false,
    popplerOk: false,
    tesseractOk: false,
    messages: []
  };

  try {
    // Provider connectivity and models
    const provider = getProvider(plugin.settings.selectedProvider as any);
    if ((provider as any).testConnection) {
      result.providerConnectionOk = await (provider as any).testConnection(plugin);
    } else {
      result.providerConnectionOk = true;
    }

    // Ollama model list
    if (plugin.settings.selectedProvider === 'ollama') {
      if ((provider as any).loadModels) {
        await (provider as any).loadModels(plugin);
      }
      result.modelsCount = (plugin.settings.ollamaModels || []).length;
      // Tiny text generation test
      try {
        const url = plugin.settings.ollamaUrl.startsWith('http') ? plugin.settings.ollamaUrl : `http://${plugin.settings.ollamaUrl}`;
        const testBody = {
          model: plugin.settings.selectedModel,
          prompt: 'Reply with exactly: OK',
          stream: false,
          options: { temperature: 0, num_predict: 16 }
        };
        const resp = await requestUrl({ url: `${url}/api/generate`, method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(testBody) });
        const text = (resp.json && resp.json.response) ? String(resp.json.response).trim() : '';
        result.tinyTestOk = text === 'OK';
        if (!result.tinyTestOk) result.messages.push('Tiny Ollama test did not return OK');
      } catch (e: any) {
        result.messages.push(`Tiny Ollama test error: ${e?.message || e}`);
      }
    }

    // Poppler
    result.popplerOk = await testPdftoppmPath(plugin.settings.popplerPdftoppmPath);
    if (!result.popplerOk) result.messages.push('Poppler (pdftoppm) not found');

    // Tesseract
    result.tesseractOk = await testTesseractPath(plugin.settings.tesseractPath);
    if (!result.tesseractOk) result.messages.push('Tesseract not found');
  } catch (e: any) {
    result.messages.push(`Diagnostics error: ${e?.message || e}`);
  }

  return result;
}
