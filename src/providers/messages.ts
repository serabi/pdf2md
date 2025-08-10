export type AiRole = 'system' | 'user' | 'assistant';

export type AiContentPart =
  | { type: 'text'; text: string }
  | { type: 'image'; mimeType: string; dataBase64: string; alt?: string };

export interface AiMessage {
  role: AiRole;
  parts: AiContentPart[];
}

export interface AiRequestSettings {
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
}

export interface AiRequest {
  modelId: string;
  messages: AiMessage[];
  settings?: AiRequestSettings;
}

export function buildUserMessageWithImages(prompt: string, imagesDataUrls: string[], options?: { addPageSeparators?: boolean }): AiMessage {
  const parts: AiContentPart[] = [];
  const addPageSeparators = options?.addPageSeparators ?? true;

  if (prompt && prompt.trim().length > 0) {
    parts.push({ type: 'text', text: prompt });
  }

  imagesDataUrls.forEach((dataUrl, index) => {
    const { mimeType, base64Data } = splitDataUrl(dataUrl);
    parts.push({ type: 'image', mimeType, dataBase64: base64Data });
    if (addPageSeparators && index < imagesDataUrls.length - 1) {
      parts.push({ type: 'text', text: `\n\n--- Page ${index + 2} ---\n\n` });
    }
  });

  return { role: 'user', parts };
}

export function splitDataUrl(dataUrl: string): { mimeType: string; base64Data: string } {
  // Default to PNG if cannot detect
  let mimeType = 'image/png';
  let base64Data = dataUrl;
  const match = dataUrl.match(/^data:([^;]+);base64,(.*)$/);
  if (match) {
    mimeType = match[1];
    base64Data = match[2];
  } else {
    // Attempt common types
    if (dataUrl.startsWith('data:image/jpeg;base64,')) {
      mimeType = 'image/jpeg';
      base64Data = dataUrl.replace(/^data:image\/jpeg;base64,/, '');
    } else if (dataUrl.startsWith('data:image/webp;base64,')) {
      mimeType = 'image/webp';
      base64Data = dataUrl.replace(/^data:image\/webp;base64,/, '');
    } else if (dataUrl.startsWith('data:image/png;base64,')) {
      mimeType = 'image/png';
      base64Data = dataUrl.replace(/^data:image\/png;base64,/, '');
    } else {
      // Fallback: strip any data URL header
      base64Data = dataUrl.replace(/^data:image\/[^;]+;base64,/, '');
    }
  }
  return { mimeType, base64Data };
}

// Provider-specific translation helpers

// Anthropic expects content array with { type: 'text' } and { type: 'image' | 'input_image' } depending on SDK; we will
// mirror the project's existing shape which uses { type: 'image', source: { type: 'base64', media_type, data } }.
export function toAnthropicContent(message: AiMessage): any[] {
  const content: any[] = [];
  for (const part of message.parts) {
    if (part.type === 'text') {
      content.push({ type: 'text', text: part.text });
    } else if (part.type === 'image') {
      content.push({
        type: 'image',
        source: { type: 'base64', media_type: part.mimeType, data: part.dataBase64 }
      });
    }
  }
  return content;
}

// Ollama generate API accepts prompt string and images array (base64 without data URL prefix)
export function toOllamaPromptAndImages(messages: AiMessage[]): { prompt: string; images: string[] } {
  const textChunks: string[] = [];
  const images: string[] = [];
  for (const msg of messages) {
    for (const part of msg.parts) {
      if (part.type === 'text') textChunks.push(part.text);
      else if (part.type === 'image') images.push(part.dataBase64);
    }
  }
  return { prompt: textChunks.join('\n'), images };
}
