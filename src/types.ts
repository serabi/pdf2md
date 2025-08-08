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
	selectedProvider: 'anthropic' | 'ollama';
	currentPrompt: string;
	savedPrompts: SavedPrompt[];
	anthropicModels: string[];
	ollamaModels: string[];
	ollamaVisionModels?: string[];
	selectedPromptId: string;
	defaultPrompts: DefaultPrompt[];
	postProcessingTemplate: string;
	enablePostProcessing: boolean;
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
	// PDF image extraction controls
	pdfImageDpi?: number;
	pdfImageMaxWidth?: number;
	pdfImageFormat?: 'png' | 'jpeg';
	pdfJpegQuality?: number;
	popplerPdftoppmPath?: string;
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
	selectedPromptId: 'image-text-extraction',
	defaultPrompts: DEFAULT_PROMPTS,
	postProcessingTemplate: '---\ntags: [pdf2md, converted]\ndate: {{date}}\n---\n\n{{content}}',
	enablePostProcessing: true,
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
	// PDF image extraction defaults
	pdfImageDpi: 200,
	pdfImageMaxWidth: 2048,
	pdfImageFormat: 'png',
	pdfJpegQuality: 85
	,
	popplerPdftoppmPath: ''
}