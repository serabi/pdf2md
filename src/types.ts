import * as promptsData from '../prompts.json';

// Types for PDF.js and canvas
export interface PDFPageProxy {
	getViewport(options: { scale: number }): any;
	render(options: { canvasContext: any; viewport: any }): { promise: Promise<void> };
}

export interface PDFDocumentProxy {
	numPages: number;
	getPage(pageNumber: number): Promise<PDFPageProxy>;
}

export interface PDF2MDSettings {
    anthropicApiKey: string;
    ollamaUrl: string;
    selectedModel: string;
    selectedProvider: 'anthropic' | 'ollama' | 'openai' | 'openrouter' | 'lmstudio';
	currentPrompt: string;
	savedPrompts: SavedPrompt[];
	anthropicModels: string[];
	ollamaModels: string[];
    lmstudioModels?: string[];
    lmstudioVisionModels?: string[];
	ollamaVisionModels?: string[];
	selectedPromptId: string;
	defaultPrompts: DefaultPrompt[];
	postProcessingTemplate: string;
	enablePostProcessing: boolean;
    // AI multi-pass refinement
    enableMultiPass?: boolean;
    enableThirdPass?: boolean;
    pass2Prompt?: string;
    pass3Prompt?: string;
	watchFolder: string;
	outputFolder: string;
	enableWatching: boolean;
	filenamePattern: string;
	embedPDF: boolean;
	moveProcessedPDFs: boolean;
	processedPDFFolder: string;
	// Ollama advanced settings
	ollamaImagesPerRequest?: number;
	ollamaRetryCount?: number;
	ollamaRetryDelayMs?: number;
	ollamaAssumeVision?: boolean;
	ollamaEnableStreaming?: boolean;
	ollamaMaxRequestChars?: number;
	ollamaNumPredict?: number;
	ollamaTemperature?: number;
	ollamaTextFallbackEnabled?: boolean;
	// OCR settings (Tesseract)
	tesseractPath?: string;
	tesseractLanguages?: string; // e.g., 'eng', 'eng+por'
	tesseractOEM?: number; // 0-3
	tesseractPSM?: number; // 0-13 typical
	// PDF image extraction controls
	pdfImageDpi?: number;
	pdfImageMaxWidth?: number;
	pdfImageFormat?: 'png' | 'jpeg';
	pdfJpegQuality?: number;
    popplerPdftoppmPath?: string;
    // OpenAI settings
    openaiApiKey?: string;
    openaiBaseUrl?: string; // allow Azure/compatible endpoints
    openaiOrganization?: string;
    openaiTemperature?: number;
    openaiMaxTokens?: number;
    // LM Studio settings (OpenAI-compatible)
    lmstudioBaseUrl?: string;
    lmstudioApiKey?: string; // optional if LM Studio enforces auth
    lmstudioTemperature?: number;
    lmstudioMaxTokens?: number;
}

export interface SavedPrompt {
	id: string;
	name: string;
	content: string;
	createdAt: number;
}

export interface DefaultPrompt {
	id: string;
	name: string;
	content: string;
	isDefault: boolean;
}

// Load default prompts from external JSON file
export const DEFAULT_PROMPTS: DefaultPrompt[] = promptsData.defaultPrompts;

// Model display names for user-friendly interface
export const MODEL_DISPLAY_NAMES: Record<string, string> = {
	'claude-sonnet-4-0': 'Claude 4 Sonnet (latest)',
	'claude-opus-4-0': 'Claude 4 Opus (latest)',
	'claude-3-7-sonnet-latest': 'Claude 3.7 Sonnet (latest)',
	'claude-3-5-sonnet-latest': 'Claude 3.5 Sonnet (latest)'
};

export const DEFAULT_SETTINGS: PDF2MDSettings = {
	anthropicApiKey: '',
	ollamaUrl: 'http://localhost:11434',
	selectedModel: 'claude-sonnet-4-0',
    selectedProvider: 'anthropic',
	currentPrompt: DEFAULT_PROMPTS[0].content,
	savedPrompts: [],
	anthropicModels: [
		'claude-sonnet-4-0',
		'claude-opus-4-0',
		'claude-3-7-sonnet-latest',
		'claude-3-5-sonnet-latest'
	],
	ollamaModels: [],
	ollamaVisionModels: [],
    lmstudioModels: [],
    lmstudioVisionModels: [],
	selectedPromptId: 'image-text-extraction',
	defaultPrompts: DEFAULT_PROMPTS,
	postProcessingTemplate: '---\ntags: [pdf2md, converted]\ndate: {{date}}\n---\n\n{{content}}',
	enablePostProcessing: true,
    // Multi-pass defaults
    enableMultiPass: false,
    enableThirdPass: false,
    pass2Prompt: 'Clean and normalize the following Markdown: fix broken lists, convert ASCII tables to Markdown tables, merge hyphenated words at line breaks, standardize headings (ATX), and ensure consistent spacing. Do not add new content. Only return the improved Markdown.\n\nInput:',
    pass3Prompt: 'Improve the structure of the following Markdown: refine headings hierarchy, add missing blanks between sections, and format tables for readability without changing data. Do not change the meaning. Only return the improved Markdown.\n\nInput:',
	watchFolder: '',
	outputFolder: '',
	enableWatching: false,
	filenamePattern: '{{basename}}',
	embedPDF: false,
	moveProcessedPDFs: false,
	processedPDFFolder: 'Processed PDFs',
	// Ollama defaults
	ollamaImagesPerRequest: 1,
	ollamaRetryCount: 2,
	ollamaRetryDelayMs: 1000,
	ollamaAssumeVision: false,
	ollamaEnableStreaming: false,
	ollamaMaxRequestChars: 900000,
	ollamaNumPredict: 1024,
	ollamaTemperature: 0.2,
	ollamaTextFallbackEnabled: true,
	// OCR defaults
	tesseractPath: '',
	tesseractLanguages: 'eng',
	tesseractOEM: 1,
	tesseractPSM: 6,
	// PDF image extraction defaults
	pdfImageDpi: 200,
	pdfImageMaxWidth: 2048,
	pdfImageFormat: 'png',
	pdfJpegQuality: 85
	,
    popplerPdftoppmPath: '',
    // OpenAI defaults
    openaiApiKey: '',
    openaiBaseUrl: 'https://api.openai.com',
    openaiOrganization: '',
    openaiTemperature: 0.2,
    openaiMaxTokens: 2048,
    // LM Studio defaults
    lmstudioBaseUrl: 'http://localhost:1234',
    lmstudioApiKey: '',
    lmstudioTemperature: 0.2,
    lmstudioMaxTokens: 2048
}